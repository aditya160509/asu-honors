"""Tests for the Future Lab (Section 11) API surface: timeline status/diff/
extend/delete, timeline-groups, scenario-library, audit-log."""

from datetime import date

import pytest

from db.models import Portfolio, Timeline, TimelineGroup, TimelineOverride


def _seed_tickable(test_db, test_company, test_timeline):
    from apps.api.tests.test_simulation import _seed_tickable as _impl
    _impl(test_db, test_company, test_timeline)


# ── /sim/timelines/estimate-cost ────────────────────────────────────────


def test_estimate_branch_cost(client, test_db, test_timeline, test_company, auth_headers):
    resp = client.get(
        "/api/v1/sim/timelines/estimate-cost",
        params={"parent_timeline_id": test_timeline.id, "fast_forward_days": 30},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fast_forward_days"] == 30
    assert body["company_count"] == 1
    assert body["estimated_compute_ms"] > 0


def test_estimate_branch_cost_negative_days_rejected(client, test_db, test_timeline, auth_headers):
    resp = client.get(
        "/api/v1/sim/timelines/estimate-cost",
        params={"parent_timeline_id": test_timeline.id, "fast_forward_days": -1},
        headers=auth_headers,
    )
    assert resp.status_code == 409


# ── /sim/timelines/{id}/status ──────────────────────────────────────────


def test_get_timeline_status(client, test_db, test_timeline, auth_headers):
    resp = client.get(f"/api/v1/sim/timelines/{test_timeline.id}/status", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == test_timeline.id
    assert body["status"] == "ready"
    assert body["current_sim_date"] == "2026-01-02"
    assert body["tick_count"] == 0


def test_get_timeline_status_not_found(client, test_db, auth_headers):
    resp = client.get("/api/v1/sim/timelines/999/status", headers=auth_headers)
    assert resp.status_code == 404


# ── /sim/timelines/{id}/diff ─────────────────────────────────────────────


def test_diff_timelines(client, test_db, test_timeline, auth_headers):
    child = Timeline(id=20, name="Child", rng_seed=1, is_live=False, parent_timeline_id=test_timeline.id)
    test_db.add(child)
    test_db.commit()
    test_db.add(TimelineOverride(
        timeline_id=test_timeline.id, target_type="config", target_key="theta_default",
        override_value="0.05", effective_from_sim_date=date(2026, 1, 1),
    ))
    test_db.add(TimelineOverride(
        timeline_id=child.id, target_type="config", target_key="theta_default",
        override_value="0.09", effective_from_sim_date=date(2026, 1, 2),
    ))
    test_db.commit()

    resp = client.get(
        f"/api/v1/sim/timelines/{test_timeline.id}/diff", params={"vs": child.id}, headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["left_timeline_id"] == test_timeline.id
    assert body["right_timeline_id"] == child.id
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["target_key"] == "theta_default"
    assert entry["left_value"] == "0.05"
    assert entry["right_value"] == "0.09"


def test_diff_timelines_no_differences(client, test_db, test_timeline, auth_headers):
    child = Timeline(id=21, name="Identical Child", rng_seed=1, is_live=False, parent_timeline_id=test_timeline.id)
    test_db.add(child)
    test_db.commit()

    resp = client.get(
        f"/api/v1/sim/timelines/{test_timeline.id}/diff", params={"vs": child.id}, headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["entries"] == []


# ── /sim/timelines/{id}/extend ───────────────────────────────────────────


def test_extend_timeline_endpoint(client, test_db, test_timeline, test_company, auth_headers, test_user, base_config):
    _seed_tickable(test_db, test_company, test_timeline)
    from apps.api.services import branch_service
    child = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Extend Endpoint Branch",
        parent_id=test_timeline.id, branch_date=date(2026, 1, 1), rng_seed=7, primitive="manual",
    )
    test_db.commit()

    resp = client.post(
        f"/api/v1/sim/timelines/{child.id}/extend", json={"days": 2}, headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"

    from db.models import Notification
    notifications = test_db.query(Notification).filter_by(
        user_id=test_user.id, notification_type="branch_ready",
    ).all()
    assert len(notifications) == 1
    assert notifications[0].payload["timeline_id"] == child.id


def test_extend_timeline_invalid_days(client, test_db, test_timeline, auth_headers):
    resp = client.post(
        f"/api/v1/sim/timelines/{test_timeline.id}/extend", json={"days": 0}, headers=auth_headers,
    )
    assert resp.status_code == 422


def test_extend_timeline_endpoint_persists_failed_status_on_error(
    client, test_db, test_timeline, test_company, auth_headers, test_user, base_config, monkeypatch,
):
    """Regression test: a run_ticks failure mid-fast-forward must leave
    Timeline.status durably at "failed", not stuck at "running" forever.
    branch_service.extend_timeline only flushes (not commits) the failed
    flip before re-raising -- get_db's rollback-on-unhandled-exception used
    to discard that flip along with the partial simulation writes, since the
    router had no except clause of its own (the same incident
    apps/api/tasks.py's run_fast_forward_job was already fixed to avoid for
    the async path)."""
    _seed_tickable(test_db, test_company, test_timeline)
    from apps.api.services import branch_service
    child = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Failing Branch",
        parent_id=test_timeline.id, branch_date=date(2026, 1, 1), rng_seed=7, primitive="manual",
    )
    test_db.commit()
    child_id = child.id

    def _boom(*args, **kwargs):
        raise RuntimeError("simulated run_ticks failure")

    monkeypatch.setattr(branch_service, "run_ticks", _boom)

    # TestClient's default raise_server_exceptions=True re-raises an unhandled
    # endpoint exception into the test process rather than returning a 500.
    with pytest.raises(RuntimeError):
        client.post(f"/api/v1/sim/timelines/{child_id}/extend", json={"days": 2}, headers=auth_headers)

    status_resp = client.get(f"/api/v1/sim/timelines/{child_id}/status", headers=auth_headers)
    assert status_resp.json()["status"] == "failed"

    from db.models import Notification
    notifications = test_db.query(Notification).filter_by(
        user_id=test_user.id, notification_type="branch_failed",
    ).all()
    assert len(notifications) == 1
    assert notifications[0].payload["timeline_id"] == child_id


# ── DELETE /sim/timelines/{id} ───────────────────────────────────────────


def test_delete_timeline(client, test_db, test_timeline, auth_headers, test_user):
    from apps.api.services import branch_service
    child = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Disposable", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=1, primitive="manual",
    )
    test_db.commit()

    resp = client.delete(f"/api/v1/sim/timelines/{child.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "archived"


def test_delete_live_timeline_conflict(client, test_db, test_timeline, auth_headers):
    resp = client.delete(f"/api/v1/sim/timelines/{test_timeline.id}", headers=auth_headers)
    assert resp.status_code == 409


# ── /sim/timeline-groups/{id} ────────────────────────────────────────────


def test_get_timeline_group(client, test_db, test_timeline, auth_headers, test_user):
    group = TimelineGroup(owner_user_id=test_user.id, primitive="monte_carlo", label="Test Ensemble")
    test_db.add(group)
    test_db.commit()

    member = Timeline(
        id=30, name="Ensemble Member 1", rng_seed=1, is_live=False,
        parent_timeline_id=test_timeline.id, timeline_group_id=group.id,
    )
    test_db.add(member)
    test_db.commit()

    resp = client.get(f"/api/v1/sim/timeline-groups/{group.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["primitive"] == "monte_carlo"
    assert body["label"] == "Test Ensemble"
    assert body["member_timeline_ids"] == [30]


def test_get_timeline_group_not_found(client, test_db, auth_headers):
    resp = client.get("/api/v1/sim/timeline-groups/999", headers=auth_headers)
    assert resp.status_code == 404


def test_get_timeline_group_distribution(client, test_db, test_timeline, auth_headers, test_user):
    group = TimelineGroup(owner_user_id=test_user.id, primitive="monte_carlo", label="Ensemble")
    test_db.add(group)
    test_db.commit()

    members = []
    for i, total_value in enumerate([100_000.0, 105_000.0, 95_000.0]):
        m = Timeline(
            id=40 + i, name=f"Member {i}", rng_seed=i, is_live=False,
            parent_timeline_id=test_timeline.id, timeline_group_id=group.id,
        )
        test_db.add(m)
        test_db.commit()
        pf = Portfolio(user_id=test_user.id, timeline_id=m.id, cash_balance=total_value, total_value=total_value)
        test_db.add(pf)
        members.append(m)
    test_db.commit()

    resp = client.get(
        f"/api/v1/sim/timeline-groups/{group.id}/distribution",
        params={"metric": "portfolio_return"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 3
    assert body["mean"] == pytest.approx(100_000.0)
    assert body["median"] is not None
    assert len(body["histogram_bins"]) >= 1


# ── /sim/scenario-library ────────────────────────────────────────────────


def test_list_scenario_library_empty(client, test_db, auth_headers):
    resp = client.get("/api/v1/sim/scenario-library", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_scenario_template_requires_admin(client, test_db, auth_headers):
    resp = client.post(
        "/api/v1/sim/scenario-library",
        json={
            "name": "Mild Recession",
            "category": "macro",
            "effect_profile": {"overrides": []},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 403


def test_create_and_list_scenario_template(client, test_db, admin_auth_headers, auth_headers):
    resp = client.post(
        "/api/v1/sim/scenario-library",
        json={
            "name": "Mild Recession",
            "description": "Forces contraction for 120 days",
            "category": "macro",
            "effect_profile": {
                "overrides": [
                    {"target_type": "cycle_transition", "target_key": "contraction", "override_value": "1.0"},
                ]
            },
            "default_duration_days": 120,
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Mild Recession"
    assert body["category"] == "macro"

    resp2 = client.get("/api/v1/sim/scenario-library", headers=auth_headers)
    assert resp2.status_code == 200
    assert len(resp2.json()) == 1


def test_create_scenario_template_invalid_category(client, test_db, admin_auth_headers):
    resp = client.post(
        "/api/v1/sim/scenario-library",
        json={"name": "Bad", "category": "not_a_real_category", "effect_profile": {}},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


# ── /audit-log ────────────────────────────────────────────────────────────


def test_audit_log_records_timeline_creation(client, test_db, test_timeline, auth_headers, admin_auth_headers):
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Audited Branch",
            "parent_timeline_id": test_timeline.id,
            "branch_point_sim_date": "2026-01-02",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    timeline_id = resp.json()["id"]

    resp2 = client.get("/api/v1/audit-log", params={"timeline_id": timeline_id}, headers=admin_auth_headers)
    assert resp2.status_code == 200
    entries = resp2.json()
    assert len(entries) == 1
    assert entries[0]["action"] == "create_timeline"


def test_audit_log_requires_admin(client, test_db, auth_headers):
    resp = client.get("/api/v1/audit-log", headers=auth_headers)
    assert resp.status_code == 403


# ── async fast-forward dispatch (Phase 4 — Celery) ───────────────────────


def test_create_timeline_with_fast_forward_dispatches_and_completes(
    client, test_db, test_timeline, test_company, auth_headers, base_config,
):
    """POST /sim/timelines with fast_forward_days > 0 dispatches
    apps.api.tasks.run_fast_forward_job. In tests Celery runs eager/inline
    (see conftest.py's client fixture), so by the time this request returns
    the branch has already been fast-forwarded -- confirms the task
    actually ran against the same DB the test asserts against, not a
    different (empty) database."""
    _seed_tickable(test_db, test_company, test_timeline)

    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Fast Forwarded Branch",
            "parent_timeline_id": test_timeline.id,
            "branch_point_sim_date": "2026-01-02",
            "fast_forward_days": 3,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    timeline_id = resp.json()["id"]

    status_resp = client.get(f"/api/v1/sim/timelines/{timeline_id}/status", headers=auth_headers)
    assert status_resp.status_code == 200
    body = status_resp.json()
    assert body["status"] == "ready"
    assert body["tick_count"] == 3


def test_create_timeline_without_fast_forward_stays_pending(
    client, test_db, test_timeline, auth_headers,
):
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "No Fast Forward",
            "parent_timeline_id": test_timeline.id,
            "branch_point_sim_date": "2026-01-02",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"


def test_create_timeline_negative_fast_forward_days_rejected(client, test_db, test_timeline, auth_headers):
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Bad Fast Forward",
            "parent_timeline_id": test_timeline.id,
            "branch_point_sim_date": "2026-01-02",
            "fast_forward_days": -5,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_create_timeline_marks_failed_when_no_worker_is_listening(
    client, test_db, test_timeline, auth_headers,
):
    """Regression test for the production incident: if no Celery worker
    responds to the pre-dispatch liveness ping, the branch must NOT be left
    stuck at status='pending' forever with no signal anything went wrong --
    it should be marked 'failed' immediately (see
    apps.api.routers.simulation.create_timeline's docstring)."""
    from apps.api.celery_app import celery_app

    original_ping = celery_app.control.ping
    celery_app.control.ping = lambda *a, **kw: []  # simulates no worker responding
    try:
        resp = client.post(
            "/api/v1/sim/timelines",
            json={
                "name": "No Worker Available",
                "parent_timeline_id": test_timeline.id,
                "branch_point_sim_date": "2026-01-02",
                "fast_forward_days": 5,
            },
            headers=auth_headers,
        )
    finally:
        celery_app.control.ping = original_ping

    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "failed"
