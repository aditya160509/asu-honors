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
    assert len(body) == 1
    assert float(body[0]["close"]) == 102.0


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


def test_get_financials(client, test_db, test_company):
    from db.models import BalanceSheet, CashFlowStatement, IncomeStatement

    test_db.add(
        IncomeStatement(
            company_id=1, fiscal_period="2026Q1", revenue=1000000, cogs=600000, gross_profit=400000,
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


def test_get_valuation(client, test_db, test_company):
    test_db.add(
        CompanyFactorScore(
            company_id=1, fiscal_period="2026Q1", management_quality=50.0, moat_score=50.0,
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
    test_db.add(
        PriceHistory(
            timeline_id=1, company_id=1,
            sim_date=date(2026, 1, 1),
            open=100.0, high=105.0, low=99.0, close=100.0,
            volume=10000, intrinsic_value=100.0, order_imbalance=0.0,
        )
    )
    test_db.commit()
    resp = client.get("/api/v1/market")
    assert resp.status_code == 200
    company = resp.json()["companies"][0]
    assert company["prev_close"] is not None
    assert company["day_change_pct"] is not None


def test_get_company_detail_with_drivers_and_pe(client, test_db, test_company, test_timeline):
    from db.models import IncomeStatement, PriceDriverScore
    test_db.add(IncomeStatement(
        company_id=1, fiscal_period="2026Q1", revenue=1000000, cogs=600000,
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
    for d in [date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3)]:
        test_db.add(PriceHistory(
            timeline_id=1, company_id=1, sim_date=d,
            open=100.0, high=105.0, low=99.0, close=102.0,
            volume=10000, intrinsic_value=100.0, order_imbalance=0.0,
        ))
    test_db.commit()

    resp = client.get("/api/v1/companies/TST/history?from=2026-01-02")
    assert len(resp.json()) == 2

    resp = client.get("/api/v1/companies/TST/history?to=2026-01-02")
    assert len(resp.json()) == 2

    resp = client.get("/api/v1/companies/TST/history?from=2026-01-02&to=2026-01-02")
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


def test_get_financials_with_period(client, test_db, test_company):
    from db.models import IncomeStatement
    test_db.add(IncomeStatement(
        company_id=1, fiscal_period="2026Q1", revenue=1000000, cogs=600000,
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
