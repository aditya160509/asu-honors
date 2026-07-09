"""Tests for /api/v1/leaderboard endpoint."""

from decimal import Decimal


def test_leaderboard_no_auth(client, test_db):
    resp = client.get("/api/v1/leaderboard/")
    assert resp.status_code == 200


def test_leaderboard_no_data(client, test_db):
    resp = client.get("/api/v1/leaderboard/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_leaderboard_single_user(client, test_db, test_user, test_portfolio):
    resp = client.get("/api/v1/leaderboard/")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["display_name"] == "Alice"
    assert body[0]["rank"] == 1
    assert float(body[0]["total_value"]) == 100_000.0
    assert float(body[0]["return_pct"]) == 0.0


def test_leaderboard_multiple_users(client, test_db, test_user, test_admin, test_portfolio):
    from db.models import Portfolio as Pf

    admin_pf = Pf(
        user_id=test_admin.id,
        timeline_id=test_portfolio.timeline_id,
        cash_balance=200_000.0,
        total_value=200_000.0,
    )
    test_db.add(admin_pf)
    test_db.commit()

    resp = client.get("/api/v1/leaderboard/")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["display_name"] == "Admin"
    assert body[0]["rank"] == 1
    assert float(body[0]["total_value"]) == 200_000.0
    assert body[1]["display_name"] == "Alice"
    assert body[1]["rank"] == 2


def test_leaderboard_with_holdings(client, test_db, test_user, test_portfolio, test_company, auth_headers):
    from db.models import Holding

    test_db.add(Holding(
        portfolio_id=test_portfolio.id,
        company_id=test_company.id,
        quantity=10,
        avg_cost_basis=90.0,
    ))
    test_db.commit()

    resp = client.get("/api/v1/leaderboard/")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    expected = Decimal("100000.0") + Decimal("10") * Decimal(str(test_company.current_price))
    assert float(body[0]["total_value"]) == float(expected)


def test_leaderboard_limit_offset(client, test_db, test_user, test_admin, test_portfolio):
    from db.models import Portfolio as Pf

    admin_pf = Pf(
        user_id=test_admin.id,
        timeline_id=test_portfolio.timeline_id,
        cash_balance=200_000.0,
        total_value=200_000.0,
    )
    test_db.add(admin_pf)
    test_db.commit()

    resp = client.get("/api/v1/leaderboard/?limit=1")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["display_name"] == "Admin"

    resp = client.get("/api/v1/leaderboard/?limit=10&offset=1")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["display_name"] == "Alice"


def test_leaderboard_timeline_filter(client, test_db, test_user, test_portfolio, test_timeline):
    from datetime import date
    from db.models import Portfolio as Pf, Timeline as Tl, SimulationState

    tl2 = Tl(id=2, name="Second Timeline", rng_seed=43, is_live=False)
    test_db.add(tl2)
    test_db.add(SimulationState(timeline_id=2, current_sim_date=date(2026, 1, 2), tick_count=0, is_running=False))
    test_db.commit()

    pf2 = Pf(
        user_id=test_user.id,
        timeline_id=2,
        cash_balance=50_000.0,
        total_value=50_000.0,
    )
    test_db.add(pf2)
    test_db.commit()

    resp = client.get("/api/v1/leaderboard/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = client.get("/api/v1/leaderboard/?timeline_id=2")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert float(body[0]["total_value"]) == 50_000.0
