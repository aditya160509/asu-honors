"""Tests for Phase 2 portfolio endpoints: history, dividends, goals, named watchlists."""

from datetime import date, timedelta

import pytest

from db.models import Dividend, Holding, PriceHistory, Transaction


# ---------------------------------------------------------------------------
# Portfolio history
# ---------------------------------------------------------------------------


def _add_price(db, company_id, timeline_id, d, close):
    db.add(
        PriceHistory(
            timeline_id=timeline_id,
            company_id=company_id,
            sim_date=d,
            open=close,
            high=close,
            low=close,
            close=close,
            volume=1000,
            intrinsic_value=close,
            order_imbalance=0.0,
        )
    )


def test_history_empty_portfolio(client, test_db, test_portfolio, auth_headers):
    resp = client.get("/api/v1/portfolio/history?range=1M", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["range"] == "1M"
    assert body["points"] == []
    assert body["benchmark"] == []


def test_history_reconstructs_value(client, test_db, test_portfolio, test_company, auth_headers):
    # test_company seeds a 2026-01-01 baseline PriceHistory row (see
    # conftest.py) that collides with this test's own date range and would
    # otherwise double-count a point in the portfolio-history window (which
    # is bounded by test_timeline's current_sim_date=2026-01-02, not by
    # sim_today) -- replace it rather than shifting sim_today.
    from db.models import PriceHistory as _PH
    test_db.query(_PH).filter_by(timeline_id=1, company_id=test_company.id, sim_date=date(2026, 1, 1)).delete()
    test_db.commit()

    sim_today = date(2026, 1, 2)
    for i, close in enumerate([100.0, 110.0, 120.0]):
        _add_price(test_db, test_company.id, 1, sim_today - timedelta(days=2 - i), close)
    # Bought 10 shares at 100 on day one; fees 1.0.
    test_db.add(
        Transaction(
            portfolio_id=test_portfolio.id,
            company_id=test_company.id,
            sim_date=sim_today - timedelta(days=2),
            side="buy",
            quantity=10,
            price=100.0,
            fees=1.0,
            impact_applied=0.0,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/portfolio/history?range=1M", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["points"]) == 3
    assert len(body["benchmark"]) == 3
    # starting_cash 100k - 10*100 - 1 fee = 98_999 cash; +10 shares at close
    first, last = body["points"][0], body["points"][-1]
    assert float(first["cash"]) == pytest.approx(98_999.0)
    assert float(first["total_value"]) == pytest.approx(98_999.0 + 10 * 100.0)
    assert float(last["total_value"]) == pytest.approx(98_999.0 + 10 * 120.0)


def test_history_invalid_range_falls_back(client, test_db, test_portfolio, auth_headers):
    resp = client.get("/api/v1/portfolio/history?range=BOGUS", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["range"] == "1M"


# ---------------------------------------------------------------------------
# Dividends
# ---------------------------------------------------------------------------


def test_dividends_empty(client, test_db, test_portfolio, auth_headers):
    resp = client.get("/api/v1/portfolio/dividends", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["received"] == []
    assert body["upcoming"] == []


def test_dividends_received_and_upcoming(client, test_db, test_portfolio, test_company, auth_headers):
    sim_today = date(2026, 1, 2)
    # Held 10 shares since a month before sim_today.
    test_db.add(
        Transaction(
            portfolio_id=test_portfolio.id,
            company_id=test_company.id,
            sim_date=sim_today - timedelta(days=30),
            side="buy",
            quantity=10,
            price=100.0,
            fees=0.0,
            impact_applied=0.0,
        )
    )
    test_db.add(
        Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=100.0)
    )
    # One past dividend (ex_date before sim_today), one declared upcoming.
    test_db.add(
        Dividend(
            company_id=test_company.id,
            timeline_id=1,
            declared_date=sim_today - timedelta(days=40),
            ex_date=sim_today - timedelta(days=10),
            payment_date=sim_today - timedelta(days=3),
            amount_per_share=0.5,
        )
    )
    test_db.add(
        Dividend(
            company_id=test_company.id,
            timeline_id=1,
            declared_date=sim_today - timedelta(days=5),
            ex_date=sim_today + timedelta(days=20),
            payment_date=sim_today + timedelta(days=34),
            amount_per_share=0.5,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/portfolio/dividends", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["received"]) == 1
    assert body["received"][0]["shares_held"] == 10
    assert float(body["received"][0]["total_amount"]) == pytest.approx(5.0)
    assert len(body["upcoming"]) == 1
    assert float(body["upcoming"][0]["estimated_total"]) == pytest.approx(5.0)
    assert float(body["total_received"]) == pytest.approx(5.0)


def test_dividend_skipped_if_not_held_at_exdate(client, test_db, test_portfolio, test_company, auth_headers):
    sim_today = date(2026, 1, 2)
    # Bought AFTER the ex-date — no receipt.
    test_db.add(
        Transaction(
            portfolio_id=test_portfolio.id,
            company_id=test_company.id,
            sim_date=sim_today - timedelta(days=5),
            side="buy",
            quantity=10,
            price=100.0,
            fees=0.0,
            impact_applied=0.0,
        )
    )
    test_db.add(
        Dividend(
            company_id=test_company.id,
            timeline_id=1,
            declared_date=sim_today - timedelta(days=40),
            ex_date=sim_today - timedelta(days=10),
            payment_date=sim_today - timedelta(days=3),
            amount_per_share=0.5,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/portfolio/dividends", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["received"] == []


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------


def test_goal_crud_cycle(client, test_db, test_portfolio, auth_headers):
    create = client.post(
        "/api/v1/goals",
        json={"label": "House fund", "target_value": "200000", "target_date": "2027-01-01"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    goal = create.json()
    assert goal["label"] == "House fund"
    # Portfolio is 100k cash, target 200k -> 50%
    assert goal["progress_pct"] == pytest.approx(50.0)
    assert goal["achieved_at"] is None

    listed = client.get("/api/v1/goals", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.patch(
        f"/api/v1/goals/{goal['id']}",
        json={"target_value": "50000"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    # Target now below current value -> achieved, progress capped at 100.
    assert updated.json()["achieved_at"] is not None
    assert updated.json()["progress_pct"] == pytest.approx(100.0)

    deleted = client.delete(f"/api/v1/goals/{goal['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get("/api/v1/goals", headers=auth_headers).json() == []


def test_goal_validation(client, test_db, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/goals",
        json={"label": "", "target_value": "1000", "target_date": "2027-01-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    resp = client.post(
        "/api/v1/goals",
        json={"label": "x", "target_value": "-5", "target_date": "2027-01-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_goal_not_found(client, test_db, test_portfolio, auth_headers):
    assert client.delete("/api/v1/goals/999", headers=auth_headers).status_code == 404


# ---------------------------------------------------------------------------
# Named watchlists
# ---------------------------------------------------------------------------


def test_watchlist_groups_crud_and_reorder(client, test_db, test_company, auth_headers):
    # Legacy flat add creates the Default group implicitly.
    legacy = client.post("/api/v1/watchlist", json={"company_id": 1}, headers=auth_headers)
    assert legacy.status_code == 201

    groups = client.get("/api/v1/watchlists", headers=auth_headers).json()
    assert len(groups) == 1
    assert groups[0]["name"] == "Default"
    assert [i["company_id"] for i in groups[0]["items"]] == [1]

    created = client.post("/api/v1/watchlists", json={"name": "Tech"}, headers=auth_headers)
    assert created.status_code == 201
    tech_id = created.json()["id"]

    dup = client.post("/api/v1/watchlists", json={"name": "Tech"}, headers=auth_headers)
    assert dup.status_code == 409

    added = client.post(f"/api/v1/watchlists/{tech_id}/items", json={"company_id": 1}, headers=auth_headers)
    assert added.status_code == 201

    renamed = client.patch(f"/api/v1/watchlists/{tech_id}", json={"name": "Growth"}, headers=auth_headers)
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Growth"

    reordered = client.put(
        f"/api/v1/watchlists/{tech_id}/order", json={"company_ids": [1]}, headers=auth_headers
    )
    assert reordered.status_code == 200

    removed = client.delete(f"/api/v1/watchlists/{tech_id}/items/1", headers=auth_headers)
    assert removed.status_code == 204

    deleted = client.delete(f"/api/v1/watchlists/{tech_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert len(client.get("/api/v1/watchlists", headers=auth_headers).json()) == 1


def test_watchlist_group_ownership(client, test_db, test_company, auth_headers):
    assert client.delete("/api/v1/watchlists/999", headers=auth_headers).status_code == 404


# ---------------------------------------------------------------------------
# Transactions filters
# ---------------------------------------------------------------------------


def test_transactions_filters(client, test_db, test_portfolio, test_company, auth_headers):
    d = date(2026, 1, 1)
    for i, side in enumerate(["buy", "buy", "sell"]):
        test_db.add(
            Transaction(
                portfolio_id=test_portfolio.id,
                company_id=test_company.id,
                sim_date=d - timedelta(days=i * 10),
                side=side,
                quantity=5,
                price=100.0,
                fees=0.5,
                impact_applied=0.0,
            )
        )
    test_db.commit()

    all_rows = client.get("/api/v1/transactions", headers=auth_headers).json()
    assert len(all_rows) == 3
    assert "fees" in all_rows[0]

    sells = client.get("/api/v1/transactions?side=sell", headers=auth_headers).json()
    assert len(sells) == 1

    windowed = client.get(
        f"/api/v1/transactions?date_from={d - timedelta(days=5)}", headers=auth_headers
    ).json()
    assert len(windowed) == 1

    by_ticker = client.get("/api/v1/transactions?ticker=TST", headers=auth_headers).json()
    assert len(by_ticker) == 3
    assert client.get("/api/v1/transactions?ticker=NOPE", headers=auth_headers).json() == []
