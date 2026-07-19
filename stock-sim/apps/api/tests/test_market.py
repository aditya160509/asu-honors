"""Tests for /api/v1/market and /api/v1/companies endpoints."""

from datetime import date

from db.models import CompanyFactorScore, EconomicCycleState, MoatSubscore, PriceDriverScore, PriceHistory


def test_get_market_grid(client, test_db, test_company, test_timeline):
    resp = client.get("/api/v1/market")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["companies"]) == 1
    assert body["companies"][0]["ticker"] == "TST"


def test_get_market_grid_includes_sim_date(client, test_db, test_company, test_timeline):
    test_db.add(
        EconomicCycleState(
            timeline_id=1,
            sim_date=date(2026, 1, 2),
            cycle_phase="expansion",
            market_factor_return=0.01,
            gdp_growth=0.02,
            interest_rate=0.03,
            market_sentiment=0.1,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/market")
    assert resp.status_code == 200
    body = resp.json()
    assert body["sim_date"] == "2026-01-02"
    assert body["cycle_phase"] == "expansion"


def test_get_company_by_ticker(client, test_db, test_company):
    resp = client.get("/api/v1/companies/TST")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ticker"] == "TST"
    assert body["name"] == "Test Corp"


def test_get_company_not_found(client, test_db):
    resp = client.get("/api/v1/companies/NOPE")
    assert resp.status_code == 404


def test_get_price_history(client, test_db, test_company, test_timeline):
    test_db.add(
        PriceHistory(
            timeline_id=1,
            company_id=1,
            sim_date=date(2026, 1, 2),
            open=100.0,
            high=105.0,
            low=99.0,
            close=102.0,
            volume=10000,
            intrinsic_value=100.0,
            order_imbalance=0.0,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/companies/TST/history")
    assert resp.status_code == 200
    body = resp.json()
    # +1 for test_company's own 2026-01-01 baseline PriceHistory row; results
    # are ordered ascending by sim_date, so that baseline row comes first.
    assert len(body) == 2
    assert float(body[1]["close"]) == 102.0


def test_get_drivers(client, test_db, test_company, test_timeline):
    test_db.add(
        PriceDriverScore(
            timeline_id=1,
            company_id=1,
            sim_date=date(2026, 1, 2),
            driver_key="value_opportunity",
            value=0.1,
            weight=0.2,
            contribution=0.02,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/companies/TST/drivers")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["driver_key"] == "value_opportunity"


def test_get_financials(client, test_db, test_company, test_timeline):
    from db.models import BalanceSheet, CashFlowStatement, IncomeStatement

    test_db.add(
        IncomeStatement(
            company_id=1, timeline_id=test_timeline.id, fiscal_period="2026Q1", revenue=1000000, cogs=600000, gross_profit=400000,
            operating_expenses=200000, ebitda=200000, depreciation_amortization=50000, ebit=150000,
            interest_expense=20000, pretax_income=130000, tax=32500, net_profit=97500, eps=0.975,
            shares_diluted=100000000,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/companies/TST/financials")
    assert resp.status_code == 200
    body = resp.json()
    assert body["fiscal_period"] == "2026Q1"
    assert float(body["income_statement"]["revenue"]) == 1000000.0


def test_get_valuation(client, test_db, test_company, test_timeline):
    test_db.add(
        CompanyFactorScore(
            company_id=1, timeline_id=test_timeline.id, fiscal_period="2026Q1", management_quality=50.0, moat_score=50.0,
            financial_quality=50.0, fcf_quality=50.0, growth_potential=50.0, intrinsic_score=50.0,
            fair_pe=15.0, intrinsic_value=100.0,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/companies/TST/valuation")
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["fair_pe"]) == 15.0


def test_get_cycle_state(client, test_db, test_timeline):
    test_db.add(
        EconomicCycleState(
            timeline_id=1,
            sim_date=date(2026, 1, 2),
            cycle_phase="peak",
            market_factor_return=0.01,
            gdp_growth=0.02,
            interest_rate=0.03,
            market_sentiment=0.1,
        )
    )
    test_db.commit()

    resp = client.get("/api/v1/market/cycle")
    assert resp.status_code == 200
    body = resp.json()
    assert body["cycle_phase"] == "peak"


def test_get_market_grid_day_change(client, test_db, test_company, test_timeline):
    # get_market_grid's prev_close only reflects a genuine prior PriceHistory row
    # (no fallback to company.current_price for a single-day-old company) -- two
    # rows are required to exercise day-change calculation at all. test_company
    # already seeds a 2026-01-01 baseline row (close=100.0); add a second day here.
    test_db.add(
        PriceHistory(
            timeline_id=1, company_id=1,
            sim_date=date(2026, 1, 2),
            open=100.0, high=105.0, low=99.0, close=105.0,
            volume=10000, intrinsic_value=100.0, order_imbalance=0.0,
        )
    )
    test_db.commit()
    resp = client.get("/api/v1/market")
    assert resp.status_code == 200
    company = resp.json()["companies"][0]
    assert company["prev_close"] is not None
    assert company["day_change_pct"] is not None


def test_get_market_grid_single_price_row_has_no_prev_close(client, test_db, test_company, test_timeline):
    """A company with only one PriceHistory row (its first tick ever) has no
    real previous close to compare against -- prev_close/day_change_pct must
    be None, not fall back to comparing current_price against itself.

    test_company's fixture already seeds exactly one (2026-01-01) baseline
    row, so no additional row is added here.
    """
    resp = client.get("/api/v1/market")
    assert resp.status_code == 200
    company = resp.json()["companies"][0]
    assert company["prev_close"] is None
    assert company["day_change_pct"] is None


def test_get_company_detail_with_drivers_and_pe(client, test_db, test_company, test_timeline):
    from db.models import IncomeStatement, PriceDriverScore
    test_db.add(IncomeStatement(
        company_id=1, timeline_id=test_timeline.id, fiscal_period="2026Q1", revenue=1000000, cogs=600000,
        gross_profit=400000, operating_expenses=200000, ebitda=200000,
        depreciation_amortization=50000, ebit=150000, interest_expense=20000,
        pretax_income=130000, tax=32500, net_profit=97500, eps=0.975,
        shares_diluted=100000000,
    ))
    test_db.add(PriceDriverScore(
        timeline_id=1, company_id=1, sim_date=date(2026, 1, 2),
        driver_key="value_opportunity", value=0.1, weight=0.2, contribution=0.02,
    ))
    test_db.commit()
    resp = client.get("/api/v1/companies/TST")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["driver_breakdowns"]) == 1
    assert body["driver_breakdowns"][0]["driver_key"] == "value_opportunity"
    assert float(body["pe_ratio"]) == 100.0 / 0.975


def test_get_price_history_date_filters(client, test_db, test_company, test_timeline):
    # test_company already seeds a 2026-01-01 baseline PriceHistory row (see
    # conftest.py's test_company fixture) -- use later dates here to avoid
    # colliding with it on the (company_id, timeline_id, sim_date) unique
    # constraint.
    for d in [date(2026, 1, 2), date(2026, 1, 3), date(2026, 1, 4)]:
        test_db.add(PriceHistory(
            timeline_id=1, company_id=1, sim_date=d,
            open=100.0, high=105.0, low=99.0, close=102.0,
            volume=10000, intrinsic_value=100.0, order_imbalance=0.0,
        ))
    test_db.commit()

    resp = client.get("/api/v1/companies/TST/history?from=2026-01-03")
    assert len(resp.json()) == 2

    resp = client.get("/api/v1/companies/TST/history?to=2026-01-03")
    # +1 for the fixture's 2026-01-01 baseline row.
    assert len(resp.json()) == 3

    resp = client.get("/api/v1/companies/TST/history?from=2026-01-03&to=2026-01-03")
    assert len(resp.json()) == 1


def test_get_price_history_not_found(client, test_db):
    resp = client.get("/api/v1/companies/NOPE/history")
    assert resp.status_code == 404


def test_get_drivers_not_found(client, test_db):
    resp = client.get("/api/v1/companies/NOPE/drivers")
    assert resp.status_code == 404


def test_get_drivers_with_sim_date(client, test_db, test_company, test_timeline):
    test_db.add(PriceDriverScore(
        timeline_id=1, company_id=1, sim_date=date(2026, 1, 2),
        driver_key="value_opportunity", value=0.1, weight=0.2, contribution=0.02,
    ))
    test_db.commit()
    resp = client.get("/api/v1/companies/TST/drivers?sim_date=2026-01-02")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_drivers_empty_no_data(client, test_db, test_company, test_timeline):
    resp = client.get("/api/v1/companies/TST/drivers")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_financials_not_found_company(client, test_db):
    resp = client.get("/api/v1/companies/NOPE/financials")
    assert resp.status_code == 404


def test_get_financials_no_statements(client, test_db, test_company):
    resp = client.get("/api/v1/companies/TST/financials")
    assert resp.status_code == 404


def test_get_financials_with_period(client, test_db, test_company, test_timeline):
    from db.models import IncomeStatement
    test_db.add(IncomeStatement(
        company_id=1, timeline_id=test_timeline.id, fiscal_period="2026Q1", revenue=1000000, cogs=600000,
        gross_profit=400000, operating_expenses=200000, ebitda=200000,
        depreciation_amortization=50000, ebit=150000, interest_expense=20000,
        pretax_income=130000, tax=32500, net_profit=97500, eps=0.975,
        shares_diluted=100000000,
    ))
    test_db.commit()
    resp = client.get("/api/v1/companies/TST/financials?period=2026Q1")
    assert resp.status_code == 200
    assert resp.json()["fiscal_period"] == "2026Q1"


def test_get_valuation_not_found_company(client, test_db):
    resp = client.get("/api/v1/companies/NOPE/valuation")
    assert resp.status_code == 404


def test_get_valuation_no_data(client, test_db, test_company):
    resp = client.get("/api/v1/companies/TST/valuation")
    assert resp.status_code == 404


def test_get_cycle_state_not_found(client, test_db, test_timeline):
    resp = client.get("/api/v1/market/cycle")
    assert resp.status_code == 404
