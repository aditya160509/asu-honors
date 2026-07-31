"""Zero-infrastructure background execution for Future Lab.

The API process owns a bounded thread pool. Simulation state and terminal
status live in PostgreSQL, so the pool itself contains no valuable data.
Pending timelines are resubmitted on application startup. Interrupted running
timelines are marked failed instead of replayed, because completed tick chunks
may already be durable and blindly repeating them would corrupt the scenario.
This deliberately targets a single Render API instance; scale-out deployments
should replace this adapter with a distributed queue.
"""

from __future__ import annotations

import logging
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock
from typing import Any, Callable

from apps.api.config import settings

logger = logging.getLogger(__name__)
_executor: ThreadPoolExecutor | None = None
_futures: dict[str, Future[Any]] = {}
_lock = Lock()
_eager = False


def start() -> None:
    global _executor
    with _lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(
                max_workers=max(1, settings.background_worker_threads),
                thread_name_prefix="future-lab",
            )


def stop() -> None:
    global _executor
    with _lock:
        executor, _executor = _executor, None
    if executor is not None:
        executor.shutdown(wait=False, cancel_futures=False)


def available() -> bool:
    return _eager or _executor is not None


def recover_timelines() -> None:
    """Recover durable job state after an API process restart."""
    from apps.api.database import SessionLocal
    from apps.api.tasks import run_ensemble_member_job, run_fast_forward_job
    from db.models import Timeline

    db = SessionLocal()
    try:
        interrupted = db.query(Timeline).filter(Timeline.status == "running").all()
        for timeline in interrupted:
            timeline.status = "failed"
            timeline.failure_error = "The API process restarted while this simulation was running."
            timeline.recovery_action = (
                "Duplicate this branch and run it again; the interrupted branch is retained for audit."
            )

        pending = db.query(Timeline).filter(Timeline.status == "pending").all()
        pending_jobs = [
            (
                timeline.id,
                max(0, timeline.requested_ticks or 0),
                timeline.timeline_group_id is not None,
            )
            for timeline in pending
        ]
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to recover persisted Future Lab jobs")
        return
    finally:
        db.close()

    for timeline_id, requested_ticks, is_ensemble in pending_jobs:
        if requested_ticks <= 0:
            continue
        function = run_ensemble_member_job if is_ensemble else run_fast_forward_job
        submit(f"timeline-{timeline_id}", function, timeline_id, requested_ticks)


def submit(job_key: str, function: Callable[..., Any], *args: Any) -> Future[Any] | Any:
    if _eager:
        return function(*args)
    start()
    with _lock:
        existing = _futures.get(job_key)
        if existing is not None and not existing.done():
            return existing
        assert _executor is not None
        future = _executor.submit(function, *args)
        _futures[job_key] = future
        future.add_done_callback(lambda completed: _complete(job_key, completed))
        return future


def _complete(job_key: str, future: Future[Any]) -> None:
    try:
        future.result()
    except Exception:
        logger.exception("Background job %s failed", job_key)
    finally:
        with _lock:
            _futures.pop(job_key, None)
