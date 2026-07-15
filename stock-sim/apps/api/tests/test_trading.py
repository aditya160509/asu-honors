"""Tests for /api/v1/portfolio, /api/v1/orders, /api/v1/watchlist endpoints."""

from db.models import Holding


def test_get_portfolio_no_auth(client, test_db, test_portfolio):
    resp = client.get("/api/v1/portfolio")
    assert resp.status_code == 401


def test_get_portfolio_empty(client, test_db, test_portfolio, auth_headers):
    resp = client.get("/api/v1/portfolio", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["cash_balance"]) == 100_000.0
    assert body["holdings"] == []


def test_place_buy_order(client, test_db, test_company, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["side"] == "buy"
    assert body["quantity"] == 10

    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert holding is not None
    assert float(holding.quantity) == 10

    portfolio_resp = client.get("/api/v1/portfolio", headers=auth_headers)
    assert float(portfolio_resp.json()["cash_balance"]) < 100_000.0


def test_place_buy_insufficient_funds(client, test_db, test_company, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 100_000},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_place_sell_order(client, test_db, test_company, test_portfolio, auth_headers):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=1, quantity=20, avg_cost_basis=90.0))
    test_db.commit()

    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "sell", "quantity": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["side"] == "sell"
    assert body["realized_pnl"] is not None
    assert float(body["realized_pnl"]) > 0  # sold above avg cost basis of 90

    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert float(holding.quantity) == 15


def test_place_sell_no_holding(client, test_db, test_company, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "sell", "quantity": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_place_sell_excess_shares(client, test_db, test_company, test_portfolio, auth_headers):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=1, quantity=3, avg_cost_basis=90.0))
    test_db.commit()

    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "sell", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_order_price_impact(client, test_db, test_company, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 100_000},
        headers=auth_headers,
    )
    # insufficient funds at this size, so use a smaller size but still check impact vs current price
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 50},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert float(body["price"]) != 100.0  # current_price is 100.0; impact should move it


def test_get_transactions(client, test_db, test_company, test_portfolio, auth_headers):
    client.post("/api/v1/orders", json={"ticker": "TST", "side": "buy", "quantity": 5}, headers=auth_headers)
    client.post("/api/v1/orders", json={"ticker": "TST", "side": "buy", "quantity": 3}, headers=auth_headers)

    resp = client.get("/api/v1/transactions", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2


def test_watchlist_add(client, test_db, test_company, auth_headers):
    resp = client.post("/api/v1/watchlist", json={"company_id": 1}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["ticker"] == "TST"


def test_watchlist_delete(client, test_db, test_company, auth_headers):
    client.post("/api/v1/watchlist", json={"company_id": 1}, headers=auth_headers)
    resp = client.delete("/api/v1/watchlist/1", headers=auth_headers)
    assert resp.status_code == 204

    get_resp = client.get("/api/v1/watchlist", headers=auth_headers)
    assert get_resp.json() == []


def test_watchlist_duplicate_add(client, test_db, test_company, auth_headers):
    r1 = client.post("/api/v1/watchlist", json={"company_id": 1}, headers=auth_headers)
    assert r1.status_code == 201
    r2 = client.post("/api/v1/watchlist", json={"company_id": 1}, headers=auth_headers)
    assert r2.status_code == 409


def test_portfolio_analytics_no_auth(client, test_db, test_portfolio):
    resp = client.get("/api/v1/portfolio/analytics")
    assert resp.status_code == 401


def test_portfolio_analytics_empty(client, test_db, test_portfolio, auth_headers):
    resp = client.get("/api/v1/portfolio/analytics", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["cash_balance"]) == 100_000.0
    assert float(body["total_value"]) == 100_000.0
    assert body["num_positions"] == 0
    assert body["win_rate"] is None
    assert body["allocation_by_sector"] == []
    assert body["cash_allocation_pct"] == 100.0


def test_portfolio_analytics_with_holdings(client, test_db, test_portfolio, test_company, auth_headers):
    resp = client.post("/api/v1/orders", json={"ticker": "TST", "side": "buy", "quantity": 10}, headers=auth_headers)
    assert resp.status_code == 201

    resp = client.get("/api/v1/portfolio/analytics", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["num_positions"] == 1
    assert len(body["allocation_by_sector"]) >= 1
    assert body["cash_allocation_pct"] < 100.0
    assert body["unrealized_pnl"] is not None


def test_get_fee_rate_invalid_value(client, test_db, test_company, test_portfolio, auth_headers):
    from db.models import ConfigParameter
    test_db.add(ConfigParameter(key="trade_fee_rate", value="not_a_float", scope="global"))
    test_db.commit()
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 201


def test_place_order_no_sim_state(client, test_db, test_company, auth_headers, test_user, test_industry):
    from db.models import Portfolio, Timeline
    timeline = Timeline(id=2, name="No State Timeline", rng_seed=99, is_live=False)
    test_db.add(timeline)
    test_db.commit()
    portfolio = Portfolio(user_id=test_user.id, timeline_id=2, cash_balance=100_000.0, total_value=100_000.0)
    test_db.add(portfolio)
    test_db.commit()
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 10, "timeline_id": 2},
        headers=auth_headers,
    )
    assert resp.status_code == 201


def test_place_sell_all_shares(client, test_db, test_company, test_portfolio, auth_headers):
    from db.models import Holding
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=1, quantity=10, avg_cost_basis=90.0))
    test_db.commit()
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "sell", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert holding is None


def test_place_order_company_not_found(client, test_db, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "NOPE", "side": "buy", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_place_order_no_price(client, test_db, test_company, test_portfolio, auth_headers):
    from db.models import Company
    company = Company(
        id=2, name="No Price Co", ticker="NOPR", industry_id=1,
        shares_outstanding=100_000_000, free_float_pct=0.8,
        beta_market=1.0, beta_sector=0.5, current_price=None,
        intrinsic_value=100.0, intrinsic_score=50.0, fair_pe=15.0,
        market_cap=10_000_000_000.0, volatility=0.02,
    )
    test_db.add(company)
    test_db.commit()
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "NOPR", "side": "buy", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_place_order_no_portfolio(client, test_db, test_company, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 10, "timeline_id": 999},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_portfolio_analytics_not_found(client, test_db, test_portfolio, auth_headers):
    resp = client.get("/api/v1/portfolio/analytics?timeline_id=999", headers=auth_headers)
    assert resp.status_code == 404


def test_portfolio_analytics_holding_no_price(client, test_db, test_company, test_portfolio, auth_headers):
    from db.models import Company, Holding
    company2 = Company(
        id=2, name="No Price Co", ticker="NOPR", industry_id=1,
        shares_outstanding=100_000_000, free_float_pct=0.8,
        beta_market=1.0, beta_sector=0.5, current_price=None,
        intrinsic_value=100.0, intrinsic_score=50.0, fair_pe=15.0,
        market_cap=10_000_000_000.0, volatility=0.02,
    )
    test_db.add(company2)
    test_db.commit()
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=2, quantity=10, avg_cost_basis=90.0))
    test_db.commit()
    resp = client.get("/api/v1/portfolio/analytics", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["unrealized_pnl"]) == 0.0
    assert body["allocation_by_sector"] == []


def test_portfolio_analytics_with_sold_trades(client, test_db, test_company, test_portfolio, auth_headers):
    from db.models import Holding
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=1, quantity=10, avg_cost_basis=90.0))
    test_db.commit()
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "sell", "quantity": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    resp = client.get("/api/v1/portfolio/analytics", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["realized_pnl"]) > 0
    assert body["win_rate"] == 100.0


def test_get_portfolio_not_found(client, test_db, auth_headers):
    resp = client.get("/api/v1/portfolio?timeline_id=999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Portfolio not found"


def test_get_portfolio_orphan_holding(client, test_db, test_portfolio, auth_headers):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=999, quantity=5, avg_cost_basis=90.0))
    test_db.commit()

    resp = client.get("/api/v1/portfolio", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["cash_balance"]) == 100_000.0


def test_get_transactions_no_portfolio(client, test_db, auth_headers):
    resp = client.get("/api/v1/transactions?timeline_id=999", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_watchlist_orphan_entry(client, test_db, test_user, auth_headers):
    from db.models import Watchlist, WatchlistGroup
    group = WatchlistGroup(user_id=test_user.id, name="Default", sort_order=0)
    test_db.add(group)
    test_db.flush()
    test_db.add(Watchlist(user_id=test_user.id, company_id=999, group_id=group.id, sort_order=0))
    test_db.commit()

    resp = client.get("/api/v1/watchlist", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_watchlist_with_items(client, test_db, test_company, auth_headers):
    client.post("/api/v1/watchlist", json={"company_id": 1}, headers=auth_headers)
    resp = client.get("/api/v1/watchlist", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["ticker"] == "TST"
    assert body[0]["company_id"] == 1


def test_add_watchlist_company_not_found(client, test_db, auth_headers):
    resp = client.post(
        "/api/v1/watchlist",
        json={"company_id": 999},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_place_order_invalid_side(client, test_db, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "hold", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_place_order_invalid_quantity(client, test_db, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 422
