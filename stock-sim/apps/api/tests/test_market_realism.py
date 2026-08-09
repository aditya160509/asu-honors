"""API integration tests for the market-realism layer."""

from datetime import date

from db.models import CorporateAction, EconomicCalendarEvent, MarketMicroTick, MarketRegimeState, ReplayLedger


def test_profile_intraday_depth_and_session_endpoints(
    client, test_db, test_company, test_timeline, auth_headers, admin_auth_headers
):
    profile = client.get("/api/v1/sim/realism/profile", headers=auth_headers)
    assert profile.status_code == 200
    assert profile.json()["preset"] == "realistic"

    updated = client.put(
        "/api/v1/sim/admin/realism-profile",
        json={"timeline_id": 1, "preset": "educational"},
        headers=admin_auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["preset"] == "educational"
    assert updated.json()["version"] >= 2

    intraday = client.post(
        "/api/v1/sim/intraday",
        json={"timeline_id": 1, "sim_date": "2026-01-02", "tick_count": 3, "company_ids": [1]},
        headers=auth_headers,
    )
    assert intraday.status_code == 200
    assert intraday.json()["ticks_created"] == 3

    book = client.get("/api/v1/market/order-book/TST?timeline_id=1&sim_date=2026-01-02&tick_index=0")
    assert book.status_code == 200
    assert book.json()["ask_price"] > book.json()["bid_price"]
    assert len(book.json()["depth"]["asks"]) > 0

    ticks = client.get("/api/v1/companies/TST/micro-ticks?timeline_id=1&sim_date=2026-01-02")
    assert ticks.status_code == 200
    assert len(ticks.json()) == 3

    session = client.get("/api/v1/market/session?timeline_id=1&sim_date=2026-01-02")
    assert session.status_code == 200
    assert session.json()["status"] == "closed"
    assert session.json()["current_tick"] == 3


def test_admin_calendar_and_corporate_action_are_persisted(
    client, test_db, test_company, test_portfolio, admin_auth_headers, auth_headers
):
    calendar = client.post(
        "/api/v1/sim/admin/calendar",
        json={
            "timeline_id": 1,
            "event_type": "interest_rate",
            "title": "Policy decision",
            "scheduled_date": "2026-01-10",
            "consensus_value": 4.0,
            "importance": 2.0,
        },
        headers=admin_auth_headers,
    )
    assert calendar.status_code == 201
    assert calendar.json()["status"] == "scheduled"

    action = client.post(
        "/api/v1/sim/admin/corporate-actions",
        json={
            "timeline_id": 1,
            "company_id": 1,
            "action_type": "split",
            "effective_date": "2026-01-10",
            "ratio": 2.0,
        },
        headers=admin_auth_headers,
    )
    assert action.status_code == 201
    assert action.json()["action_type"] == "split"

    listed = client.get("/api/v1/sim/calendar?timeline_id=1", headers=auth_headers)
    assert listed.status_code == 200
    assert any(item["title"] == "Policy decision" for item in listed.json())


def test_daily_advance_persists_regime_quotes_and_replay(
    client, test_db, test_company, test_timeline, base_config, auth_headers
):
    from apps.api.tests.test_simulation import _seed_tickable

    _seed_tickable(test_db, test_company, test_timeline)
    advanced = client.post(
        "/api/v1/sim/advance",
        json={"timeline_id": 1, "days": 1},
        headers=auth_headers,
    )
    assert advanced.status_code == 200

    regime = client.get("/api/v1/market/regime?timeline_id=1")
    assert regime.status_code == 200
    assert regime.json()["regime"] in {"bull", "bear", "sideways", "high_volatility", "crisis"}

    replay = client.get("/api/v1/sim/replay?timeline_id=1", headers=auth_headers)
    assert replay.status_code == 200
    assert any(item["event_type"] == "regime_classification" for item in replay.json())

    quote = client.get("/api/v1/market/order-book/TST?timeline_id=1")
    assert quote.status_code == 200
    assert quote.json()["ticker"] == "TST"
