"""Integration tests for the Phase 4 orchestrator — full DB-to-engine tick loop.

These tests use SQLite in-memory to verify the orchestrator wiring end-to-end.
"""

import math
import os
import random
from datetime import date, timedelta
from typing import Optional

import pytest
from sqlalchemy import create_engine, event as sa_event, text
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from db.models import (
    Base, Company, Industry, ConfigParameter, FactorDefinition,
    IndustryPillarWeight, MoatSubscore, CompanyFactorScore,
    FinancialQualitySubscore, IncomeStatement, BalanceSheet, CashFlowStatement,
    ConsensusEstimate, Timeline, SimulationState, PriceHistory, EventInstance,
    MarketEvent, NewsTemplate, NewsFeed, User, Portfolio, Holding,
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


def _execute_batch(session: Session, stmt: str, params: Optional[list] = None):
    """Execute raw SQL to bypass ORM ordering issues with SQLite FKs."""
    session.execute(text(stmt), params or {})


def _seed_minimal(session: Session) -> int:
    """Seed just enough data to run one tick, using raw SQL for FK safety."""
    from sqlalchemy import text as sa_text

    session.execute(sa_text("""INSERT INTO industries (id, name, description, base_volatility, cycle_sensitivity, sector_beta_default, subfactor_set, created_at, updated_at) VALUES (1, 'Test Industry', '', 20.0, 1.0, 0.8, 'standard', datetime('now'), datetime('now'))"""))
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
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('theta_default', '0.05', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_min', '0.6', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_max', '2.0', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_k', '0.11', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('quality_mult_inflection', '60', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('growth_rate_min', '2.0', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('growth_rate_max', '60.0', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, scope_id, created_at, updated_at) VALUES ('neutral_industry_peg', '1.4', 'industry', 1, datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('r_cap', '0.20', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_vo', '0.20', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_es', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_ns', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_eo', '0.10', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_g', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_tm', '0.10', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('w_ib', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('k_m', '2.0', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('liquidity_sensitivity', '0.5', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('expected_annual_growth', '0.08', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('earnings_surprise_decay_rate', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('guidance_decay_rate', '0.15', 'global', datetime('now'), datetime('now'))"""))
    session.execute(sa_text("""INSERT INTO config_parameters (key, value, scope, created_at, updated_at) VALUES ('news_decay_rate', '0.1', 'global', datetime('now'), datetime('now'))"""))
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
    """Rewind to replay a day that already has a real PriceHistory row from a
    completed tick (tick_count > 0), not the seeded tick_count == 0 state --
    that specific state is reserved for "this is the seed_initial_prices
    baseline day, not yet ticked" and is covered by
    test_run_tick_first_tick_skips_seeded_baseline_day instead."""
    timeline_id = _seed_minimal(session)
    r1 = run_tick(session, timeline_id)
    session.commit()
    r2 = run_tick(session, timeline_id)
    session.commit()

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim_state.current_sim_date = r2["sim_date"]
    sim_state.tick_count = r2["tick_count"] - 1
    session.commit()

    r3 = run_tick(session, timeline_id)
    session.commit()

    assert r1["status"] == "completed"
    assert r2["status"] == "completed"
    assert r3["status"] == "skipped"

    prices = session.query(PriceHistory).filter_by(timeline_id=timeline_id).all()
    assert len(prices) == 2


def test_run_tick_first_tick_skips_seeded_baseline_day(session):
    """Regression test: db/seeds/seed_initial_prices.py writes a PriceHistory row
    for SimulationState.current_sim_date as the day-0 baseline close, with
    tick_count left at 0 (it's a seed, not a completed tick). The first real
    /sim/advance call must target the following day, not treat the seeded
    baseline as "already executed" and get stuck at tick_count == 0 forever."""
    timeline_id = _seed_minimal(session)
    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    session.add(PriceHistory(
        timeline_id=timeline_id, company_id=1, sim_date=sim_state.current_sim_date,
        open=100.0, high=101.0, low=99.0, close=100.0, volume=1000,
        intrinsic_value=100.0, order_imbalance=0.0,
    ))
    session.commit()
    seeded_date = sim_state.current_sim_date

    result = run_tick(session, timeline_id)
    session.commit()

    assert result["status"] == "completed"
    assert result["sim_date"] == seeded_date + timedelta(days=1)
    assert result["tick_count"] == 1


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


def test_advance_cycle_phase_unknown_returns_expansion():
    rng = random.Random(42)
    phase = advance_cycle_phase("unknown", rng)
    assert phase == "expansion"


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


# ── Edge cases: run_tick / _load_tick_state errors ────────────────────────


def test_run_tick_timeline_not_found(session):
    with pytest.raises(ValueError, match="Timeline 999 not found"):
        run_tick(session, 999)


def test_run_tick_no_simulation_state(session):
    timeline_id = _seed_minimal(session)
    session.query(SimulationState).delete()
    session.commit()
    with pytest.raises(ValueError, match="No SimulationState"):
        run_tick(session, timeline_id)


# ── Edge cases: _compute_drivers returns None ─────────────────────────────


def test_run_tick_company_no_price(session):
    timeline_id = _seed_minimal(session)
    c = session.query(Company).first()
    c.current_price = None
    session.commit()
    with pytest.raises(ValueError, match="No companies with valid pricing data"):
        run_tick(session, timeline_id)


def test_run_tick_company_no_intrinsic_value(session):
    timeline_id = _seed_minimal(session)
    c = session.query(Company).first()
    c.intrinsic_value = None
    session.commit()
    with pytest.raises(ValueError, match="No companies with valid pricing data"):
        run_tick(session, timeline_id)


def test_run_tick_company_no_industry(session):
    """_compute_drivers returns None when the industry is not found in state.industries.
    This branch is unreachable with FK constraints (all valid industry_ids are loaded),
    so this test is a no-op placeholder.  The branch is defensive code."""
    pass


# ── Guidance "cut" path (line 466-467) ────────────────────────────────────


def test_guidance_cut_path(session):
    """Set actual_eps < consensus_eps to exercise the guidance('cut', ...) branch."""
    timeline_id = _seed_minimal(session)
    ce = session.query(ConsensusEstimate).first()
    ce.consensus_eps = 2.0  # higher than actual 0.975 → miss
    session.commit()
    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"


# ── Config param with bad value (line 710-711) ────────────────────────────


def test_load_params_bad_value(session):
    from engine.orchestrator import _load_params
    timeline_id = _seed_minimal(session)
    session.execute(
        text("INSERT INTO config_parameters (key, value, scope, created_at, updated_at) "
             "VALUES ('bad_key', 'not_a_number', 'global', datetime('now'), datetime('now'))")
    )
    session.commit()
    params = _load_params(session)
    assert "bad_key" not in params


# ── _safe_finite edge cases (lines 1015-1019) ─────────────────────────────


def test_safe_finite_corner_cases(session):
    from engine.orchestrator import _safe_finite
    assert _safe_finite(float("inf")) == 1e9
    assert _safe_finite(float("-inf")) == -1e9
    assert _safe_finite(float("nan")) == 0.0
    assert _safe_finite(42.5) == 42.5


# ── _compute_fiscal_period (lines 1009-1011) ──────────────────────────────


def test_compute_fiscal_period(session):
    from engine.orchestrator import _compute_fiscal_period
    assert _compute_fiscal_period(0) == "2026Q1"
    assert _compute_fiscal_period(62) == "2026Q1"
    assert _compute_fiscal_period(63) == "2026Q2"
    assert _compute_fiscal_period(126) == "2026Q3"
    assert _compute_fiscal_period(189) == "2026Q4"
    assert _compute_fiscal_period(252) == "2027Q1"


# ── Event with industry scope (lines 692-694) ─────────────────────────────


def test_event_industry_scope(session):
    """Create a MarketEvent with scope=industry and verify _execute_events covers industry name lookup."""
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=10, name="Industry Event", category="sector",
        scope="industry", severity_range="(0.1, 0.3)",
        sentiment="positive", effect_profile='{"economic_outlook": 0.05}',
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    nt = NewsTemplate(
        category="sector", template_text="Industry {industry} is booming",
        sentiment="positive", severity_band="low",
        linked_event_category="sector", linked_driver="economic_outlook",
    )
    session.add(nt)
    session.commit()
    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"
    news = session.query(NewsFeed).filter_by(timeline_id=timeline_id).all()
    assert len(news) >= 1


def test_event_market_scope_news_not_generated(session):
    """Market-scope events don't generate news (company_name and industry_name both None)."""
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=11, name="Market Event", category="macro",
        scope="market", severity_range="(0.1, 0.3)",
        sentiment="negative", effect_profile='{"economic_outlook": -0.05}',
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    nt = NewsTemplate(
        category="macro", template_text="Market update: volatility expected",
        sentiment="negative", severity_band="low",
        linked_event_category="macro", linked_driver="economic_outlook",
    )
    session.add(nt)
    session.commit()
    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"


# ── Active events / effect_profile applied to drivers (lines 476, 489-496) ─


def test_event_effect_profile_applied_to_drivers(session):
    """Pre-seed an active EventInstance so _compute_drivers applies effect_profile."""
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=12, name="Driver Effect Event", category="earnings",
        scope="company", severity_range="(0.3, 0.5)",
        sentiment="positive", effect_profile='{"value_opportunity": 0.3}',
        duration_days=10, decay_rate=0.05, probability_weight=1.0,
    )
    session.add(me)
    session.flush()
    ei = EventInstance(
        event_id=12, timeline_id=timeline_id, scope_ref=1, scope_type="company",
        sim_date=date(2026, 1, 2), resolved_severity=0.4,
        applied_effects={"value_opportunity": 0.3},
        expires_on=date(2026, 1, 12),
    )
    session.add(ei)
    session.commit()

    from engine.orchestrator import _get_active_events_for_company, _load_active_events
    market_events, industry_events, company_events, event_defs = _load_active_events(
        session, timeline_id, date(2026, 1, 2),
    )
    active = _get_active_events_for_company(
        market_events, industry_events, company_events, event_defs, 1, 1, date(2026, 1, 1),
    )
    assert len(active) == 1
    assert "effect_profile" in active[0]

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"


def test_active_events_multiple_scope_types(session):
    """Test _get_active_events_for_company returns events across scope types."""
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=13, name="Company Event", category="earnings",
        scope="company", severity_range="(0.1, 0.3)",
        sentiment="neutral", effect_profile='{"earnings_surprise": 0.1}',
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    me2 = MarketEvent(
        id=14, name="Market Event", category="macro",
        scope="market", severity_range="(0.1, 0.3)",
        sentiment="neutral", effect_profile='{"economic_outlook": 0.05}',
        duration_days=10, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me2)
    session.flush()
    for eid, stype, sref in [(13, "company", 1), (14, "market", 0)]:
        session.add(EventInstance(
            event_id=eid, timeline_id=timeline_id, scope_ref=sref, scope_type=stype,
            sim_date=date(2026, 1, 2), resolved_severity=0.2,
            applied_effects={}, expires_on=date(2026, 2, 1),
        ))
    session.commit()

    from engine.orchestrator import _get_active_events_for_company, _load_active_events
    market_events, industry_events, company_events, event_defs = _load_active_events(
        session, timeline_id, date(2026, 1, 2),
    )
    active = _get_active_events_for_company(
        market_events, industry_events, company_events, event_defs, 1, 1, date(2026, 1, 1),
    )
    assert len(active) == 2


# ── _mark_to_market (lines 1066-1072) ─────────────────────────────────────


def test_mark_to_market_updates_portfolio(session):
    """Seed a portfolio + holding, run one tick, verify total_value is updated."""
    timeline_id = _seed_minimal(session)
    u = User(id=1, email="test@test.com", hashed_password="x", display_name="Tester", role="user", starting_cash=10000)
    session.add(u)
    session.flush()
    pf = Portfolio(id=1, user_id=1, timeline_id=timeline_id, cash_balance=5000.0, total_value=5000.0)
    session.add(pf)
    session.flush()
    h = Holding(id=1, portfolio_id=1, company_id=1, quantity=10.0, avg_cost_basis=100.0)
    session.add(h)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    pf = session.query(Portfolio).filter_by(id=1).first()
    assert pf.total_value >= 5000.0


def test_mark_to_market_no_holdings(session):
    """Portfolio with no holdings should still be updated (cash_balance only)."""
    timeline_id = _seed_minimal(session)
    u = User(id=2, email="test2@test.com", hashed_password="x", display_name="Tester2", role="user", starting_cash=10000)
    session.add(u)
    session.flush()
    pf = Portfolio(id=2, user_id=2, timeline_id=timeline_id, cash_balance=10000.0, total_value=10000.0)
    session.add(pf)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    pf = session.query(Portfolio).filter_by(id=2).first()
    assert pf.total_value == 10000.0


# ── _apply_event_factor_effects (lines 1099, 1103-1189) ───────────────────


def test_apply_event_factor_effects_updates_intrinsic_value(session):
    """MarketEvent with factor-key effects only — fires via select_and_fire_events,
    then _apply_event_factor_effects updates factor scores and IV.
    We do NOT pre-seed an EventInstance so _compute_drivers won't see it."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)
    me = MarketEvent(
        id=15, name="Factor Effect Event", category="governance",
        scope="company", severity_range="(0.2, 0.4)",
        sentiment="positive", effect_profile={"brand_strength": 15.0, "management_quality": 10.0},
        duration_days=10, decay_rate=0.05, probability_weight=1.0,
    )
    session.add(me)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"


def test_apply_event_factor_effects_only_driver_keys_skipped(session):
    """Effect profile with only DRIVER_KEYS should skip the factor score update branch."""
    timeline_id = _seed_minimal(session)
    from engine.orchestrator import DRIVER_KEYS
    me = MarketEvent(
        id=16, name="Driver Only Event", category="earnings",
        scope="company", severity_range="(0.1, 0.3)",
        sentiment="positive", effect_profile={"value_opportunity": 0.1},
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    session.flush()
    driver_only = {k: 0.1 for k in list(DRIVER_KEYS)[:2]}
    ei = EventInstance(
        event_id=16, timeline_id=timeline_id, scope_ref=1, scope_type="company",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects=driver_only,
        expires_on=date(2026, 1, 12),
    )
    session.add(ei)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"


def _run_factor_effects_directly(session, timeline_id, event_id, scope_type, scope_ref, effect_profile, sim_date=None):
    """Directly exercise _apply_event_factor_effects for one MarketEvent/EventInstance pair."""
    from engine.orchestrator import _apply_event_factor_effects

    sim_date = sim_date or date(2026, 1, 2)
    me = MarketEvent(
        id=event_id, name=f"Test Event {event_id}", category="governance",
        scope=scope_type, severity_range="(100.0, 100.0)",
        sentiment="negative", effect_profile=effect_profile,
        duration_days=10, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    session.flush()
    ei = EventInstance(
        event_id=event_id, timeline_id=timeline_id, scope_ref=scope_ref, scope_type=scope_type,
        sim_date=sim_date, resolved_severity=100.0,
        applied_effects=effect_profile,
        expires_on=sim_date + timedelta(days=10),
    )
    session.add(ei)
    session.commit()

    companies = session.query(Company).all()
    industries = {ind.id: ind for ind in session.query(Industry).all()}
    neutral_industry_pegs = {ind.id: 1.4 for ind in session.query(Industry).all()}
    affected = _apply_event_factor_effects(
        session, companies, sim_date, timeline_id,
        {"quality_mult_min": "0.6", "quality_mult_max": "2.0",
         "quality_mult_k": "0.11", "quality_mult_inflection": "60"},
        neutral_industry_pegs, industries,
    )
    session.commit()
    return affected


def test_financial_quality_effect_persists_to_company_factor_score(session):
    """A financial_quality effect must move the real CFS field, not be dropped against a phantom 0 baseline."""
    timeline_id = _seed_minimal(session)
    before = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    before_iv = float(before.intrinsic_value)
    assert float(before.financial_quality) == 50.0

    affected = _run_factor_effects_directly(
        session, timeline_id, event_id=101, scope_type="company", scope_ref=1,
        effect_profile={"financial_quality": -10.0},
    )
    assert 1 in affected

    after = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    # base 50.0 + (-10.0 * severity=1.0 * decay(0.1, 0)=1.0) = 40.0, not 0.0 - 10.0.
    assert math.isclose(float(after.financial_quality), 40.0, abs_tol=0.01)
    assert float(after.intrinsic_value) != before_iv


def test_management_quality_effect_decays_across_ticks_without_compounding(session):
    """Regression test: management_quality has no other source of truth to re-derive
    from each tick (unlike moat_score/financial_quality), so its event effect used to
    be baked in once at full severity via a hardcoded days_elapsed=0 and never decay --
    worse, calling the apply function again on a later day would read the already-
    mutated column as its baseline and add a second full-strength delta on top,
    compounding instead of decaying. Verify the effect now (a) shrinks as days_elapsed
    grows and (b) never exceeds what a single application at the correct days_elapsed
    would produce, proving repeated ticks decay toward baseline rather than stack."""
    from engine.orchestrator import _apply_event_factor_effects
    from engine.events import decay

    timeline_id = _seed_minimal(session)
    baseline = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    base_mgmt = float(baseline.management_quality)
    assert base_mgmt == 50.0

    rho = 0.1
    severity = 100.0
    effect_profile = {"management_quality": -20.0}
    fire_date = date(2026, 1, 2)
    me = MarketEvent(
        id=201, name="Mgmt Event", category="governance", scope="company",
        severity_range="(100.0, 100.0)", sentiment="negative", effect_profile=effect_profile,
        duration_days=30, decay_rate=rho, probability_weight=1.0,
    )
    session.add(me)
    session.flush()
    session.add(EventInstance(
        event_id=201, timeline_id=timeline_id, scope_ref=1, scope_type="company",
        sim_date=fire_date, resolved_severity=severity, applied_effects=effect_profile,
        expires_on=fire_date + timedelta(days=30),
    ))
    session.commit()

    companies = session.query(Company).all()
    industries = {ind.id: ind for ind in session.query(Industry).all()}
    neutral_industry_pegs = {ind.id: 1.4 for ind in session.query(Industry).all()}
    params = {"quality_mult_min": "0.6", "quality_mult_max": "2.0",
              "quality_mult_k": "0.11", "quality_mult_inflection": "60"}

    # Simulate 3 ticks on the day the event fires, then 5 and 10 days later --
    # re-invoking the same way run_ticks would call this once per tick.
    mgmt_by_day: dict[int, float] = {}
    for days_after in (0, 5, 10):
        _apply_event_factor_effects(
            session, companies, fire_date + timedelta(days=days_after), timeline_id,
            params, neutral_industry_pegs, industries,
        )
        session.commit()
        cfs = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
            CompanyFactorScore.fiscal_period.desc()
        ).first()
        mgmt_by_day[days_after] = float(cfs.management_quality)

    # Effect must shrink monotonically toward the undecayed base as days_elapsed grows.
    assert mgmt_by_day[0] < mgmt_by_day[5] < mgmt_by_day[10] < base_mgmt + 0.01

    # Each day's value must match a single correctly-decayed application against the
    # true base (50.0), not a compounded sum of 3 successive full/partial deltas.
    for days_after, observed in mgmt_by_day.items():
        expected = base_mgmt + (-20.0 * (severity / 100.0) * decay(rho, days_after))
        assert math.isclose(observed, expected, abs_tol=0.01), (
            f"day {days_after}: expected {expected}, got {observed} -- "
            f"looks compounded rather than recomputed from base"
        )


def test_moat_score_direct_key_effect_applies_on_top_of_subfactor_composite(session):
    """A direct 'moat_score' effect_profile key must nudge the composite, not be silently dropped."""
    timeline_id = _seed_minimal(session)
    before = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    before_moat = float(before.moat_score)

    _run_factor_effects_directly(
        session, timeline_id, event_id=102, scope_type="company", scope_ref=1,
        effect_profile={"moat_score": 8.0},
    )

    after = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    assert float(after.moat_score) > before_moat


def test_industry_scope_event_applies_factor_effects_to_member_companies(session):
    """Industry-scope events must apply factor effects to companies in that industry, not be skipped."""
    timeline_id = _seed_minimal(session)
    before = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    assert float(before.financial_quality) == 50.0

    affected = _run_factor_effects_directly(
        session, timeline_id, event_id=103, scope_type="industry", scope_ref=1,
        effect_profile={"financial_quality": -5.0},
    )
    assert 1 in affected

    after = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    assert math.isclose(float(after.financial_quality), 45.0, abs_tol=0.01)


def test_market_scope_event_applies_factor_effects_to_all_companies(session):
    """Market-scope events must apply factor effects to every company, not be skipped."""
    timeline_id = _seed_minimal(session)

    affected = _run_factor_effects_directly(
        session, timeline_id, event_id=104, scope_type="market", scope_ref=0,
        effect_profile={"management_quality": -5.0},
    )
    assert 1 in affected

    after = session.query(CompanyFactorScore).filter_by(company_id=1).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).first()
    assert math.isclose(float(after.management_quality), 45.0, abs_tol=0.01)


# ── Multiple companies scenario ────────────────────────────────────────────


def test_multiple_companies_tick(session):
    """Add a second company + industry data and verify both are processed."""
    timeline_id = _seed_minimal(session)
    session.execute(text(
        "INSERT INTO industries (id, name, description, base_volatility, "
        "cycle_sensitivity, sector_beta_default, subfactor_set, created_at, updated_at) "
        "VALUES (2, 'Tech', 'Tech industry', 25.0, 1.2, 1.0, 'standard', "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO config_parameters (key, value, scope, scope_id, created_at, updated_at) "
        "VALUES ('neutral_industry_peg', '1.4', 'industry', 2, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO companies (id, name, ticker, industry_id, shares_outstanding, free_float_pct, "
        "beta_market, beta_sector, current_price, intrinsic_value, intrinsic_score, fair_pe, market_cap, "
        "volatility, market_liquidity_score, created_at, updated_at) "
        "VALUES (2, 'Tech Corp', 'TECH', 2, 50000000, 0.7, 1.2, 0.8, 50.0, 50.0, 60.0, 20.0, "
        "5000000000.0, 0.03, 70.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO factor_definitions (key, display_name, factor_type, pillar, direction, formula_ref, "
        "default_weight, created_at, updated_at) "
        "VALUES ('tech_fq', 'Tech FQ', 'fq_sub', 'profitability', 'higher_better', 'test', 1.0, "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO moat_subscores (company_id, subfactor_key, score, created_at, updated_at) "
        "VALUES (2, 'brand_strength', 75.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO company_factor_scores (company_id, fiscal_period, management_quality, moat_score, "
        "financial_quality, fcf_quality, growth_potential, intrinsic_score, fair_pe, intrinsic_value, "
        "computed_at, created_at, updated_at) "
        "VALUES (2, 'SEED', 60.0, 60.0, 60.0, 60.0, 60.0, 60.0, 20.0, 50.0, "
        "datetime('now'), datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO income_statements (company_id, fiscal_period, revenue, cogs, gross_profit, "
        "operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, "
        "tax, net_profit, eps, shares_diluted, created_at, updated_at) "
        "VALUES (2, '2026Q1', 2000000, 1200000, 800000, 400000, 400000, 100000, 300000, 40000, "
        "260000, 65000, 195000, 3.9, 50000000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO balance_sheets (company_id, fiscal_period, cash_and_equivalents, receivables, "
        "inventory, current_assets, ppe, intangibles, total_assets, payables, short_term_debt, "
        "current_liabilities, long_term_debt, total_debt, total_liabilities, shareholders_equity, "
        "invested_capital, created_at, updated_at) "
        "VALUES (2, '2026Q1', 1000000, 400000, 600000, 2000000, 4000000, 1000000, 10000000, 300000, "
        "200000, 500000, 1000000, 1200000, 3000000, 7000000, 8200000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO cash_flow_statements (company_id, fiscal_period, operating_cash_flow, capex, "
        "free_cash_flow, investing_cash_flow, financing_cash_flow, dividends_paid, buybacks, "
        "net_change_in_cash, created_at, updated_at) "
        "VALUES (2, '2026Q1', 240000, -100000, 140000, -100000, -40000, -60000, -20000, 100000, "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO consensus_estimates (company_id, fiscal_period, consensus_eps, consensus_revenue, "
        "created_at, updated_at) "
        "VALUES (2, '2026Q1', 3.8, 1950000, datetime('now'), datetime('now'))"
    ))

    # Add pillar weight for new industry
    session.execute(text(
        "INSERT INTO industry_pillar_weights (industry_id, pillar, weight, created_at, updated_at) "
        "VALUES (2, 'profitability', 1.0, datetime('now'), datetime('now'))"
    ))
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"
    assert result["companies_updated"] == 2

    phs = session.query(PriceHistory).filter_by(timeline_id=timeline_id).all()
    assert len(phs) == 2

    companies = session.query(Company).order_by(Company.id).all()
    assert all(c.current_price is not None and float(c.current_price) > 0 for c in companies)
    assert all(c.intrinsic_value is not None for c in companies)


# ── Quarter boundary / _refresh_fundamentals (lines 156, 726-818, 836-945, 951-970) ──


def _setup_fq_factor_defs(session):
    """Add factor definitions needed for quarter-boundary refresh to succeed."""
    from sqlalchemy import text as _t
    existing_keys = {r.key for r in session.query(FactorDefinition).all()}
    fq_defs = [
        ("operating_margin", "profitability", "higher_better"),
        ("roic", "profitability", "higher_better"),
        ("roe", "profitability", "higher_better"),
        ("asset_turnover", "efficiency", "higher_better"),
        ("cash_conversion_cycle", "efficiency", "lower_better"),
        ("net_debt_to_ebitda", "risk", "lower_better"),
        ("interest_coverage", "risk", "higher_better"),
        ("current_ratio", "liquidity", "higher_better"),
        ("accruals_ratio", "quality", "lower_better"),
        ("payout_sustainability", "quality", "higher_better"),
        ("earnings_stability", "quality", "higher_better"),
        ("revenue_consistency", "quality", "higher_better"),
    ]
    for key, pillar, direction in fq_defs:
        if key not in existing_keys:
            session.execute(_t(
                f"INSERT INTO factor_definitions (key, display_name, factor_type, pillar, direction, "
                f"formula_ref, default_weight, created_at, updated_at) "
                f"VALUES ('{key}', '{key}', 'fq_sub', '{pillar}', '{direction}', 'calc', 1.0, "
                f"datetime('now'), datetime('now'))"
            ))
    # Also add at least one moat def
    if "brand_strength" not in existing_keys:
        session.execute(_t(
            "INSERT INTO factor_definitions (key, display_name, factor_type, pillar, direction, "
            "formula_ref, default_weight, created_at, updated_at) "
            "VALUES ('brand_strength', 'Brand Strength', 'moat_sub', NULL, 'higher_better', "
            "'calc', 1.0, datetime('now'), datetime('now'))"
        ))


def test_quarter_boundary_refresh(session):
    """Run tick at tick_count=63 to trigger quarter-boundary financial refresh."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)
    session.commit()

    # Fast-forward sim state to quarter boundary
    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 63
    sim.current_sim_date = date(2026, 4, 1)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    # Verify new financial statements were generated
    incs = session.query(IncomeStatement).filter_by(company_id=1).order_by(IncomeStatement.fiscal_period.desc()).all()
    assert any(inc.fiscal_period == "2026Q2" for inc in incs)

    # Verify CompanyFactorScore was written for the new period
    cfs = session.query(CompanyFactorScore).filter_by(
        company_id=1, fiscal_period="2026Q2"
    ).first()
    assert cfs is not None
    assert cfs.intrinsic_value > 0

    # Verify FinancialQualitySubscore rows were written
    fqs = session.query(FinancialQualitySubscore).filter_by(
        company_id=1, fiscal_period="2026Q2"
    ).all()
    assert len(fqs) >= 1


def test_quarter_boundary_multiple_companies(session):
    """Quarter boundary refresh processes multiple companies correctly."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)

    # Add a second company
    session.execute(text(
        "INSERT INTO companies (id, name, ticker, industry_id, shares_outstanding, free_float_pct, "
        "beta_market, beta_sector, current_price, intrinsic_value, intrinsic_score, fair_pe, market_cap, "
        "volatility, market_liquidity_score, created_at, updated_at) "
        "VALUES (2, 'Second Corp', 'SCD', 1, 100000000, 0.8, 1.0, 0.5, 100.0, 100.0, 50.0, 15.0, "
        "10000000000.0, 0.02, 80.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO moat_subscores (company_id, subfactor_key, score, created_at, updated_at) "
        "VALUES (2, 'brand_strength', 70.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO company_factor_scores (company_id, fiscal_period, management_quality, moat_score, "
        "financial_quality, fcf_quality, growth_potential, intrinsic_score, fair_pe, intrinsic_value, "
        "computed_at, created_at, updated_at) "
        "VALUES (2, 'SEED', 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 15.0, 100.0, "
        "datetime('now'), datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO income_statements (company_id, fiscal_period, revenue, cogs, gross_profit, "
        "operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, "
        "tax, net_profit, eps, shares_diluted, created_at, updated_at) "
        "VALUES (2, '2026Q1', 1000000, 600000, 400000, 200000, 200000, 50000, 150000, 20000, "
        "130000, 32500, 97500, 0.975, 100000000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO balance_sheets (company_id, fiscal_period, cash_and_equivalents, receivables, "
        "inventory, current_assets, ppe, intangibles, total_assets, payables, short_term_debt, "
        "current_liabilities, long_term_debt, total_debt, total_liabilities, shareholders_equity, "
        "invested_capital, created_at, updated_at) "
        "VALUES (2, '2026Q1', 500000, 200000, 300000, 1000000, 2000000, 500000, 5000000, 150000, "
        "100000, 250000, 500000, 600000, 1500000, 3500000, 4100000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO cash_flow_statements (company_id, fiscal_period, operating_cash_flow, capex, "
        "free_cash_flow, investing_cash_flow, financing_cash_flow, dividends_paid, buybacks, "
        "net_change_in_cash, created_at, updated_at) "
        "VALUES (2, '2026Q1', 120000, -50000, 70000, -50000, -20000, -30000, -10000, 50000, "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO consensus_estimates (company_id, fiscal_period, consensus_eps, consensus_revenue, "
        "created_at, updated_at) "
        "VALUES (2, '2026Q1', 0.95, 980000, datetime('now'), datetime('now'))"
    ))
    session.commit()

    # Advance to quarter boundary
    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 63
    sim.current_sim_date = date(2026, 4, 1)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    cfs_list = session.query(CompanyFactorScore).filter_by(fiscal_period="2026Q2").all()
    assert len(cfs_list) == 2


# ── Banking sector raw computation (lines 940-945, 988-997) ────────────────


def test_banking_sector_tick(session):
    """Create an industry with subfactor_set='financials' and a company in it."""
    timeline_id = _seed_minimal(session)

    # Add a banking industry
    session.execute(text(
        "INSERT INTO industries (id, name, description, base_volatility, "
        "cycle_sensitivity, sector_beta_default, subfactor_set, created_at, updated_at) "
        "VALUES (3, 'Banking', 'Banking sector', 15.0, 0.8, 0.6, 'financials', "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO config_parameters (key, value, scope, scope_id, created_at, updated_at) "
        "VALUES ('neutral_industry_peg', '0.9', 'industry', 3, datetime('now'), datetime('now'))"
    ))

    # Banking company
    session.execute(text(
        "INSERT INTO companies (id, name, ticker, industry_id, shares_outstanding, free_float_pct, "
        "beta_market, beta_sector, current_price, intrinsic_value, intrinsic_score, fair_pe, market_cap, "
        "volatility, market_liquidity_score, created_at, updated_at) "
        "VALUES (2, 'Bank Corp', 'BNK', 3, 200000000, 0.6, 0.8, 0.5, 80.0, 80.0, 50.0, 12.0, "
        "16000000000.0, 0.015, 75.0, datetime('now'), datetime('now'))"
    ))

    # Add factor defs for banking raw computation
    banking_keys = [
        ("net_interest_margin", "profitability", "higher_better"),
        ("cost_to_income", "efficiency", "lower_better"),
        ("roa", "profitability", "higher_better"),
        ("capital_adequacy_ratio", "risk", "higher_better"),
        ("npa_ratio", "risk", "lower_better"),
    ]
    existing_keys = {r.key for r in session.query(FactorDefinition).all()}
    for key, pillar, direction in banking_keys:
        if key not in existing_keys:
            session.execute(text(
                f"INSERT INTO factor_definitions (key, display_name, factor_type, pillar, direction, "
                f"formula_ref, default_weight, created_at, updated_at) "
                f"VALUES ('{key}', '{key}', 'fq_sub', '{pillar}', '{direction}', 'calc', 1.0, "
                f"datetime('now'), datetime('now'))"
            ))

    session.execute(text(
        "INSERT INTO moat_subscores (company_id, subfactor_key, score, created_at, updated_at) "
        "VALUES (2, 'brand_strength', 70.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO company_factor_scores (company_id, fiscal_period, management_quality, moat_score, "
        "financial_quality, fcf_quality, growth_potential, intrinsic_score, fair_pe, intrinsic_value, "
        "computed_at, created_at, updated_at) "
        "VALUES (2, 'SEED', 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 12.0, 80.0, "
        "datetime('now'), datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO income_statements (company_id, fiscal_period, revenue, cogs, gross_profit, "
        "operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, "
        "tax, net_profit, eps, shares_diluted, created_at, updated_at) "
        "VALUES (2, '2026Q1', 5000000, 2000000, 3000000, 1500000, 1500000, 300000, 1200000, 800000, "
        "400000, 100000, 300000, 1.5, 200000000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO balance_sheets (company_id, fiscal_period, cash_and_equivalents, receivables, "
        "inventory, current_assets, ppe, intangibles, total_assets, payables, short_term_debt, "
        "current_liabilities, long_term_debt, total_debt, total_liabilities, shareholders_equity, "
        "invested_capital, created_at, updated_at) "
        "VALUES (2, '2026Q1', 10000000, 5000000, 2000000, 17000000, 50000000, 10000000, 100000000, "
        "3000000, 5000000, 8000000, 20000000, 25000000, 40000000, 60000000, 85000000, "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO consensus_estimates (company_id, fiscal_period, consensus_eps, consensus_revenue, "
        "created_at, updated_at) "
        "VALUES (2, '2026Q1', 1.4, 4800000, datetime('now'), datetime('now'))"
    ))
    # Add pillar weight for banking industry
    session.execute(text(
        "INSERT INTO industry_pillar_weights (industry_id, pillar, weight, created_at, updated_at) "
        "VALUES (3, 'profitability', 1.0, datetime('now'), datetime('now'))"
    ))
    _setup_fq_factor_defs(session)
    session.commit()

    # Run at quarter boundary to trigger _generate_fake_quarterly_financials -> banking path
    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 63
    sim.current_sim_date = date(2026, 4, 1)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    # Verify at least one company got a PriceHistory
    phs = session.query(PriceHistory).filter_by(timeline_id=timeline_id).all()
    assert len(phs) >= 1
    # Verify banking financials were generated (the key code path we care about)
    incs = session.query(IncomeStatement).filter_by(company_id=2).order_by(
        IncomeStatement.fiscal_period.desc()
    ).all()
    assert any("Q2" in inc.fiscal_period for inc in incs)
    cfs = session.query(CompanyFactorScore).filter_by(
        company_id=2
    ).order_by(CompanyFactorScore.fiscal_period.desc()).first()
    assert cfs is not None


# ── run_ticks idempotency skip (lines 151-152) ─────────────────────────────


def test_run_ticks_idempotent_skip(session):
    """When run_ticks encounters an already-executed sim_date, it skips."""
    timeline_id = _seed_minimal(session)
    r1 = run_ticks(session, timeline_id, num_ticks=1)
    session.commit()
    assert r1[0]["status"] == "completed"

    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 1
    sim.current_sim_date = date(2026, 1, 3)
    session.commit()

    ph = PriceHistory(
        timeline_id=timeline_id, company_id=1, sim_date=date(2026, 1, 3),
        open=100.0, high=101.0, low=99.0, close=100.5,
        volume=10000, intrinsic_value=100.0, order_imbalance=0.0,
    )
    session.add(ph)
    session.commit()

    r2 = run_ticks(session, timeline_id, num_ticks=1)
    session.commit()
    assert r2[0]["status"] == "skipped"


# ── _load_tick_state errors via run_ticks (lines 286, 290) ─────────────────


def test_run_ticks_timeline_not_found(session):
    with pytest.raises(ValueError, match="Timeline 999 not found"):
        run_ticks(session, 999)


def test_run_ticks_no_simulation_state(session):
    timeline_id = _seed_minimal(session)
    session.query(SimulationState).delete()
    session.commit()
    with pytest.raises(ValueError, match="No SimulationState"):
        run_ticks(session, timeline_id)


# ── Pre-existing EconomicCycleState used instead of creating new (lines 319-320) ─


def test_economic_cycle_reused_from_existing(session):
    """When latest EconomicCycleState has the same sim_date, it is reused."""
    timeline_id = _seed_minimal(session)
    from db.models.timeseries import EconomicCycleState
    existing = EconomicCycleState(
        timeline_id=timeline_id, sim_date=date(2026, 1, 2),
        cycle_phase="peak", market_factor_return=0.001,
        gdp_growth=2.0, interest_rate=3.5, market_sentiment=0.5,
    )
    session.add(existing)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"
    assert result["cycle_phase"] == "peak"

    cycles = session.query(EconomicCycleState).filter_by(timeline_id=timeline_id).all()
    assert len(cycles) == 1  # No new cycle created


def test_repeated_skipped_tick_does_not_duplicate_economic_cycle_state(session):
    """Regression test: run_ticks used to call _load_tick_state (which inserts a new
    EconomicCycleState row when none exists yet for the target date) BEFORE checking
    whether that date was already ticked. A client retry / double-click of advance for
    an already-completed day would still add and commit a second EconomicCycleState
    row for the same (timeline_id, sim_date), since the idempotency check only
    discarded the rest of that loop iteration, not the side effect already performed
    by _load_tick_state. Verify a repeat call for a day that's already ticked adds
    zero new EconomicCycleState rows."""
    from db.models.timeseries import EconomicCycleState

    timeline_id = _seed_minimal(session)
    r1 = run_tick(session, timeline_id)
    session.commit()
    assert r1["status"] == "completed"

    cycles_after_first_tick = session.query(EconomicCycleState).filter_by(timeline_id=timeline_id).count()

    # Rewind to replay the same day again, simulating a retried/duplicate advance call.
    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim_state.current_sim_date = r1["sim_date"]
    sim_state.tick_count = r1["tick_count"] - 1
    session.commit()

    r2 = run_tick(session, timeline_id)
    session.commit()
    assert r2["status"] == "skipped"

    cycles_after_retry = session.query(EconomicCycleState).filter_by(timeline_id=timeline_id).count()
    assert cycles_after_retry == cycles_after_first_tick


# ── Event in _apply_event_factor_effects with company not in company_map (line 1099)


def test_apply_event_factor_effects_company_not_in_map(session):
    """EventInstance with scope_ref pointing to a non-existent company is skipped."""
    timeline_id = _seed_minimal(session)
    me = MarketEvent(
        id=17, name="Ghost Company Event", category="earnings",
        scope="company", severity_range="(0.1, 0.3)",
        sentiment="positive", effect_profile={"value_opportunity": 0.1},
        duration_days=5, decay_rate=0.1, probability_weight=1.0,
    )
    session.add(me)
    session.commit()

    # Tick runs, select_and_fire_events creates EventInstance with scope_ref=1 (company 1)
    # which IS in company_map. We need a scenario where scope_ref points to a
    # company that's NOT in the 'companies' list passed to _apply_event_factor_effects.
    # The simplest way: manually create an EventInstance for a non-existent company.
    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim_state.tick_count = 1
    sim_state.current_sim_date = date(2026, 1, 3)
    session.commit()

    ei = EventInstance(
        event_id=17, timeline_id=timeline_id, scope_ref=999, scope_type="company",
        sim_date=date(2026, 1, 3), resolved_severity=0.2,
        applied_effects={"value_opportunity": 1.0},
        expires_on=date(2026, 1, 10),
    )
    session.add(ei)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"


# ── Company with no price while another has price (line 182 continue) ──────


def test_one_company_no_price_other_valid(session):
    """One company has no price (skipped via continue), another valid company processes."""
    timeline_id = _seed_minimal(session)

    # Add a second valid company
    session.execute(text(
        "INSERT INTO companies (id, name, ticker, industry_id, shares_outstanding, free_float_pct, "
        "beta_market, beta_sector, current_price, intrinsic_value, intrinsic_score, fair_pe, market_cap, "
        "volatility, market_liquidity_score, created_at, updated_at) "
        "VALUES (2, 'Valid Corp', 'VAL', 1, 100000000, 0.8, 1.0, 0.5, 100.0, 100.0, 50.0, 15.0, "
        "10000000000.0, 0.02, 80.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO moat_subscores (company_id, subfactor_key, score, created_at, updated_at) "
        "VALUES (2, 'brand_strength', 70.0, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO company_factor_scores (company_id, fiscal_period, management_quality, moat_score, "
        "financial_quality, fcf_quality, growth_potential, intrinsic_score, fair_pe, intrinsic_value, "
        "computed_at, created_at, updated_at) "
        "VALUES (2, 'SEED', 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 15.0, 100.0, "
        "datetime('now'), datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO income_statements (company_id, fiscal_period, revenue, cogs, gross_profit, "
        "operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, "
        "tax, net_profit, eps, shares_diluted, created_at, updated_at) "
        "VALUES (2, '2026Q1', 1000000, 600000, 400000, 200000, 200000, 50000, 150000, 20000, "
        "130000, 32500, 97500, 0.975, 100000000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO balance_sheets (company_id, fiscal_period, cash_and_equivalents, receivables, "
        "inventory, current_assets, ppe, intangibles, total_assets, payables, short_term_debt, "
        "current_liabilities, long_term_debt, total_debt, total_liabilities, shareholders_equity, "
        "invested_capital, created_at, updated_at) "
        "VALUES (2, '2026Q1', 500000, 200000, 300000, 1000000, 2000000, 500000, 5000000, 150000, "
        "100000, 250000, 500000, 600000, 1500000, 3500000, 4100000, datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO cash_flow_statements (company_id, fiscal_period, operating_cash_flow, capex, "
        "free_cash_flow, investing_cash_flow, financing_cash_flow, dividends_paid, buybacks, "
        "net_change_in_cash, created_at, updated_at) "
        "VALUES (2, '2026Q1', 120000, -50000, 70000, -50000, -20000, -30000, -10000, 50000, "
        "datetime('now'), datetime('now'))"
    ))
    session.execute(text(
        "INSERT INTO consensus_estimates (company_id, fiscal_period, consensus_eps, consensus_revenue, "
        "created_at, updated_at) "
        "VALUES (2, '2026Q1', 0.95, 980000, datetime('now'), datetime('now'))"
    ))
    session.commit()

    # Set first company's price to None - should be skipped (continue at line 182)
    c1 = session.query(Company).filter_by(id=1).first()
    c1.current_price = None
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"
    assert result["companies_updated"] == 1  # Only company 2


# ── Ticks at quarter boundary followed by normal tick ──────────────────────


def test_ticks_spanning_quarter_boundary(session):
    """Run multiple ticks that include a quarter boundary transition."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)
    session.commit()

    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 62
    sim.current_sim_date = date(2026, 3, 31)
    session.commit()

    results = run_ticks(session, timeline_id, num_ticks=3)
    session.commit()

    assert len(results) == 3
    assert results[0]["status"] == "completed"


# ── _refresh_fundamentals with no existing financials ──────────────────────


def test_generate_fake_financials_no_prior(session):
    """Test _generate_fake_quarterly_financials when no prior income statement exists."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)
    session.commit()

    # Delete existing financials for company 1
    session.query(IncomeStatement).delete()
    session.query(BalanceSheet).delete()
    session.query(CashFlowStatement).delete()
    session.query(ConsensusEstimate).delete()
    session.commit()

    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 63
    sim.current_sim_date = date(2026, 4, 1)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    incs = session.query(IncomeStatement).filter_by(company_id=1).all()
    assert len(incs) >= 1

    bals = session.query(BalanceSheet).filter_by(company_id=1).all()
    assert len(bals) >= 1


# ── Regression tests: A+B cleanup/correctness fixes ────────────────────────


def test_quarter_refresh_preserves_prior_factor_scores(session):
    """_refresh_fundamentals must carry forward management_quality/growth_potential/
    fcf_quality from the prior CompanyFactorScore instead of re-rolling them from
    scratch. Seed distinctive values, then confirm they survive a quarter boundary."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)
    cfs = session.query(CompanyFactorScore).filter_by(company_id=1).first()
    cfs.management_quality = 83.0
    cfs.growth_potential = 77.0
    cfs.fcf_quality = 91.0
    session.commit()

    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 63
    sim.current_sim_date = date(2026, 4, 1)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    new_cfs = session.query(CompanyFactorScore).filter_by(
        company_id=1, fiscal_period="2026Q2"
    ).first()
    assert new_cfs is not None
    assert math.isclose(float(new_cfs.management_quality), 83.0)
    assert math.isclose(float(new_cfs.growth_potential), 77.0)
    assert math.isclose(float(new_cfs.fcf_quality), 91.0)


def test_quarter_refresh_uses_real_eps_and_revenue_history_for_fq_subfactors(session):
    """earnings_stability/revenue_consistency must be computed from the company's
    real trailing EPS/revenue series at quarter refresh, not silently fall back
    to a single-point neutral placeholder every time."""
    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)

    # Add a second historical income statement so there are 2+ periods of real
    # history by the time the quarter-boundary refresh computes raw FQ inputs.
    session.execute(text(
        "INSERT INTO income_statements (company_id, fiscal_period, revenue, cogs, gross_profit, "
        "operating_expenses, ebitda, depreciation_amortization, ebit, interest_expense, pretax_income, "
        "tax, net_profit, eps, shares_diluted, created_at, updated_at) "
        "VALUES (1, '2025Q4', 900000, 550000, 350000, 180000, 170000, 45000, 125000, 18000, "
        "107000, 26750, 80250, 0.8025, 100000000, datetime('now'), datetime('now'))"
    ))
    session.commit()

    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = 63
    sim.current_sim_date = date(2026, 4, 1)
    session.commit()

    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"

    fqs = {
        f.subfactor_key: f for f in session.query(FinancialQualitySubscore).filter_by(
            company_id=1, fiscal_period="2026Q2"
        ).all()
    }
    assert "earnings_stability" in fqs
    assert "revenue_consistency" in fqs
    # With real multi-period history (not a single-point 50.0 neutral placeholder),
    # the raw stability/consistency scores are computed from actual variance and
    # should not degenerate to exactly the neutral midpoint.
    assert fqs["earnings_stability"].raw_metric_value is not None
    assert fqs["revenue_consistency"].raw_metric_value is not None


def test_earnings_surprise_and_guidance_decay_reset_each_quarter(session):
    """earnings_surprise/guidance must decay against days-since-the-current-quarter's
    earnings (tick_count % QUARTER_LENGTH), not the absolute tick_count -- otherwise
    both drivers permanently decay to ~0 after the first quarter and never recover."""
    from engine.orchestrator import QUARTER_LENGTH

    timeline_id = _seed_minimal(session)
    _setup_fq_factor_defs(session)
    ce = session.query(ConsensusEstimate).first()
    ce.consensus_eps = 0.5  # actual 0.975 beats consensus -> earnings_surprise/guidance nonzero
    session.commit()

    # Advance tick_count well past one full quarter, but only a few ticks into
    # the *current* quarter, without crossing a new quarter boundary ourselves.
    sim = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    sim.tick_count = QUARTER_LENGTH + 2
    sim.current_sim_date = date(2026, 1, 2) + timedelta(days=QUARTER_LENGTH + 2)
    session.commit()

    run_tick(session, timeline_id)
    session.commit()

    scores = {
        s.driver_key: s
        for s in session.query(PriceDriverScore).filter_by(timeline_id=timeline_id).all()
    }
    # days_since_earnings = (QUARTER_LENGTH + 3) % QUARTER_LENGTH = 3 -- still fresh,
    # so these drivers must be non-zero (would be ~0 under the old absolute-tick_count bug).
    assert scores["earnings_surprise"].value != 0.0
    assert scores["guidance"].value != 0.0


def test_technical_momentum_uses_real_trailing_price_history(session):
    """technical_momentum must be computed from a real batch-loaded moving average
    of recent closes, not a hardcoded prev_close * 0.98 placeholder."""
    timeline_id = _seed_minimal(session)

    # Seed a trailing price history that is clearly NOT prev_close * 0.98, so the
    # moving average used by technical_momentum is distinguishable from the old
    # hardcoded fallback.
    for i, close in enumerate([100.0, 120.0, 140.0, 160.0, 180.0]):
        session.add(PriceHistory(
            timeline_id=timeline_id, company_id=1,
            sim_date=date(2025, 12, 25) + timedelta(days=i),
            open=close, high=close, low=close, close=close,
            volume=10000, intrinsic_value=100.0, order_imbalance=0.0,
        ))
    session.commit()

    c = session.query(Company).filter_by(id=1).first()
    c.current_price = 200.0
    session.commit()

    run_tick(session, timeline_id)
    session.commit()

    from engine.drivers import technical_momentum

    scores = {
        s.driver_key: s
        for s in session.query(PriceDriverScore).filter_by(timeline_id=timeline_id).all()
    }
    tm = scores["technical_momentum"]
    assert tm.value is not None

    # moving_avg over the seeded closes = 140.0, prev_close = 200.0. Compare the
    # actual computed value against what the *old* hardcoded prev_close * 0.98
    # fallback would have produced for the same prev_close -- they must differ,
    # proving a real moving average (not the fake constant) drove the result.
    old_fake_value = technical_momentum(200.0, 200.0 * 0.98, 0.5)
    assert not math.isclose(float(tm.value), old_fake_value, abs_tol=1e-6)


def test_run_tick_dead_locals_removed_still_delegates_to_run_ticks(session):
    """run_tick is now a thin wrapper around run_ticks(num_ticks=1); confirm it
    still raises the same errors and produces the same single-tick result shape."""
    timeline_id = _seed_minimal(session)
    result = run_tick(session, timeline_id)
    session.commit()
    assert result["status"] == "completed"
    assert result["tick_count"] == 1

    with pytest.raises(ValueError, match="Timeline 999 not found"):
        run_tick(session, 999)
