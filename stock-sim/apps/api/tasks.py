"""Future Lab (Section 11.7/11.3) — Celery tasks for async branch execution.

Each task opens its OWN DB session rather than reusing a request-scoped
session, since it runs in a separate worker process with no access to the
request that enqueued it. Every task is responsible for its own commit/
rollback and for updating Timeline.status so GET /sim/timelines/{id}/status
has something to poll.

`_session_factory` is module-level and swappable (see
apps/api/tests/conftest.py's celery_eager fixture) so tests running Celery
in eager/inline mode (task_always_eager=True) can point these tasks at the
same per-test in-memory SQLite engine the API request used, instead of the
module-level apps.api.database.SessionLocal (which is bound to a different
engine and would see an empty database in a test run).
"""

import logging

from apps.api.celery_app import celery_app
from apps.api.database import SessionLocal
from apps.api.services import audit_service, branch_service
from db.models import Timeline

logger = logging.getLogger(__name__)

_session_factory = SessionLocal


@celery_app.task(name="apps.api.tasks.run_fast_forward_job", bind=True)
def run_fast_forward_job(self, timeline_id: int, target_days: int) -> dict:
    """Fast-forward a just-created branch by `target_days` ticks.

    Dispatched from POST /sim/timelines right after branch_service.create_branch
    commits the pending Timeline row. Flips status pending -> running -> ready,
    or -> failed with the exception recorded in audit_log on error.
    """
    db = _session_factory()
    try:
        branch_service.extend_timeline(db, timeline_id, target_days)
        db.commit()
        return {"timeline_id": timeline_id, "status": "ready", "days": target_days}
    except Exception as exc:
        # branch_service.extend_timeline flips timeline.status = "failed" and
        # flushes (not commits) that change before re-raising -- the flip is
        # still part of THIS session's open transaction. The db.rollback()
        # below is required to discard whatever partial simulation writes
        # run_ticks made, but that also throws away the flushed status flip,
        # since a flush isn't durable until commit. Net effect (the actual
        # production incident this fixes): a task that fails mid-fast-forward
        # rolls back cleanly but leaves Timeline.status stuck at "running"
        # forever -- indistinguishable from a job that's still in progress.
        #
        # Fix: roll back the failed session first (discarding the bad
        # simulation writes), then persist just the status flip + audit log
        # as an independent transaction on a FRESH session, so this doesn't
        # depend on the original session/transaction being in a usable state.
        db.rollback()
        db.close()
        logger.exception("run_fast_forward_job failed for timeline %s", timeline_id)
        status_db = _session_factory()
        try:
            timeline = status_db.query(Timeline).filter_by(id=timeline_id).first()
            if timeline is not None:
                timeline.status = "failed"
            audit_service.record(
                status_db, actor_user_id=None, action="create_timeline", timeline_id=timeline_id,
                after_value={"status": "failed", "error": str(exc)},
            )
            status_db.commit()
        except Exception:
            status_db.rollback()
            logger.exception(
                "Failed to persist status=failed for timeline %s after task failure", timeline_id,
            )
        finally:
            status_db.close()
        raise
    finally:
        db.close()


@celery_app.task(name="apps.api.tasks.run_ensemble_member_job", bind=True)
def run_ensemble_member_job(self, timeline_id: int, target_days: int) -> dict:
    """One member of a sensitivity-sweep/Monte-Carlo timeline_group.

    Identical execution to run_fast_forward_job -- kept as a distinct task
    name so ensemble dispatch (Phase 5's scenario-library integration and
    any future engine/ensemble.py fan-out) can be monitored/rate-limited
    independently from single-branch fast-forwards in Celery's routing.
    """
    return run_fast_forward_job.run(timeline_id, target_days)
