"""Regression tests for apps/api/tasks.py's failure-persistence behavior.

Covers the production incident where a fast-forward task that raised mid-run
left Timeline.status stuck at "running" forever: branch_service.extend_timeline
flips status to "failed" and flushes that change inside the task's session,
but the task's own except-block db.rollback() (needed to discard partial
simulation writes) silently discarded that flush too, since a flush isn't
durable until commit. See apps/api/tasks.py::run_fast_forward_job for the fix.
"""

from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy.orm import sessionmaker

from apps.api import tasks as tasks_module
from db.models import SimulationState, Timeline


@pytest.fixture()
def branch_timeline(test_db, test_timeline) -> Timeline:
    branch = Timeline(
        name="Branch Under Test",
        parent_timeline_id=test_timeline.id,
        branch_point_sim_date=date(2026, 1, 2),
        rng_seed=7,
        is_live=False,
        primitive="manual",
        status="pending",
    )
    test_db.add(branch)
    test_db.flush()
    test_db.add(SimulationState(
        timeline_id=branch.id,
        current_sim_date=date(2026, 1, 2),
        tick_count=0,
        is_running=False,
    ))
    test_db.commit()
    test_db.refresh(branch)
    return branch


def test_run_fast_forward_job_durably_persists_failed_status_after_exception(
    test_db, engine, branch_timeline,
):
    """If run_ticks raises mid-fast-forward, the task's own db.rollback()
    (needed to discard partial simulation writes) must not also erase the
    Timeline.status='failed' flip -- that has to survive as an independent,
    already-committed transaction."""
    original_factory = tasks_module._session_factory
    tasks_module._session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    try:
        with patch("apps.api.services.branch_service.run_ticks", side_effect=RuntimeError("boom")):
            with pytest.raises(RuntimeError):
                tasks_module.run_fast_forward_job(branch_timeline.id, 5)
    finally:
        tasks_module._session_factory = original_factory

    # Read back via a completely fresh query on test_db (not any session the
    # task touched) to prove the failure is durably committed, not just
    # visible via the same in-memory object the task mutated.
    test_db.expire_all()
    refreshed = test_db.query(Timeline).filter_by(id=branch_timeline.id).first()
    assert refreshed.status == "failed"
