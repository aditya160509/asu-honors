"""Integration tests for the Phase 4 orchestrator — full DB-to-engine tick loop.

These tests use SQLite in-memory to verify the orchestrator wiring end-to-end.
"""

import math
import os
import random
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine, event as sa_event
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from db.models import (
    Base, Company, Industry, ConfigParameter, FactorDefinition,
    IndustryPillarWeight, MoatSubscore, CompanyFactorScore,
    IncomeStatement, BalanceSheet, CashFlowStatement, ConsensusEstimate,
    Timeline, SimulationState, PriceHistory, EventInstance, MarketEvent,
    NewsTemplate, NewsFeed,
)
from db.models.events import MarketEvent, NewsTemplate
from db.models.timeseries import EconomicCycleState, PriceDriverScore
from engine.ohlc import apply_circuit_breaker, synthesize_ohlc
from engine.cycle import advance_cycle_phase, compute_cycle_state, generate_sector_shocks
from engine.orchestrator import run_tick, run_ticks


@pytest.fixture
def session():
    from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

    engine = create_engine("sqlite:///:memory:", echo=False)

    SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

    @sa_event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    s = Session(engine)
    yield s
    s.close()
    engine.dispose()


def _execute_batch(session: Session, stmt: str, params: list | None = None):
    """Execute raw SQL to bypass ORM ordering issues with SQLite FKs."""
    session.execute(text(stmt), params or {})


def _seed_minimal(session: Session) -> int:
    """Seed just enough data to run one tick, using raw SQL for FK safety."""
    from sqlalchemy import text as sa_text

    session.execute(sa_text("""INSERT INTO industries (id, name, description, baseline_pe, pe_min, pe_max, base_volatility, cycle_sensitivity, sector_beta_default, subfactor_set, created_at, updated_at) VALUES (1, 'Test Industry', '', 15.0, 8.0, 25.0, 20.0, 1.0, 0.8, 'standard', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO companies (id, name, ticker, industry_id, shares_outstanding, free_float_pct, beta_market, beta_sector, current_price, intrinsic_value, intrinsic_score, fair_pe, market_cap, volatility, market_liquidity_score, created_at, updated_at) VALUES (1, 'Test Corp', 'TST', 1, 100000000, 0.8, 1.0, 0.5, 100.0, 100.0, 50.0, 15.0, 10000000000.0, 0.02, 80.0, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO factor_definitions (key, display_name, factor_type, pillar, direction, formula_ref, default_weight, created_at, updated_at) VALUES ('test_fq', 'Test FQ', 'fq_sub', 'profitability', 'higher_better', 'test', 1.0, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO industry_pillar_weights (industry_id, pillar, weight, created_at, updated_at) VALUES (1, 'profitability', 1.0, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO moat_subscores (company_id, subfactor_key, score, created_at, updated_at) VALUES (1, 'brand_strength', 70.0, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO company_factor_scores (company_id, fiscal_period, management_quality, moat_score, financial_quality, fcf_quality, growth_potential, intrinsic_score, fair_pe, intrinsic_value, computed_at, created_at, updated_at) VALUES (1, 'SEED', 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 15.0, 100.0, datetime('now'), datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO income_statements (company_id, fiscal_period, revenue, cogs, gross_profit, operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, tax, net_profit, eps, shares_diluted, created_at, updated_at) VALUES (1, '2026Q1', 1000000, 600000, 400000, 200000, 200000, 50000, 150000, 20000, 130000, 32500, 97500, 0.975, 100000000, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO balance_sheets (company_id, fiscal_period, cash_and_equivalents, receivables, inventory, current_assets, ppe, intangibles, total_assets, payables, short_term_debt, current_liabilities, long_term_debt, total_debt, total_liabilities, shareholders_equity, invested_capital, created_at, updated_at) VALUES (1, '2026Q1', 500000, 200000, 300000, 1000000, 2000000, 500000, 5000000, 150000, 100000, 250000, 500000, 600000, 1500000, 3500000, 4100000, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO cash_flow_statements (company_id, fiscal_period, operating_cash_flow, capex, free_cash_flow, investing_cash_flow, financing_cash_flow, dividends_paid, buybacks, net_change_in_cash, created_at, updated_at) VALUES (1, '2026Q1', 120000, -50000, 70000, -50000, -20000, -30000, -10000, 50000, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO consensus_estimates (company_id, fiscal_period, consensus_eps, consensus_revenue, created_at, updated_at) VALUES (1, '2026Q1', 0.95, 980000, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO timelines (id, name, rng_seed, is_live, created_at, updated_at) VALUES (1, 'Live Market', 42, 1, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO simulation_state (timeline_id, current_sim_date, tick_count, is_running, created_at, updated_at) VALUES (1, '2026-01-02', 0, 0, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('mean_reversion_rate', '0.05', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_min', '0.30', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_max', '5.00', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_k', '0.12', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_inflection', '60', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('r_cap', '0.20', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_vo', '0.20', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_es', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_ns', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_eo', '0.10', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_g', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_tm', '0.10', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_ib', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('k_m', '0.5', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('liquidity_sensitivity', '0.5', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('expected_annual_growth', '0.08', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('rho_es', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('rho_g', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('rho_news', '0.1', 'global', datetime('now'), datetime('now'))"""))
    session.commit()
    return 1


# ── Orchestrator Tests ─────────────────────────────────────────────────


def test_run_tick_basic(session):
    timeline_id = _seed_minimal(session)
    result = run_tick(session, timeline_id)
    session.commit()

    assert result["status"] == "completed"
    assert result["companies_updated"] == 1
    assert result["tick_count"] == 1
    assert isinstance(result["sim_date"], date)

    ph = session.query(PriceHistory).filter_by(timeline_id=timeline_id).first()
    assert ph is not None
    assert ph.close > 0
    assert ph.volume >= 1000
    assert ph.open > 0 and ph.high >= ph.low

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    assert sim_state.tick_count == 1
    assert sim_state.current_sim_date == date(2026, 1, 3)

    company = session.query(Company).filter_by(id=1).first()
    assert company.current_price is not None
    assert float(company.current_price) > 0


def test_run_tick_idempotent(session):
    timeline_id = _seed_minimal(session)
    r1 = run_tick(session, timeline_id)
    session.commit()

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim_state.current_sim_date = r1["sim_date"]
    sim_state.tick_count = r1["tick_count"] - 1
    session.commit()

    r2 = run_tick(session, timeline_id)
    session.commit()

    assert r1["status"] == "completed"
    assert r2["status"] == "skipped"

    prices = session.query(PriceHistory).filter_by(timeline_id=timeline_id).all()
    assert len(prices) == 1


def test_run_tick_writes_driver_scores(session):
    timeline_id = _seed_minimal(session)
    run_tick(session, timeline_id)
    session.commit()

    scores = session.query(PriceDriverScore).filter_by(timeline_id=timeline_id).all()
    assert len(scores) == 7  # 7 drivers
    for s in scores:
        assert s.value != 0 or s.weight >= 0
        assert s.contribution is not None


def test_run_tick_writes_economic_cycle(session):
    timeline_id = _seed_minimal(session)
    run_tick(session, timeline_id)
    session.commit()

    cycle = session.query(EconomicCycleState).filter_by(timeline_id=timeline_id).first()
    assert cycle is not None
    assert cycle.cycle_phase in ("expansion", "peak", "contraction", "trough")
    assert cycle.market_factor_return is not None


def test_run_ticks_multiple_days(session):
    timeline_id = _seed_minimal(session)
    results = run_ticks(session, timeline_id, num_ticks=5)
    session.commit()

    assert len(results) == 5
    assert all(r["status"] == "completed" for r in results)

    prices = session.query(PriceHistory).filter_by(timeline_id=timeline_id).order_by(PriceHistory.sim_date).all()
    assert len(prices) == 5
    dates = [p.sim_date for p in prices]
    assert dates == sorted(set(dates))
    assert len(dates) == 5

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    assert sim_state.tick_count == 5


def test_run_ticks_produces_varying_prices(session):
    timeline_id = _seed_minimal(session)
    results = run_ticks(session, timeline_id, num_ticks=10)
    session.commit()

    prices = session.query(PriceHistory).filter_by(
        timeline_id=timeline_id
    ).order_by(PriceHistory.sim_date).all()

    closes = [float(p.close) for p in prices]
    assert len(closes) == 10
    assert max(closes) != min(closes)


def test_run_tick_events_fired(session):
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=1, name="Test Event", category="test",
        scope="market", severity_range="(0.1, 0.3)",
        sentiment="neutral", effect_profile='{"value_opportunity": 0.1}',
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    session.commit()

    run_tick(session, timeline_id)
    session.commit()

    instances = session.query(EventInstance).filter_by(timeline_id=timeline_id).all()
    assert len(instances) >= 1


def test_run_tick_news_generated(session):
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=2, name="News Event", category="earnings",
        scope="company", severity_range="(0.1, 0.3)",
        sentiment="positive", effect_profile='{"value_opportunity": 0.1}',
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    nt = NewsTemplate(
        category="earnings", template_text="Breaking: Test Corp reports strong quarter",
        sentiment="positive", severity_band="low",
        linked_event_category="earnings", linked_driver="value_opportunity",
    )
    session.add(nt)
    session.commit()

    run_tick(session, timeline_id)
    session.commit()

    news = session.query(NewsFeed).filter_by(timeline_id=timeline_id).all()
    assert len(news) >= 1
    assert news[0].headline is not None


def test_circuit_breaker_limits_return():
    cb = apply_circuit_breaker(150.0, 100.0, r_cap=0.20)
    assert cb == 120.0

    cb2 = apply_circuit_breaker(50.0, 100.0, r_cap=0.20)
    assert cb2 == 80.0

    cb3 = apply_circuit_breaker(110.0, 100.0, r_cap=0.20)
    assert cb3 == 110.0


def test_circuit_breaker_price_floor():
    cb = apply_circuit_breaker(-5.0, 100.0, r_cap=0.20, p_min=0.01)
    assert cb == 80.0


def test_synthesize_ohlc_produces_valid_ohcl():
    rng = random.Random(42)
    ohlc = synthesize_ohlc(prev_close=100.0, current_close=101.5, rng=rng)
    assert ohlc["open"] > 0
    assert ohlc["high"] >= ohlc["low"]
    assert ohlc["high"] >= ohlc["close"]
    assert ohlc["low"] <= ohlc["open"]
    assert ohlc["close"] == 101.5


def test_advance_cycle_phase_valid():
    rng = random.Random(42)
    for _ in range(100):
        phase = advance_cycle_phase("expansion", rng)
        assert phase in ("expansion", "peak")


def test_compute_cycle_state_returns_all_keys():
    rng = random.Random(42)
    state = compute_cycle_state("expansion", rng)
    assert "market_factor_return" in state
    assert "gdp_growth" in state
    assert "interest_rate" in state
    assert "market_sentiment" in state
    assert isinstance(state["market_factor_return"], float)


def test_generate_sector_shocks_produces_variation():
    rng = random.Random(42)
    ind_ids = [1, 2, 3]
    sens_map = {1: 1.0, 2: 0.5, 3: 2.0}
    beta_map = {1: 0.8, 2: 1.0, 3: 1.2}
    shocks = generate_sector_shocks(ind_ids, sens_map, beta_map, 0.0004, rng)
    assert len(shocks) == 3
    assert all(isinstance(v, float) for v in shocks.values())


def test_run_tick_updates_company_denormalized(session):
    timeline_id = _seed_minimal(session)
    run_tick(session, timeline_id)
    session.commit()

    company = session.query(Company).filter_by(id=1).first()
    assert company.current_price is not None and float(company.current_price) > 0
    assert company.intrinsic_value is not None and float(company.intrinsic_value) > 0
    assert company.market_cap is not None and float(company.market_cap) > 0
    assert company.market_liquidity_score is not None


def test_run_tick_no_companies_raises(session):
    timeline_id = _seed_minimal(session)
    session.query(Company).delete()
    session.commit()

    with pytest.raises(ValueError, match="No companies with valid pricing data"):
        run_tick(session, timeline_id)
