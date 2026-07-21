"""Tests for apps/api/services/notification_service.py and the
/api/v1/notifications router: notification CRUD, price-alert CRUD, and the
price-alert / watchlist-mover evaluators (unit-level, independent of the full
simulation engine -- same style as test_trading.py's
test_check_and_fill_limit_orders_fills_when_price_crosses)."""

from datetime import date

import pytest

from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.services import notification_service
from db.models import Notification, PriceAlert, PriceHistory, Watchlist, WatchlistGroup


# ── Notification CRUD ───────────────────────────────────────────────────


def test_create_and_list_notifications(test_db, test_user):
    notification_service.create_notification(
        test_db, user_id=test_user.id, notification_type="branch_ready",
        payload={"timeline_id": 1}, sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    entries = notification_service.list_notifications(test_db, test_user.id)
    assert len(entries) == 1
    assert entries[0].notification_type == "branch_ready"
    assert entries[0].payload == {"timeline_id": 1}


def test_create_notification_rejects_unknown_type(test_db, test_user):
    with pytest.raises(ValueError):
        notification_service.create_notification(
            test_db, user_id=test_user.id, notification_type="not_a_real_type",
            payload={}, sim_date=date(2026, 1, 2),
        )


def test_count_unread_and_mark_read(test_db, test_user):
    n1 = notification_service.create_notification(
        test_db, user_id=test_user.id, notification_type="branch_ready",
        payload={}, sim_date=date(2026, 1, 2),
    )
    notification_service.create_notification(
        test_db, user_id=test_user.id, notification_type="branch_failed",
        payload={}, sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    assert notification_service.count_unread(test_db, test_user.id) == 2

    notification_service.mark_read(test_db, n1.id, test_user.id)
    test_db.commit()
    assert notification_service.count_unread(test_db, test_user.id) == 1


def test_mark_read_wrong_user_raises(test_db, test_user):
    entry = notification_service.create_notification(
        test_db, user_id=test_user.id, notification_type="branch_ready",
        payload={}, sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    with pytest.raises(NotFoundError):
        notification_service.mark_read(test_db, entry.id, user_id=test_user.id + 999)


def test_mark_all_read(test_db, test_user):
    for _ in range(3):
        notification_service.create_notification(
            test_db, user_id=test_user.id, notification_type="branch_ready",
            payload={}, sim_date=date(2026, 1, 2),
        )
    test_db.commit()

    marked = notification_service.mark_all_read(test_db, test_user.id)
    test_db.commit()
    assert marked == 3
    assert notification_service.count_unread(test_db, test_user.id) == 0


# ── Price alert CRUD ─────────────────────────────────────────────────────


def test_create_price_alert(test_db, test_user, test_company, test_timeline):
    alert = notification_service.create_price_alert(
        test_db, user_id=test_user.id, company_id=test_company.id, timeline_id=test_timeline.id,
        target_price=120, direction="above",
    )
    test_db.commit()

    assert alert.id is not None
    assert alert.is_active is True
    assert alert.direction == "above"


def test_create_price_alert_invalid_direction_raises(test_db, test_user, test_company, test_timeline):
    with pytest.raises(ConflictError):
        notification_service.create_price_alert(
            test_db, user_id=test_user.id, company_id=test_company.id, timeline_id=test_timeline.id,
            target_price=120, direction="sideways",
        )


def test_create_price_alert_missing_company_raises(test_db, test_user, test_timeline):
    with pytest.raises(NotFoundError):
        notification_service.create_price_alert(
            test_db, user_id=test_user.id, company_id=999, timeline_id=test_timeline.id,
            target_price=120, direction="above",
        )


def test_delete_price_alert(test_db, test_user, test_company, test_timeline):
    alert = notification_service.create_price_alert(
        test_db, user_id=test_user.id, company_id=test_company.id, timeline_id=test_timeline.id,
        target_price=120, direction="above",
    )
    test_db.commit()

    notification_service.delete_price_alert(test_db, alert.id, test_user.id)
    test_db.commit()
    assert test_db.query(PriceAlert).filter_by(id=alert.id).first() is None


def test_delete_price_alert_wrong_user_raises(test_db, test_user, test_company, test_timeline):
    alert = notification_service.create_price_alert(
        test_db, user_id=test_user.id, company_id=test_company.id, timeline_id=test_timeline.id,
        target_price=120, direction="above",
    )
    test_db.commit()

    with pytest.raises(NotFoundError):
        notification_service.delete_price_alert(test_db, alert.id, user_id=test_user.id + 999)


# ── evaluate_price_alerts ───────────────────────────────────────────────


def test_evaluate_price_alerts_triggers_and_deactivates(test_db, test_user, test_company, test_timeline):
    """test_company's fixture PriceHistory row already sets close=100.0 on
    2026-01-01 (see conftest.py). A "below 90" alert shouldn't fire against
    that; add a lower-priced row and confirm it does."""
    alert = notification_service.create_price_alert(
        test_db, user_id=test_user.id, company_id=test_company.id, timeline_id=test_timeline.id,
        target_price=90, direction="below",
    )
    test_db.commit()

    assert notification_service.evaluate_price_alerts(test_db, test_timeline.id) == []

    test_db.add(PriceHistory(
        timeline_id=test_timeline.id, company_id=test_company.id, sim_date=date(2026, 1, 2),
        open=95.0, high=96.0, low=87.0, close=88.0,
        volume=500_000, intrinsic_value=100.0, order_imbalance=0.0,
    ))
    test_db.commit()

    created = notification_service.evaluate_price_alerts(test_db, test_timeline.id)
    test_db.commit()

    assert len(created) == 1
    assert created[0].notification_type == "price_alert"
    assert created[0].payload["ticker"] == test_company.ticker

    test_db.refresh(alert)
    assert alert.is_active is False
    assert alert.triggered_at is not None

    # One-shot: re-evaluating with the price still past target must not fire again.
    assert notification_service.evaluate_price_alerts(test_db, test_timeline.id) == []


# ── evaluate_watchlist_movers ────────────────────────────────────────────


def test_evaluate_watchlist_movers_fires_on_big_move(test_db, test_user, test_company, test_timeline):
    group = WatchlistGroup(user_id=test_user.id, name="Default")
    test_db.add(group)
    test_db.commit()
    test_db.add(Watchlist(user_id=test_user.id, company_id=test_company.id, group_id=group.id))
    test_db.commit()

    # test_company's fixture row is close=100.0 on 2026-01-01. Add a second
    # day with an 11% jump -- past the 5% threshold.
    test_db.add(PriceHistory(
        timeline_id=test_timeline.id, company_id=test_company.id, sim_date=date(2026, 1, 2),
        open=100.0, high=112.0, low=99.0, close=111.0,
        volume=500_000, intrinsic_value=100.0, order_imbalance=0.0,
    ))
    test_db.commit()

    created = notification_service.evaluate_watchlist_movers(test_db, test_timeline.id)
    test_db.commit()

    assert len(created) == 1
    assert created[0].notification_type == "watchlist_mover"
    assert created[0].payload["ticker"] == test_company.ticker


def test_evaluate_watchlist_movers_ignores_small_move(test_db, test_user, test_company, test_timeline):
    group = WatchlistGroup(user_id=test_user.id, name="Default")
    test_db.add(group)
    test_db.commit()
    test_db.add(Watchlist(user_id=test_user.id, company_id=test_company.id, group_id=group.id))
    test_db.commit()

    test_db.add(PriceHistory(
        timeline_id=test_timeline.id, company_id=test_company.id, sim_date=date(2026, 1, 2),
        open=100.0, high=101.0, low=99.0, close=101.0,
        volume=500_000, intrinsic_value=100.0, order_imbalance=0.0,
    ))
    test_db.commit()

    assert notification_service.evaluate_watchlist_movers(test_db, test_timeline.id) == []


# ── Router endpoints ────────────────────────────────────────────────────


def test_notifications_router_list_and_mark_read(client, test_db, test_user, auth_headers):
    notification_service.create_notification(
        test_db, user_id=test_user.id, notification_type="branch_ready",
        payload={"timeline_id": 1}, sim_date=date(2026, 1, 2),
    )
    test_db.commit()

    resp = client.get("/api/v1/notifications", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    notification_id = body[0]["id"]

    unread_resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert unread_resp.json()["unread_count"] == 1

    read_resp = client.post(f"/api/v1/notifications/{notification_id}/read", headers=auth_headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["read_at"] is not None

    unread_resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert unread_resp.json()["unread_count"] == 0


def test_notifications_router_read_all(client, test_db, test_user, auth_headers):
    for _ in range(2):
        notification_service.create_notification(
            test_db, user_id=test_user.id, notification_type="branch_ready",
            payload={}, sim_date=date(2026, 1, 2),
        )
    test_db.commit()

    resp = client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["marked_count"] == 2


def test_price_alerts_router_crud(client, test_db, test_company, test_timeline, auth_headers):
    create_resp = client.post(
        "/api/v1/notifications/price-alerts",
        json={
            "company_id": test_company.id, "timeline_id": test_timeline.id,
            "target_price": "150.0", "direction": "above",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    alert_id = create_resp.json()["id"]

    list_resp = client.get("/api/v1/notifications/price-alerts", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    delete_resp = client.delete(f"/api/v1/notifications/price-alerts/{alert_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    list_resp = client.get("/api/v1/notifications/price-alerts", headers=auth_headers)
    assert list_resp.json() == []


def test_price_alerts_router_rejects_invalid_direction(client, test_db, test_company, test_timeline, auth_headers):
    resp = client.post(
        "/api/v1/notifications/price-alerts",
        json={
            "company_id": test_company.id, "timeline_id": test_timeline.id,
            "target_price": "150.0", "direction": "sideways",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
