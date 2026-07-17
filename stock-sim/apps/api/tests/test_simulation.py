"""Tests for /api/v1/sim endpoints."""

from datetime import date

from db.models import MoatSubscore, FactorDefinition, IndustryPillarWeight, MarketEvent, PriceHistory
from db.models.financials import BalanceSheet, CashFlowStatement, ConsensusEstimate, IncomeStatement


def _seed_tickable(test_db, test_company, test_timeline):
    """Add the extra rows engine.orchestrator.run_tick needs beyond company/timeline."""
    test_db.add(FactorDefinition(
        key="test_fq", display_name="Test FQ", factor_type="fq_sub",
        pillar="profitability", direction="higher_better", formula_ref="test", default_weight=1.0,
    ))
    test_db.add(IndustryPillarWeight(industry_id=1, pillar="profitability", weight=1.0))
    test_db.add(MoatSubscore(company_id=1, subfactor_key="brand_strength", score=70.0))
    test_db.add(IncomeStatement(
        company_id=1, fiscal_period="2026Q1", revenue=1000000, cogs=600000, gross_profit=400000,
        operating_expenses=200000, ebitda=200000, depreciation_amortization=50000, ebit=150000,
        interest_expense=20000, pretax_income=130000, tax=32500, net_profit=97500, eps=0.975,
        shares_diluted=100000000,
    ))
    test_db.add(BalanceSheet(
        company_id=1, fiscal_period="2026Q1", cash_and_equivalents=500000, receivables=200000,
        inventory=300000, current_assets=1000000, ppe=2000000, intangibles=500000, total_assets=5000000,
        payables=150000, short_term_debt=100000, current_liabilities=250000, long_term_debt=500000,
        total_debt=600000, total_liabilities=1500000, shareholders_equity=3500000, invested_capital=4100000,
    ))
    test_db.add(CashFlowStatement(
        company_id=1, fiscal_period="2026Q1", operating_cash_flow=120000, capex=-50000,
        free_cash_flow=70000, investing_cash_flow=-50000, financing_cash_flow=-20000,
        dividends_paid=-30000, buybacks=-10000, net_change_in_cash=50000,
    ))
    test_db.add(ConsensusEstimate(company_id=1, fiscal_period="2026Q1", consensus_eps=0.95, consensus_revenue=980000))
    test_db.commit()


def test_advance_ticks(client, test_db, test_company, test_timeline, base_config, auth_headers):
    _seed_tickable(test_db, test_company, test_timeline)

    resp = client.post("/api/v1/sim/advance", json={"timeline_id": 1, "days": 5}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ticks_executed"] == 5
    assert body["tick_count"] == 5


def test_advance_ticks_past_seeded_baseline_day(client, test_db, test_company, test_timeline, base_config, auth_headers):
    """Regression test for the seed/orchestrator deadlock: db/seeds/seed_initial_prices.py
    writes a PriceHistory row for SimulationState.current_sim_date as the day-0 baseline
    close (tick_count stays 0, since that's a seed, not a completed tick). Reproduce that
    here -- without the fix, run_ticks finds this row and treats current_sim_date as
    "already executed" on every call, so tick_count is permanently stuck at 0.
    """
    _seed_tickable(test_db, test_company, test_timeline)
    test_db.add(PriceHistory(
        timeline_id=1, company_id=test_company.id, sim_date=date(2026, 1, 2),
        open=10.0, high=10.5, low=9.5, close=10.0, volume=1000,
        intrinsic_value=10.0, order_imbalance=0.0,
    ))
    test_db.commit()

    resp = client.post("/api/v1/sim/advance", json={"timeline_id": 1, "days": 1}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ticks_executed"] == 1
    assert body["tick_count"] == 1


def test_advance_idempotent(client, test_db, test_company, test_timeline, base_config, auth_headers):
    _seed_tickable(test_db, test_company, test_timeline)

    client.post("/api/v1/sim/advance", json={"timeline_id": 1, "days": 2}, headers=auth_headers)

    from db.models import SimulationState

    sim_state = test_db.query(SimulationState).filter_by(timeline_id=1).first()
    # Rewind current_sim_date to a day that already has a PriceHistory row
    # (i.e. was already ticked) so the next run_tick call is a no-op skip.
    sim_state.current_sim_date = sim_state.current_sim_date - __import__("datetime").timedelta(days=1)
    sim_state.tick_count = sim_state.tick_count - 1
    test_db.commit()

    resp = client.post("/api/v1/sim/advance", json={"timeline_id": 1, "days": 1}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ticks_executed"] == 0


def test_get_sim_state(client, test_db, test_timeline, auth_headers):
    resp = client.get("/api/v1/sim/state", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["timeline_id"] == 1
    assert body["tick_count"] == 0


def test_create_timeline_branch(client, test_db, test_timeline, auth_headers):
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Branch A",
            "parent_timeline_id": 1,
            "branch_point_sim_date": "2026-01-02",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Branch A"
    assert body["is_live"] is False


def test_create_timeline_invalid_parent(client, test_db, auth_headers):
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Branch A",
            "parent_timeline_id": 999,
            "branch_point_sim_date": "2026-01-02",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_inject_event(client, test_db, test_timeline, admin_auth_headers):
    event = MarketEvent(
        name="Test Event", category="test", scope="market", severity_range="(0.1, 0.3)",
        sentiment="neutral", effect_profile={"value_opportunity": 0.1}, duration_days=5,
        decay_rate=0.1, probability_weight=1.0,
    )
    test_db.add(event)
    test_db.commit()
    test_db.refresh(event)

    resp = client.post(
        "/api/v1/sim/admin/events",
        json={"event_id": event.id, "timeline_id": 1, "scope_type": "market", "scope_ref": 0},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["event_id"] == event.id


def test_inject_event_not_admin(client, test_db, test_timeline, auth_headers):
    event = MarketEvent(
        name="Test Event", category="test", scope="market", severity_range="(0.1, 0.3)",
        sentiment="neutral", effect_profile={"value_opportunity": 0.1}, duration_days=5,
        decay_rate=0.1, probability_weight=1.0,
    )
    test_db.add(event)
    test_db.commit()
    test_db.refresh(event)

    resp = client.post(
        "/api/v1/sim/admin/events",
        json={"event_id": event.id, "timeline_id": 1, "scope_type": "market", "scope_ref": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 403


def test_update_config(client, test_db, admin_auth_headers):
    resp = client.put(
        "/api/v1/sim/admin/config",
        json={"key": "trade_fee_rate", "value": "0.002", "scope": "global"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["value"] == "0.002"


def test_get_config(client, test_db, base_config, admin_auth_headers):
    resp = client.get("/api/v1/sim/admin/config", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) > 0


def test_list_timelines(client, test_db, test_timeline, auth_headers):
    resp = client.get("/api/v1/sim/timelines", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    assert body[0]["name"] == "Live Market"


def test_create_timeline_no_parent_state(client, test_db, auth_headers):
    from db.models import Timeline
    parent = Timeline(id=10, name="Parent No State", rng_seed=42, is_live=True)
    test_db.add(parent)
    test_db.commit()
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Orphan Branch",
            "parent_timeline_id": 10,
            "branch_point_sim_date": "2026-01-02",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_create_timeline_with_overrides(client, test_db, test_timeline, auth_headers):
    resp = client.post(
        "/api/v1/sim/timelines",
        json={
            "name": "Branch With Overrides",
            "parent_timeline_id": 1,
            "branch_point_sim_date": "2026-01-02",
            "scenario_overrides": {},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Branch With Overrides"


def test_inject_event_not_found(client, test_db, test_timeline, admin_auth_headers):
    resp = client.post(
        "/api/v1/sim/admin/events",
        json={"event_id": 999, "timeline_id": 1, "scope_type": "market", "scope_ref": 0},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


def test_update_config_existing(client, test_db, base_config, admin_auth_headers):
    resp = client.put(
        "/api/v1/sim/admin/config",
        json={"key": "trade_fee_rate", "value": "0.002", "scope": "global"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["value"] == "0.002"


def test_get_state_timeline_not_found(client, test_db, auth_headers):
    resp = client.get("/api/v1/sim/state?timeline_id=999", headers=auth_headers)
    assert resp.status_code == 404


def test_list_config_with_scope_id(client, test_db, base_config, admin_auth_headers):
    from db.models import ConfigParameter

    test_db.add(ConfigParameter(key="test_param", value="test_value", scope="company", scope_id=42))
    test_db.commit()

    resp = client.get("/api/v1/sim/admin/config?scope=company&scope_id=42", headers=admin_auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert any(p["key"] == "test_param" for p in body)

    resp = client.get("/api/v1/sim/admin/config?scope=global&scope_id=999", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert all(p["key"] != "test_param" for p in resp.json())


def test_advance_invalid_days(client, test_db, test_timeline, auth_headers):
    resp = client.post(
        "/api/v1/sim/advance",
        json={"timeline_id": 1, "days": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 422
