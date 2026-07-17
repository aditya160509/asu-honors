"""Tests for /api/v1/portfolio, /api/v1/orders, /api/v1/watchlist endpoints."""

from decimal import Decimal

from db.models import Holding, Portfolio


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


# --- Phase 3: Trading Desk — order types, cancel, status lifecycle ---------


def test_place_limit_buy_order_does_not_cross(client, test_db, test_company, test_portfolio, auth_headers):
    """current_price is 100.0; a buy limit well below that shouldn't fill yet."""
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "order_type": "limit", "limit_price": 90.0, "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "open"
    assert body["order_type"] == "limit"
    assert body["price"] is None
    assert body["fees"] is None

    from db.models import Holding
    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert holding is None  # nothing executed yet

    portfolio_resp = client.get("/api/v1/portfolio", headers=auth_headers)
    assert float(portfolio_resp.json()["cash_balance"]) == 100_000.0  # untouched


def test_place_limit_buy_order_crosses_immediately(client, test_db, test_company, test_portfolio, auth_headers):
    """A buy limit at/above current_price (100.0) should fill right away."""
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "order_type": "limit", "limit_price": 105.0, "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "filled"
    assert body["price"] is not None
    assert float(body["price"]) <= 105.0  # never fills worse than the limit


def test_place_limit_sell_order_does_not_cross(client, test_db, test_company, test_portfolio, auth_headers):
    from db.models import Holding
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=1, quantity=10, avg_cost_basis=90.0))
    test_db.commit()

    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "sell", "order_type": "limit", "limit_price": 110.0, "quantity": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "open"

    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert float(holding.quantity) == 10  # untouched


def test_limit_order_missing_price_rejected(client, test_db, test_company, test_portfolio, auth_headers):
    resp = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "order_type": "limit", "quantity": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_cancel_open_order(client, test_db, test_company, test_portfolio, auth_headers):
    create = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "order_type": "limit", "limit_price": 90.0, "quantity": 10},
        headers=auth_headers,
    )
    order_id = create.json()["id"]

    resp = client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_cancel_filled_order_conflict(client, test_db, test_company, test_portfolio, auth_headers):
    create = client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "quantity": 10},
        headers=auth_headers,
    )
    order_id = create.json()["id"]  # market order — already filled

    resp = client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers)
    assert resp.status_code == 409


def test_cancel_order_not_found(client, test_db, auth_headers):
    resp = client.delete("/api/v1/orders/999", headers=auth_headers)
    assert resp.status_code == 404


def test_get_orders_status_filter(client, test_db, test_company, test_portfolio, auth_headers):
    client.post(
        "/api/v1/orders",
        json={"ticker": "TST", "side": "buy", "order_type": "limit", "limit_price": 90.0, "quantity": 10},
        headers=auth_headers,
    )
    client.post("/api/v1/orders", json={"ticker": "TST", "side": "buy", "quantity": 5}, headers=auth_headers)

    open_resp = client.get("/api/v1/orders?status=open", headers=auth_headers)
    assert open_resp.status_code == 200
    assert len(open_resp.json()) == 1
    assert open_resp.json()[0]["status"] == "open"

    filled_resp = client.get("/api/v1/orders?status=filled", headers=auth_headers)
    assert len(filled_resp.json()) == 1

    all_resp = client.get("/api/v1/orders", headers=auth_headers)
    assert len(all_resp.json()) == 2


def test_check_and_fill_limit_orders_fills_when_price_crosses(test_db, test_company, test_portfolio, test_user):
    """Unit-level test of the fill-on-advance hook, independent of the full
    simulation engine: place a non-crossing limit order, move current_price
    past the limit (simulating what a day-advance would do), and confirm
    check_and_fill_limit_orders fills it."""
    from apps.api.schemas import OrderRequest
    from apps.api.services.trade_service import check_and_fill_limit_orders, place_order

    place_order(
        test_db,
        test_user,
        OrderRequest(ticker="TST", side="buy", order_type="limit", limit_price=90.0, quantity=10, timeline_id=1),
    )
    test_db.commit()

    from db.models import Order
    order = test_db.query(Order).filter_by(portfolio_id=test_portfolio.id).first()
    assert order.status == "open"

    test_company.current_price = 88.0  # price now crosses the buy limit of 90
    test_db.commit()

    filled = check_and_fill_limit_orders(test_db, timeline_id=1)
    test_db.commit()
    assert filled == 1

    test_db.refresh(order)
    assert order.status == "filled"
    assert float(order.avg_fill_price) <= 90.0

    from db.models import Holding
    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert holding is not None
    assert float(holding.quantity) == 10


def test_many_trades_do_not_accumulate_float_rounding_drift(test_db, test_company, test_portfolio, test_user):
    """Regression test: Portfolio.cash_balance/Holding.avg_cost_basis/.quantity are
    Decimal-backed columns computed in Decimal throughout _execute_buy/_execute_sell,
    with no float(...) round-trip on write. Reconstruct the expected cash balance
    independently from each order's own recorded (Decimal) avg_fill_price/fees/
    quantity -- i.e. verify portfolio state is exactly internally consistent with
    its own transaction ledger after many trades, rather than re-deriving the
    Kyle-lambda impact pricing model."""
    from db.models import Order
    from apps.api.schemas import OrderRequest
    from apps.api.services.trade_service import place_order

    test_company.current_price = 33.33
    test_db.commit()

    starting_cash = Decimal(str(test_portfolio.cash_balance))
    expected_cash = starting_cash
    expected_qty = Decimal(0)

    for _ in range(25):
        resp = place_order(
            test_db, test_user,
            OrderRequest(ticker="TST", side="buy", order_type="market", quantity=7, timeline_id=1),
        )
        test_db.commit()
        order = test_db.query(Order).filter_by(id=resp.id).first()
        cost = Decimal(str(order.filled_quantity)) * Decimal(str(order.avg_fill_price))
        expected_cash -= cost + Decimal(str(order.fees))
        expected_qty += Decimal(str(order.filled_quantity))

    test_db.refresh(test_portfolio)
    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()

    # Compare to 4 decimal places (this app's money precision, matching
    # _compute_fees' quantize) rather than exact equality: SQLite's untyped
    # NUMERIC affinity (used by this in-memory test DB) can drop precision
    # below that on round-trip in a way Postgres's arbitrary-precision NUMERIC
    # (the real production column type) would not -- a test-storage-engine
    # artifact, unrelated to the float-rounding bug this test targets.
    cash_diff = abs(Decimal(str(test_portfolio.cash_balance)) - expected_cash)
    assert cash_diff < Decimal("0.0001"), f"cash_balance drifted by {cash_diff}"
    assert Decimal(str(holding.quantity)) == expected_qty


def test_execute_buy_writes_decimal_not_float(test_db, test_company, test_portfolio, test_user):
    """Regression test: assert the actual Python type written to Portfolio.cash_balance/
    Holding.quantity/.avg_cost_basis is Decimal, not float. A single float(...) round-trip
    only loses ~1e-12 relative precision -- far too small to show up as a cent-level
    assertion failure even after many trades (see the accumulation test above), so the
    only reliable way to catch a reintroduced float(...) cast is to check the type
    directly, not wait for drift to become visible."""
    from apps.api.services.trade_service import _execute_buy
    from db.models import Company

    company = test_db.query(Company).filter_by(id=1).first()
    _execute_buy(
        test_db, test_portfolio, None, company,
        quantity=10, price=Decimal("33.3300"), fees=Decimal("0.3333"),
    )
    test_db.flush()

    assert isinstance(test_portfolio.cash_balance, Decimal), (
        f"cash_balance is {type(test_portfolio.cash_balance).__name__}, expected Decimal -- "
        f"a float(...) cast was likely reintroduced in _execute_buy"
    )

    holding = test_db.query(Holding).filter_by(portfolio_id=test_portfolio.id, company_id=1).first()
    assert isinstance(holding.quantity, Decimal)
    assert isinstance(holding.avg_cost_basis, Decimal)
