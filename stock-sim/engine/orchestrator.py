"""Phase 4 — Full engine-to-DB simulation tick orchestration loop.

Wires the pure-function engine modules (tick, market, drivers, valuation, liquidity,
ohlc, cycle, events) to the database.  Each call to run_tick() advances the
simulation by one business day for all companies.
"""

import collections
import logging
import math
import random
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Optional

import numpy as np
try:
    from numba import njit
except ImportError:
    def njit(f): return f
from sqlalchemy import insert, text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
    ConCall,
    ConfigParameter,
    ConsensusEstimate,
    EconomicCycleState,
    EventInstance,
    FactorDefinition,
    FinancialQualitySubscore,
    Holding,
    IncomeStatement,
    Industry,
    IndustryPillarWeight,
    MarketEvent,
    MoatSubscore,
    NewsFeed,
    Portfolio,
    PriceDriverScore,
    PriceHistory,
    SimulationState,
    Timeline,
    TimelineOverride,
)
from db.timeline_resolver import (
    get_latest_intrinsic_values, get_latest_prices, get_latest_prices_and_ivs,
    get_timeline_chain, resolve_latest_cycle_state,
)
from engine.concalls import generate_concall
from engine.cycle import advance_cycle_phase, compute_cycle_state, generate_sector_shocks
from engine.drivers import (
    composite_price_pressure,
    earnings_surprise,
    economic_outlook as compute_economic_outlook,
    guidance,
    institutional_buying,
    news_severity,
    technical_momentum,
    value_opportunity,
)
from engine.events import apply_effect_to_drivers, apply_effect_to_factor_scores
from engine.fundamentals import (
    accruals_ratio,
    asset_turnover,
    capital_adequacy_ratio,
    cash_conversion_cycle,
    cost_to_income,
    current_ratio,
    days_inventory_outstanding,
    days_payables_outstanding,
    days_sales_outstanding,
    earnings_stability,
    interest_coverage,
    net_debt_to_ebitda,
    net_interest_margin,
    npa_ratio,
    operating_margin,
    payout_sustainability,
    revenue_consistency,
    roa,
    roe,
    roic,
)
from engine.liquidity import (
    compute_volume_prd,
    demand_from_pressure,
    market_liquidity_score,
    order_imbalance,
    supply_from_pressure,
)
from engine.news_manager import generate_news, select_and_fire_events
from engine.ohlc import apply_circuit_breaker, synthesize_ohlc
from engine.overrides import (
    apply_config_overrides,
    apply_driver_bias,
    build_cycle_transition_override,
    driver_bias_by_company,
    factor_score_bias_by_company,
    resolve_active_overrides,
)
from engine.scoring import (
    financial_quality_composite,
    intrinsic_score as compute_intrinsic_score,
    moat_composite,
    percentile_rank_scores,
)
from engine.tick import CompanyTickInput, CompanyTickOutput, TickResult, TickState, run_tick as engine_run_tick
from engine.valuation import (
    DEFAULT_BASELINE_PE,
    DEFAULT_GROWTH_RATE_MAX,
    DEFAULT_GROWTH_RATE_MIN,
    DEFAULT_M_INFLECTION,
    DEFAULT_M_MAX,
    DEFAULT_M_MIN,
    DEFAULT_M_STEEPNESS,
    compute_growth_potential_from_financials,
    drift_iv,
    fair_pe_from_peg,
    fair_peg,
    growth_score_to_rate,
    intrinsic_value_per_share,
)

TAX_RATE = 0.25
TRADING_DAYS_PER_YEAR = 252
QUARTER_LENGTH = 63
# Hard bounds on quarter-over-quarter revenue growth in _generate_fake_quarterly_
# financials, applied AFTER summing every signal (trend/management/FQ-trend/
# price/events/guidance) so no combination of extreme inputs can produce a
# pathological (e.g. runaway or deeply negative) revenue print.
GROWTH_RATE_CLAMP_MIN = -0.40
GROWTH_RATE_CLAMP_MAX = 0.60
DRIVER_KEYS = frozenset({
    "value_opportunity", "earnings_surprise", "news_severity",
    "economic_outlook", "guidance", "technical_momentum",
    "institutional_buying",
})
# Con-call -> factor-score nudge scale/clamp (Section 6.O comprehensive
# con-calls). driver_deltas["guidance"]/["earnings_surprise"] are already
# clamped to roughly [-0.15, 0.15] in engine/concalls.py; multiplying by
# CONCALL_FACTOR_NUDGE_SCALE and then clamping again to
# +/-CONCALL_FACTOR_NUDGE_CLAMP keeps a single con-call's factor-score effect
# tiny relative to the 0-100 CompanyFactorScore range -- deliberately
# conservative per the approved design's "small bounded nudges" choice.
CONCALL_FACTOR_NUDGE_SCALE = 6.0
CONCALL_FACTOR_NUDGE_CLAMP = 1.5
# Per-company multiplicative dispersion applied to a shared EventInstance's
# resolved_severity before it feeds news_severity/apply_effect_to_drivers (see
# _jitter_event_severities) -- a market- or industry-scope event otherwise
# lands with byte-identical severity on every company in scope.
EVENT_SEVERITY_JITTER_STD = 0.25


# ── Bulk tick mode data structures ─────────────────────────────────────


@dataclass
class PriceHistoryRow:
    """Lightweight DTO for deferred PriceHistory insert."""
    timeline_id: int
    company_id: int
    sim_date: date
    open: float
    high: float
    low: float
    close: float
    volume: int
    intrinsic_value: float
    order_imbalance: float


@dataclass
class PriceDriverScoreRow:
    """Lightweight DTO for deferred PriceDriverScore insert."""
    timeline_id: int
    company_id: int
    sim_date: date
    driver_key: str
    value: float
    weight: float
    contribution: float


@dataclass
class TickMemoryOutput:
    """All outputs from one in-memory tick, before insertion buffering."""
    sim_date: date
    tick_count: int
    ohlc_results: dict[int, dict]           # {cid: {open, high, low, close}}
    volume_results: dict[int, int]            # {cid: volume}
    imbalance_results: dict[int, float]       # {cid: order_imbalance}
    tick_result: 'TickResult'                 # engine's raw output
    tick_inputs: tuple                       # tuple[CompanyTickInput, ...]
    driver_scores: list[dict]                # prepared PDS row dicts
    price_history_rows: list[dict]           # prepared PH row dicts


@dataclass
class TickStateArrays:
    """Packed in-memory state for N ticks of ~150 companies.

    Loaded once by _load_static_tick_state(), mutated in-place by
    _bulk_tick_iteration(), flushed by _bulk_flush().
    """

    # ── Static (loaded once, never mutated mid-run) ──────────────────────
    timeline_id: int
    timeline: 'Timeline'
    companies: list['Company']                          # ORM objects (read-only)
    company_by_id: dict[int, 'Company']                 # {cid: Company}
    industries: dict[int, 'Industry']                    # {id: Industry}
    industry_ids: list[int]
    params: dict[str, float]                            # ConfigParameter flat dict
    neutral_industry_pegs: dict[int, float]              # {industry_id: peg}
    timeline_chain: list[int]                            # resolved parent chain
    event_defs: dict[int, 'MarketEvent']                 # {event_id: MarketEvent}

    # Financial statement caches (loaded once, mutated at quarter boundaries)
    latest_bal: dict[int, 'BalanceSheet']                # {cid: latest BS}
    latest_inc: dict[int, 'IncomeStatement']             # {cid: latest IS}
    latest_ce: dict[int, 'ConsensusEstimate']            # {cid: latest CE}
    latest_cfs: dict[int, 'CompanyFactorScore']          # {cid: latest CFS}

    # Factor-effect batch (loaded once)
    industry_pw: dict[int, dict[str, float]]
    subfactor_pillar: dict[str, str]
    moat_weights: dict[str, float]
    moat_rows_by_company: dict[int, list['MoatSubscore']]
    fq_subs_by_company: dict[int, list['FinancialQualitySubscore']]

    # Override maps (loaded once)
    driver_bias_map: dict[Optional[int], dict[str, float]]
    factor_score_bias_map: dict[Optional[int], dict[str, float]]
    cycle_transition_override: Optional[dict]

    # Active event sets — market/industry/company grouped, loaded once
    market_events: list['EventInstance'] = field(default_factory=list)
    industry_events: dict[int, list['EventInstance']] = field(default_factory=dict)
    company_events: dict[int, list['EventInstance']] = field(default_factory=dict)

    # ── Mutable per-tick state (updated in-place each tick) ──────────────
    current_sim_date: date = None  # type: ignore[assignment]
    current_tick_count: int = 0

    # Economic cycle state — drifts every tick in memory
    cycle_phase: str = "expansion"
    cycle_state: dict[str, float] = field(default_factory=lambda: {
        "market_factor_return": 0.0,
        "gdp_growth": 0.0,
        "interest_rate": 0.0,
        "market_sentiment": 0.0,
    })
    f_m: float = 0.0

    # Price / IV overlays — the core in-memory arrays
    price_overlay: dict[int, float] = field(default_factory=dict)
    iv_overlay: dict[int, float] = field(default_factory=dict)

    # Sliding window of recent closes for MA computation
    recent_closes: dict[int, collections.deque] = field(default_factory=dict)

    # Previous tick's news_severity per company (for volume dampening)
    prev_ns: dict[int, float] = field(default_factory=dict)

    # Sector shocks — recomputed on cycle-phase change
    sector_shocks: dict[int, float] = field(default_factory=dict)

    # Per-tick RNG (seeded from timeline.rng_seed + tick_count)
    rng_offset: int = 0

    # Quarter boundary tracking
    is_quarter_boundary: bool = False

    # ── Deferred insertion buffers (§6) ──────────────────────────────────
    price_history_buffer: list[dict] = field(default_factory=list)
    driver_score_buffer: list[dict] = field(default_factory=list)
    cycle_state_entries: list[dict] = field(default_factory=list)
    sim_state_final: Optional[dict] = None


def run_tick(session: Session, timeline_id: int) -> dict:
    """Advance the simulation by one trading day for the given timeline.

    Thin wrapper around run_ticks(num_ticks=1) -- existence and idempotency
    checks live there so they aren't duplicated here.
    """
    return run_ticks(session, timeline_id, num_ticks=1)[0]


def run_ticks(
    session: Session,
    timeline_id: int,
    num_ticks: int = 1,
) -> list[dict]:
    """Run multiple ticks in sequence. Each tick is idempotent."""
    results = []
    # Preload immutable data once for all ticks (SPEED.md #8):
    # Company list, Industry dict, ConfigParameter params, and
    # neutral_industry_pegs never change mid-run.
    preloaded_companies = session.query(Company).order_by(Company.id).all()
    preloaded_industries = {ind.id: ind for ind in session.query(Industry).order_by(Industry.id).all()}
    preloaded_params = _load_params(session)
    preloaded_neutral_industry_pegs = _load_neutral_industry_pegs(session)
    for _ in range(num_ticks):
        _t0 = time.perf_counter()
        # Same existence-check order as _load_tick_state (Timeline before
        # SimulationState) so error messages/precedence are unchanged now that
        # this validation runs here first, before the side-effecting state load.
        # timeline/sim_state are fetched once here and threaded through to
        # _load_tick_state below so it doesn't re-query them (SPEED.md #2).
        timeline = session.query(Timeline).filter_by(id=timeline_id).first()
        if timeline is None:
            raise ValueError(f"Timeline {timeline_id} not found")
        sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
        if sim_state is None:
            raise ValueError(f"No SimulationState for timeline {timeline_id} -- run seed_initial_prices first")
        sim_date = _resolve_tick_target_date(session, timeline_id, sim_state)

        existing = session.query(PriceHistory).filter_by(
            timeline_id=timeline_id, sim_date=sim_date
        ).first()
        if existing is not None:
            # A PriceHistory row for `sim_date` already exists — either the seed's
            # day-0 baseline close (seed_initial_prices.py writes one for
            # FIRST_SIM_DATE up front; _resolve_tick_target_date already shifts
            # sim_date past that specific case using is_running, so this branch
            # mainly guards a genuine duplicate/retried call for a day that's
            # already been fully ticked) or some other collision. Either way that
            # day's close is legitimately already computed, so still advance the
            # pointer instead of leaving current_sim_date frozen forever — a bare
            # "skip and continue without advancing" would make every subsequent
            # Advance call re-check the same day and never make progress.
            next_date = sim_date + timedelta(days=1)
            sim_state.current_sim_date = next_date
            sim_state.tick_count = sim_state.tick_count + 1
            session.flush()
            results.append({
                "status": "skipped",
                "reason": "already_executed",
                "sim_date": sim_date,
                "next_date": next_date,
                "tick_count": sim_state.tick_count,
            })
            continue

        _t1 = time.perf_counter()
        state = _load_tick_state(session, timeline_id, sim_date, timeline=timeline, sim_state=sim_state,
                                 preloaded_companies=preloaded_companies, preloaded_industries=preloaded_industries,
                                 preloaded_params=preloaded_params,
                                 preloaded_neutral_industry_pegs=preloaded_neutral_industry_pegs)
        _t2 = time.perf_counter()
        tick_count = state.tick_count
        companies = state.companies
        company_by_id = {c.id: c for c in companies}

        # -- Quarter boundary: refresh fundamentals -------------------------
        if state.is_quarter_boundary:
            _t_qb = time.perf_counter()
            _refresh_fundamentals(
                session, timeline_id, companies, state.industries,
                state.params, state.neutral_industry_pegs,
                datetime.now(timezone.utc), state.rng, tick_count,
                sim_date, state.timeline.is_live,
            )
            _generate_concalls_for_quarter(
                session, timeline_id, companies, state.latest_cfs, sim_date, state.rng, tick_count,
            )
            _t_qb_end = time.perf_counter()

        # -- IV drift ---------------------------------------------------------
        _t3 = time.perf_counter()
        growth_rate_min = float(state.params.get("growth_rate_min", DEFAULT_GROWTH_RATE_MIN))
        growth_rate_max = float(state.params.get("growth_rate_max", DEFAULT_GROWTH_RATE_MAX))
        for company in companies:
            iv_start = state.iv_overlay.get(company.id)
            if iv_start is not None:
                cfs = state.latest_cfs.get(company.id)
                growth_potential = float(cfs.growth_potential) if cfs else 50.0
                growth_rate_pct = growth_score_to_rate(growth_potential, growth_rate_min, growth_rate_max)
                state.iv_overlay[company.id] = float(drift_iv(
                    iv_start, growth_rate_pct, TRADING_DAYS_PER_YEAR,
                ))
                if state.timeline.is_live:
                    company.intrinsic_value = state.iv_overlay[company.id]

        _t4 = time.perf_counter()
        # -- Compute drivers per company ------------------------------------
        pricing_data: dict[str, list] = {
            "company_ids": [], "y": [], "theta": [],
            "driver_values": [], "driver_weights": [],
            "beta_market": [], "beta_sector": [],
            "sector_factors": [], "sigma": [],
            "epsilon": [], "intrinsic_value": [],
        }
        company_ns: dict[int, float] = {}
        company_sigma: dict[int, float] = {}

        for ci, company in enumerate(companies):
            result = _compute_drivers(
                session, company, state, timeline_id, sim_date, tick_count,
            )
            if result is None:
                continue
            pricing_data["company_ids"].append(result["company_id"])
            pricing_data["y"].append(result["y"])
            pricing_data["theta"].append(result["theta"])
            pricing_data["driver_values"].append(result["driver_values"])
            pricing_data["driver_weights"].append(result["driver_weights"])
            pricing_data["beta_market"].append(result["beta_market"])
            pricing_data["beta_sector"].append(result["beta_sector"])
            pricing_data["sector_factors"].append(result["sector_factor"])
            pricing_data["sigma"].append(result["sigma"])
            pricing_data["epsilon"].append(result["epsilon"])
            pricing_data["intrinsic_value"].append(result["intrinsic_value"])
            company_ns[company.id] = result["news_severity"]
            company_sigma[company.id] = result["sigma"]

        if not pricing_data["company_ids"]:
            raise ValueError("No companies with valid pricing data")

        # -- Run the engine tick --------------------------------------------
        tick_inputs = tuple(
            CompanyTickInput(
                company_id=cid, y=y, theta=th,
                driver_values=dv, driver_weights=dw,
                beta_market=bm, beta_sector=bs,
                sector_factor_return=sf, sigma=sig,
                epsilon=eps, intrinsic_value=iv,
            )
            for cid, y, th, dv, dw, bm, bs, sf, sig, eps, iv in zip(
                pricing_data["company_ids"],
                pricing_data["y"],
                pricing_data["theta"],
                pricing_data["driver_values"],
                pricing_data["driver_weights"],
                pricing_data["beta_market"],
                pricing_data["beta_sector"],
                pricing_data["sector_factors"],
                pricing_data["sigma"],
                pricing_data["epsilon"],
                pricing_data["intrinsic_value"],
            )
        )

        tick_state = TickState(
            sim_day=tick_count,
            market_factor_return=state.f_m,
            companies=tick_inputs,
            pressure_scale=float(state.params.get("k_drift", 0.03)),
        )
        tick_result = engine_run_tick(tick_state, k_drift=1.0)

        # -- Circuit breaker + OHLC + volume --------------------------------
        _t5 = time.perf_counter()
        ohlc_results, volume_results, imbalance_results = _update_prices_and_ohlc(
            companies, company_by_id, tick_result, state.params, state.prev_ns, company_ns, state.rng, tick_count,
            state.price_overlay,
        )

        # -- Write DB rows --------------------------------------------------
        _t6 = time.perf_counter()
        _write_tick_results(
            session, timeline_id, sim_date, company_by_id, tick_inputs, tick_result,
            ohlc_results, volume_results, imbalance_results,
        )

        # -- Update denormalized Company fields (live timeline only) --------
        _t7 = time.perf_counter()
        _update_denormalized_fields(
            company_by_id, ohlc_results, volume_results, tick_result, company_sigma, state.timeline.is_live,
        )

        # -- Mark to market -------------------------------------------------
        _mark_to_market(session, timeline_id, ohlc_results)

        # -- Fire events + generate news ------------------------------------
        _t8 = time.perf_counter()
        _execute_events(session, timeline_id, state, sim_date, companies)
        _t9 = time.perf_counter()

        # -- Advance simulation state ---------------------------------------
        next_date = sim_date + timedelta(days=1)
        state.sim_state.current_sim_date = next_date
        state.sim_state.tick_count = tick_count + 1
        state.sim_state.is_running = True

        session.flush()
        _t_end = time.perf_counter()

        # Log timing breakdown for this tick
        _load_ms = (_t2 - _t1) * 1000
        _qb_ms = ((_t_qb_end - _t_qb) * 1000) if state.is_quarter_boundary else 0.0
        _iv_ms = (_t4 - _t3) * 1000
        _drv_ms = (_t5 - _t4) * 1000
        _tck_ms = (_t6 - _t5) * 1000
        _wrt_ms = (_t7 - _t6) * 1000
        _evt_ms = (_t9 - _t8) * 1000
        _total_ms = (_t_end - _t0) * 1000

        # Use print so output is visible even if log-level filters it
        _tag = f"TICK{tick_count}"
        print(f"[TIMING {_tag}] total={_total_ms:.1f}ms | load={_load_ms:.1f}ms | qb={_qb_ms:.1f}ms | iv_drift={_iv_ms:.1f}ms | drivers={_drv_ms:.1f}ms | ohlc_db={_tck_ms:.1f}ms | write={_wrt_ms:.1f}ms | events={_evt_ms:.1f}ms")
        logger.info("TIMING tick=%s total=%.1fms load=%.1fms qb=%.1fms iv=%.1fms drv=%.1fms ohlc_write=%.1fms events=%.1fms", tick_count, _total_ms, _load_ms, _qb_ms, _iv_ms, _drv_ms, _tck_ms, _evt_ms)

        results.append({
            "status": "completed",
            "sim_date": sim_date,
            "next_date": next_date,
            "tick_count": tick_count + 1,
            "companies_updated": len(tick_result.outputs),
            "cycle_phase": state.cycle_phase,
            "market_factor_return": state.f_m,
        })

    return results


# ── Extracted helper methods ────────────────────────────────────────────────


def _resolve_tick_target_date(session: Session, timeline_id: int, sim_state: SimulationState) -> date:
    """Resolve which sim_date the next tick should target, without any side effects.

    Cheap and read-only so the caller can check idempotency (does PriceHistory
    already exist for this date?) before calling the side-effecting
    _load_tick_state -- otherwise _load_tick_state's EconomicCycleState insert
    happens even when the tick turns out to be a no-op skip, leaving a
    duplicate EconomicCycleState row for the same (timeline_id, sim_date) once
    the caller's idempotency check discards the rest of that iteration.
    """
    sim_date = sim_state.current_sim_date
    # seed_initial_prices (unlike test fixtures / a fresh SimulationState with no
    # PriceHistory yet) writes a PriceHistory row for current_sim_date as the day-0
    # baseline close and sets is_running=False; the first real tick flips is_running
    # to True and never resets it, so is_running (not tick_count, which a retried/
    # rewound call could reset to 0 for an already-ticked day) is the reliable signal
    # that current_sim_date is still an unticked seed baseline whose first real tick
    # must target the following day, not re-check the baseline day itself.
    if not sim_state.is_running:
        seeded_baseline_exists = session.query(PriceHistory).filter_by(
            timeline_id=timeline_id, sim_date=sim_date
        ).first() is not None
        if seeded_baseline_exists:
            sim_date = sim_date + timedelta(days=1)
    return sim_date


def _load_tick_state(
    session: Session,
    timeline_id: int,
    sim_date: date,
    timeline: Optional[Timeline] = None,
    sim_state: Optional[SimulationState] = None,
    preloaded_companies: Optional[list[Company]] = None,
    preloaded_industries: Optional[dict[int, Industry]] = None,
    preloaded_params: Optional[dict[str, float]] = None,
    preloaded_neutral_industry_pegs: Optional[dict[int, float]] = None,
) -> SimpleNamespace:
    """Load and return all simulation state for one tick.

    Loads timeline, sim_state, economic cycle, companies, industries, balance
    sheets, and previous tick news_severity.  Raises ValueError if the timeline
    or simulation state does not exist.  Does NOT check idempotency — the
    caller is responsible for that (see _resolve_tick_target_date, which must
    be called first to compute sim_date so idempotency can be checked before
    this function's side effects, e.g. the EconomicCycleState insert below,
    run).

    `timeline`/`sim_state` are optional pre-fetched rows so callers that
    already queried them (run_ticks's existence/idempotency check) don't pay
    for a second round-trip. When omitted (e.g. direct test calls), this
    function queries them itself exactly as before.

    `preloaded_companies`/`preloaded_industries`/`preloaded_params`/
    `preloaded_neutral_industry_pegs` let callers that load immutable data
    once outside a multi-tick loop skip re-querying every tick (SPEED.md #8).
    """
    if timeline is None:
        timeline = session.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise ValueError(f"Timeline {timeline_id} not found")

    if sim_state is None:
        sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        raise ValueError(f"No SimulationState for timeline {timeline_id} -- run seed_initial_prices first")

    tick_count = sim_state.tick_count
    epoch_start = sim_state.current_sim_date - timedelta(days=tick_count)

    rng = random.Random(timeline.rng_seed + tick_count)
    if preloaded_neutral_industry_pegs is not None:
        neutral_industry_pegs = preloaded_neutral_industry_pegs
    else:
        neutral_industry_pegs = _load_neutral_industry_pegs(session)

    # Future Lab (Section 11): this timeline's active overrides, grouped by
    # target_type. Structural overrides only ever touch config/factor_score/
    # event/cycle_transition/driver_bias -- never a raw driver pin (drivers
    # are recomputed every tick; see engine/overrides.py's module docstring).
    override_rows = session.query(TimelineOverride).filter_by(timeline_id=timeline_id).all()
    active_overrides = resolve_active_overrides(override_rows, sim_date)

    # config overrides REPLACE the named ConfigParameter value for this
    # timeline only (see apply_config_overrides's docstring) -- applied
    # before params is handed to anything downstream (driver weights, theta,
    # kyle_lambda_scale, _refresh_fundamentals, ...) so every consumer sees
    # the overridden value transparently, with no separate wiring needed.
    params = apply_config_overrides(
        _load_params(session) if preloaded_params is None else preloaded_params,
        active_overrides.get("config", []),
    )

    cycle_transition_override: Optional[dict[str, list[tuple[str, float]]]] = None
    for row in active_overrides.get("cycle_transition", []):
        # target_key is the forced phase name; override_value is the shock
        # "strength" in [0, 1] (1.0 = hard freeze onto target_key every
        # tick this override is active, matching the Macro Shock primitive's
        # "force cycle_phase for N sim-days" semantics -- see
        # build_cycle_transition_override's docstring for the blend at
        # strength < 1.0). Only the last active row wins if more than one
        # is somehow active at once (shouldn't happen via the wizard, which
        # only ever writes one cycle_transition override per branch).
        try:
            strength = float(row.override_value)
        except (TypeError, ValueError):
            strength = 1.0
        cycle_transition_override = build_cycle_transition_override(row.target_key, strength)
    driver_bias_map = driver_bias_by_company(active_overrides.get("driver_bias", []))
    factor_score_bias_map = factor_score_bias_by_company(active_overrides.get("factor_score", []))

    # Economic cycle. Own-timeline-only lookup first (never falls back to an
    # ancestor's row for a date this timeline has already ticked); the
    # chain-aware resolver only kicks in below when this timeline has no
    # cycle history of its own at all yet (a freshly forked child's first
    # tick), so it inherits the parent's real phase as of the branch point
    # instead of defaulting to "expansion" -- see
    # db/timeline_resolver.py::resolve_latest_cycle_state.
    latest_cycle = session.query(EconomicCycleState).filter_by(
        timeline_id=timeline_id
    ).order_by(EconomicCycleState.sim_date.desc()).first()

    if latest_cycle is None or latest_cycle.sim_date < sim_date:
        prev_cycle = latest_cycle or resolve_latest_cycle_state(session, timeline_id, before_date=sim_date)
        prev_phase = prev_cycle.cycle_phase if prev_cycle else "expansion"
        cycle_phase = advance_cycle_phase(prev_phase, rng, cycle_transition_override)
        cycle_state = compute_cycle_state(cycle_phase, rng)
        cycle_row = EconomicCycleState(
            timeline_id=timeline_id,
            sim_date=sim_date,
            cycle_phase=cycle_phase,
            market_factor_return=cycle_state["market_factor_return"],
            gdp_growth=cycle_state["gdp_growth"],
            interest_rate=cycle_state["interest_rate"],
            market_sentiment=cycle_state["market_sentiment"],
        )
        session.add(cycle_row)
    else:
        cycle_phase = latest_cycle.cycle_phase
        cycle_state = {
            "market_factor_return": float(latest_cycle.market_factor_return),
            "gdp_growth": float(latest_cycle.gdp_growth),
            "interest_rate": float(latest_cycle.interest_rate),
            "market_sentiment": float(latest_cycle.market_sentiment),
        }

    f_m = cycle_state["market_factor_return"]

    if preloaded_companies is not None:
        companies = preloaded_companies
    else:
        companies = session.query(Company).order_by(Company.id).all()
    if preloaded_industries is not None:
        industries = preloaded_industries
    else:
        industries = {ind.id: ind for ind in session.query(Industry).order_by(Industry.id).all()}
    industry_ids = list(industries.keys())

    # Company.current_price is a single shared, timeline-agnostic cache --
    # with more than one timeline ticking, it reflects whichever timeline
    # happened to advance most recently, not necessarily THIS one. Every
    # price READ during this tick must go through price_overlay (seeded from
    # PriceHistory via the parent-chain resolver), never company.current_price
    # directly -- see _compute_drivers's `price_overlay` param and
    # _update_denormalized_fields (only the live timeline persists its result
    # back to the shared Company row; non-live timelines' per-tick price
    # already lives durably in PriceHistory).
    # Resolved once and reused for both overlays below -- the parent chain
    # never changes mid-tick (SPEED.md #4), so a second get_timeline_chain
    # round-trip inside get_latest_intrinsic_values would be redundant.
    timeline_chain = get_timeline_chain(session, timeline_id, timeline=timeline)
    # Fetch both price and intrinsic_value in one query (SPEED.md #6) instead
    # of two separate get_latest_prices + get_latest_intrinsic_values calls.
    price_overlay_raw, iv_overlay_raw = get_latest_prices_and_ivs(
        session, [c.id for c in companies], timeline_id, timeline_chain,
    )
    price_overlay: dict[int, float] = {
        cid: float(price) for cid, price in price_overlay_raw.items()
    }
    iv_overlay: dict[int, float] = {
        cid: float(iv) for cid, iv in iv_overlay_raw.items()
    }

    sector_shocks = generate_sector_shocks(
        industry_ids=industry_ids,
        cycle_sensitivity_map={ind.id: float(ind.cycle_sensitivity) for ind in industries.values()},
        sector_beta_default_map={ind.id: float(ind.sector_beta_default) for ind in industries.values()},
        market_factor_return=f_m,
        rng=rng,
    )

    all_bal = session.query(BalanceSheet).filter_by(timeline_id=timeline_id).order_by(
        BalanceSheet.fiscal_period.desc()
    ).all()
    latest_bal: dict[int, BalanceSheet] = {}
    for bal in all_bal:
        if bal.company_id not in latest_bal:
            latest_bal[bal.company_id] = bal

    # Batch-load IncomeStatement and ConsensusEstimate so _compute_drivers
    # does not issue N queries per company per tick.
    all_inc = session.query(IncomeStatement).filter_by(timeline_id=timeline_id).order_by(
        IncomeStatement.fiscal_period.desc()
    ).all()
    latest_inc: dict[int, IncomeStatement] = {}
    for inc in all_inc:
        if inc.company_id not in latest_inc:
            latest_inc[inc.company_id] = inc

    all_ce = session.query(ConsensusEstimate).filter_by(timeline_id=timeline_id).order_by(
        ConsensusEstimate.fiscal_period.desc()
    ).all()
    latest_ce: dict[int, ConsensusEstimate] = {}
    for ce in all_ce:
        if ce.company_id not in latest_ce:
            latest_ce[ce.company_id] = ce

    # Sort by fiscal_period (not id) for consistency with the other latest_*
    # lookups above (BalanceSheet/IncomeStatement/ConsensusEstimate all sort by
    # fiscal_period.desc()) -- id.desc() happens to coincide with fiscal-period
    # order for a normal forward-only simulation, but isn't guaranteed to if a
    # row is ever backfilled or re-inserted out of chronological order.
    all_cfs = session.query(CompanyFactorScore).filter_by(timeline_id=timeline_id).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).all()
    latest_cfs: dict[int, CompanyFactorScore] = {}
    for cfs_row in all_cfs:
        if cfs_row.company_id not in latest_cfs:
            latest_cfs[cfs_row.company_id] = cfs_row

    # Trailing closes for the technical_momentum moving average, batch-loaded
    # so _compute_drivers doesn't issue N queries per company per tick.
    ma_window = int(params.get("ma_window", 20))
    recent_closes: dict[int, list[float]] = {}
    if ma_window > 0:
        # Ticks advance exactly 1 calendar day each (no weekend/holiday
        # skipping in this engine -- see run_ticks/_resolve_tick_target_date),
        # so `ma_window` calendar days back covers exactly `ma_window` prior
        # trading days with no gap risk. SPEED.md #5: was `* 3`, fetching 3x
        # the rows this loop needed across all companies every tick.
        window_start = sim_date - timedelta(days=ma_window)
        price_rows = (
            session.query(PriceHistory.company_id, PriceHistory.close)
            .filter(
                PriceHistory.timeline_id == timeline_id,
                PriceHistory.sim_date >= window_start,
                PriceHistory.sim_date < sim_date,
            )
            .order_by(PriceHistory.sim_date.asc())
            .all()
        )
        for company_id, close in price_rows:
            closes = recent_closes.setdefault(company_id, [])
            closes.append(float(close))
            if len(closes) > ma_window:
                closes.pop(0)

    prev_ns: dict[int, float] = {}
    if tick_count > 0:
        prev_date = sim_date - timedelta(days=1)
        prev_scores = session.query(PriceDriverScore).filter_by(
            timeline_id=timeline_id, sim_date=prev_date, driver_key="news_severity"
        ).all()
        for ps in prev_scores:
            prev_ns[ps.company_id] = float(ps.value)

    # Batch-load every active EventInstance (+ its MarketEvent) once per
    # tick, instead of _compute_drivers issuing 2 queries per company per
    # tick via _get_active_events_for_company (previously the dominant cost
    # of Advance -- ~2s/tick with 150 companies, almost entirely DB
    # round-trips here).
    market_events, industry_events, company_events, event_defs = _load_active_events(
        session, timeline_id, sim_date,
    )

    is_quarter_boundary = tick_count > 0 and tick_count % QUARTER_LENGTH == 0

    return SimpleNamespace(
        timeline=timeline,
        sim_state=sim_state,
        sim_date=sim_date,
        tick_count=tick_count,
        epoch_start=epoch_start,
        rng=rng,
        params=params,
        neutral_industry_pegs=neutral_industry_pegs,
        cycle_phase=cycle_phase,
        cycle_state=cycle_state,
        f_m=f_m,
        companies=companies,
        price_overlay=price_overlay,
        iv_overlay=iv_overlay,
        driver_bias_map=driver_bias_map,
        factor_score_bias_map=factor_score_bias_map,
        industries=industries,
        industry_ids=industry_ids,
        sector_shocks=sector_shocks,
        latest_bal=latest_bal,
        latest_inc=latest_inc,
        latest_ce=latest_ce,
        latest_cfs=latest_cfs,
        recent_closes=recent_closes,
        prev_ns=prev_ns,
        market_events=market_events,
        industry_events=industry_events,
        company_events=company_events,
        event_defs=event_defs,
        is_quarter_boundary=is_quarter_boundary,
    )


def _load_active_events(
    session: Session, timeline_id: int, sim_date: date,
) -> tuple[list[EventInstance], dict[int, list[EventInstance]], dict[int, list[EventInstance]], dict[int, MarketEvent]]:
    """Batch-load every EventInstance active on `sim_date` (+ the MarketEvent
    rows they reference) in two queries total, grouped by scope so
    `_get_active_events_for_company` can look a company up in memory instead
    of re-querying per company."""
    instances = session.query(EventInstance).filter(
        EventInstance.timeline_id == timeline_id,
        EventInstance.expires_on >= sim_date,
    ).order_by(EventInstance.id).all()

    market_events: list[EventInstance] = []
    industry_events: dict[int, list[EventInstance]] = {}
    company_events: dict[int, list[EventInstance]] = {}
    for inst in instances:
        if inst.scope_type == "market":
            market_events.append(inst)
        elif inst.scope_type == "industry":
            industry_events.setdefault(inst.scope_ref, []).append(inst)
        elif inst.scope_type == "company":
            company_events.setdefault(inst.scope_ref, []).append(inst)

    event_ids = {inst.event_id for inst in instances}
    event_defs: dict[int, MarketEvent] = {}
    if event_ids:
        for me in session.query(MarketEvent).filter(MarketEvent.id.in_(event_ids)).order_by(MarketEvent.id).all():
            event_defs[me.id] = me

    return market_events, industry_events, company_events, event_defs


def _compute_drivers(
    session: Session,
    company: Company,
    state: SimpleNamespace,
    timeline_id: int,
    sim_date: date,
    tick_count: int,
    gauss_beta_m_val: Optional[float] = None,
    gauss_beta_s_val: Optional[float] = None,
    gauss_epsilon_val: Optional[float] = None,
    gauss_eo_val: Optional[float] = None,
) -> Optional[dict]:
    """Compute all 7 driver values and OU pricing inputs for one company.

    Uses pre-batched Gaussian draws (from vectorized np.random.normal calls
    in run_ticks) instead of individual rng.gauss() calls.

    Returns a dict with keys: company_id, y, theta, driver_values (np.ndarray),
    driver_weights (np.ndarray), beta_market, beta_sector, sector_factor, sigma,
    epsilon, intrinsic_value, news_severity.  Returns None if the company has
    invalid pricing data (missing price or intrinsic value).
    """
    prev_close = state.price_overlay.get(company.id)
    if prev_close is None or prev_close <= 0:
        return None
    iv = state.iv_overlay.get(company.id)
    if iv is None or iv <= 0:
        return None

    ind = state.industries.get(company.industry_id)
    if ind is None:  # pragma: no cover — blocked by FK constraint
        return None  # pragma: no cover

    y = np.log(max(prev_close, 0.01) / max(iv, 0.01))
    # market_cap = price * shares_outstanding is re-derived from the
    # timeline-scoped price_overlay here rather than read from
    # company.market_cap (shared/timeline-agnostic cache -- see
    # db/timeline_resolver.py's module docstring).
    _mcap = max(prev_close * float(company.shares_outstanding), 1e6)
    _log_mcap = math.log(_mcap / 1e9)
    theta_base = float(state.params.get("theta_default", 0.05))
    theta = theta_base * (0.3 + 1.2 * (1 + math.tanh(_log_mcap / 2)) / 2)
    # Per-tick multiplicative jitter on beta_market/beta_sector: the seeded betas
    # (db/seeds/seed_companies.py) are fixed constants in a narrow 0.3-2.5 band and
    # ALL positive, so every company feels the same shared f_m/f_s in the same
    # direction each tick, differing only in magnitude -- this was the dominant
    # cause of lockstep phase-wide price action (measured ~62-64% of the 153
    # companies moving the same direction during a single expansion/contraction
    # tick before this fix). BETA_JITTER_STD represents idiosyncratic, day-to-day
    # variation in how sensitive a company "feels" to the macro/sector factor
    # that tick (e.g. differing investor attention, liquidity, hedging flow) --
    # deliberately not large enough to flip sign for most companies (that would
    # defeat the beta ranking itself), just enough to decorrelate magnitude and
    # occasionally flip sign for companies whose beta is already near the
    # macro/sector noise floor.
    beta_m = float(company.beta_market) * (1.0 + (gauss_beta_m_val if gauss_beta_m_val is not None else state.rng.gauss(0, 0.7)))
    beta_s = float(company.beta_sector) * (1.0 + (gauss_beta_s_val if gauss_beta_s_val is not None else state.rng.gauss(0, 0.7)))
    epsilon = gauss_epsilon_val if gauss_epsilon_val is not None else state.rng.gauss(0, 1)
    s_factor = state.sector_shocks.get(company.industry_id, 0.0)

    ind_base_vol = float(ind.base_volatility) / math.sqrt(252)
    mcap = _mcap
    log_mcap = math.log(mcap / 1e9)
    f_size = 1.3 - 0.3 * math.tanh(log_mcap / 1.5)
    sigma_val = ind_base_vol * f_size
    bal = state.latest_bal.get(company.id)
    if bal:
        td = float(bal.total_debt)
        se = float(bal.shareholders_equity)
        if se > 0:
            leverage = td / se
            max_lev = float(state.params.get("vol_max_leverage", 5.0))
            lev_factor = float(state.params.get("vol_leverage_factor", 0.2))
            f_lev = 1.0 + lev_factor * min(leverage, max_lev)
            sigma_val *= f_lev

    vo = value_opportunity(iv, prev_close)
    trailing_closes = state.recent_closes.get(company.id, [])
    moving_avg = sum(trailing_closes) / len(trailing_closes) if trailing_closes else prev_close
    tm = technical_momentum(prev_close, moving_avg, float(state.params.get("k_m", 0.5)))
    # economic_outlook feeds every company the SAME market_sentiment value each
    # tick (weight 0.10) -- at PHASE_SENTIMENT's expansion/contraction magnitude
    # (+-0.3 to +-0.5) this is actually the single largest shared macro term
    # feeding composite_price_pressure, larger than beta_m*f_m itself, so it was
    # a major contributor to lockstep phase-wide moves. ECON_OUTLOOK_JITTER_STD
    # adds small per-company idiosyncratic noise (representing each company's
    # own analysts/investors reading the macro backdrop slightly differently)
    # so 153 companies don't all receive the identical outlook signal, while the
    # jitter is small enough that the population's mean outlook still tracks the
    # phase's true sentiment (preserving the phase's aggregate directional bias).
    eo = compute_economic_outlook(
        state.cycle_state["market_sentiment"] + (gauss_eo_val if gauss_eo_val is not None else state.rng.gauss(0, 0.3))
    )

    latest_inc = state.latest_inc.get(company.id)
    latest_ce = state.latest_ce.get(company.id)
    # Days since the CURRENT quarter's earnings were released, not the
    # absolute sim day -- earnings/guidance are only "fresh" news for the
    # ~QUARTER_LENGTH ticks following a refresh, then the next quarter's
    # results reset the clock. Using tick_count directly made both drivers
    # decay to ~0 permanently after the first quarter and never recover.
    days_since_earnings = tick_count % QUARTER_LENGTH

    es = 0.0
    if latest_inc and latest_ce:
        actual_eps = float(latest_inc.eps)
        consensus_eps = float(latest_ce.consensus_eps)
        es = earnings_surprise(actual_eps, consensus_eps, days_since_earnings, float(state.params.get("earnings_surprise_decay_rate", 0.15)))

    gd = 0.0
    if latest_inc and latest_ce:
        actual_eps = float(latest_inc.eps)
        consensus_eps = float(latest_ce.consensus_eps)
        beat = actual_eps > consensus_eps
        miss = actual_eps < consensus_eps
        if beat:
            gd = guidance("raised", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5), days_since_earnings, float(state.params.get("guidance_decay_rate", 0.15)))
        elif miss:
            gd = guidance("cut", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5), days_since_earnings, float(state.params.get("guidance_decay_rate", 0.15)))

    ib = institutional_buying(state.rng.uniform(-0.1, 0.1) + state.cycle_state.get("market_sentiment", 0) * 0.05)

    ns = 0.0
    active_events = _get_active_events_for_company(
        state.market_events, state.industry_events, state.company_events, state.event_defs,
        company.id, ind.id, state.epoch_start,
    )
    if active_events:
        # market-/industry-scope events resolve ONE shared severity per
        # EventInstance (news_manager.py) and _get_active_events_for_company
        # hands that identical dict to every company in scope (all 153 for a
        # market-scope event) -- without dispersion here, a single market-wide
        # event pushes every affected company's news_severity driver by the
        # exact same amount, another major source of lockstep price action.
        # EVENT_SEVERITY_JITTER_STD adds per-company dispersion (representing
        # how the same news lands differently depending on each company's
        # specific exposure) while its 0 mean keeps the event's average
        # severity across the affected population unchanged.
        active_events = _jitter_event_severities(active_events, state.rng, EVENT_SEVERITY_JITTER_STD)
        ns = news_severity(active_events, tick_count, float(state.params.get("news_decay_rate", 0.1)))

    driver_values = {
        "value_opportunity": vo,
        "earnings_surprise": es,
        "news_severity": ns,
        "economic_outlook": eo,
        "guidance": gd,
        "technical_momentum": tm,
        "institutional_buying": ib,
    }

    if active_events:
        for event_data in active_events:
            # Event templates (db/seeds/seed_events.py) intentionally mix daily
            # price-driver keys (news_severity, guidance, ...) with long-term
            # factor-score keys (financial_quality, moat_score, ...) in one
            # effect_profile — a single event affects both. apply_effect_to_drivers
            # must only ever see the driver-domain subset: passing the raw
            # profile through corrupted driver_values with keys drv_weights has
            # no entry for (e.g. "financial_quality"), crashing
            # composite_price_pressure with a KeyError on any tick where such an
            # event is active. The factor-score keys are separately consumed by
            # apply_effect_to_factor_scores at the quarter-boundary refresh.
            effect_profile = {
                k: v for k, v in event_data.get("effect_profile", {}).items() if k in DRIVER_KEYS
            }
            if effect_profile:
                severity = event_data.get("severity", 0.0)
                decay_rate = event_data.get("decay_rate", 0.1)
                start_day = event_data.get("start_day", 0)
                days_elapsed = tick_count - start_day
                driver_effects = {k: v for k, v in effect_profile.items() if k in DRIVER_KEYS}
                if driver_effects:
                    driver_values = apply_effect_to_drivers(
                        driver_values, driver_effects, severity, decay_rate, days_elapsed,
                    )

    # Future Lab (Section 11.2) structural overrides realized as driver_bias:
    # additive deltas layered on top of the normally-computed driver values,
    # applied after event effects and before clamping/weighting -- never a
    # pinned replacement, since these 7 values are recomputed fresh every
    # tick (see engine/overrides.py's module docstring). Company-scoped bias
    # (target_scope_id = a company id) stacks with a market-wide bias
    # (target_scope_id = None), matching how event scoping already layers.
    if state.driver_bias_map:
        market_bias = state.driver_bias_map.get(None, {})
        company_bias = state.driver_bias_map.get(company.id, {})
        combined_bias = {**market_bias}
        for key, delta in company_bias.items():
            combined_bias[key] = combined_bias.get(key, 0.0) + delta
        if combined_bias:
            driver_values = apply_driver_bias(driver_values, combined_bias)

    drv_weights = {
        "value_opportunity": float(state.params.get("w_vo", 0.10)),
        "earnings_surprise": float(state.params.get("w_es", 0.15)),
        "news_severity": float(state.params.get("w_ns", 0.25)),
        "economic_outlook": float(state.params.get("w_eo", 0.25)),
        "guidance": float(state.params.get("w_g", 0.15)),
        "technical_momentum": float(state.params.get("w_tm", 0.10)),
        "institutional_buying": float(state.params.get("w_ib", 0.15)),
    }

    return {
        "company_id": company.id,
        "y": y,
        "theta": theta,
        "driver_values": driver_values,
        "driver_weights": drv_weights,
        "beta_market": beta_m,
        "beta_sector": beta_s,
        "sector_factor": s_factor,
        "sigma": sigma_val,
        "epsilon": epsilon,
        "intrinsic_value": iv,
        "news_severity": driver_values.get("news_severity", ns),
    }


def _update_prices_and_ohlc(
    companies: list[Company],
    company_by_id: dict[int, Company],
    tick_result: TickResult,
    params: dict[str, float],
    prev_ns: dict[int, float],
    company_ns: dict[int, float],
    rng: random.Random,
    tick_count: int,
    price_overlay: dict[int, float],
    gauss_open_arr: Optional[np.ndarray] = None,
    gauss_vol_arr: Optional[np.ndarray] = None,
) -> tuple[dict[int, dict], dict[int, int], dict[int, float]]:
    """Apply circuit breaker, synthesize OHLC, and compute volume for each company.

    Circuit breaker is vectorized via numpy clip. Per-company loop is kept only
    for the rng-dependent synthesise_ohlc calls (using pre-batched gaussian draws
    from gauss_open_arr/gauss_vol_arr) and volume/order-imbalance computation.

    `price_overlay` is this timeline's actual latest price per company (see
    _load_tick_state), not company.current_price -- which may belong to a
    different timeline's most recent tick.

    Returns (ohlc_results, volume_results, imbalance_results) keyed by company_id.
    """
    r_cap = float(params.get("r_cap", 0.20))
    intraday_vol = float(params.get("intraday_volatility", 0.015))

    ohlc_results: dict[int, dict] = {}
    volume_results: dict[int, int] = {}
    imbalance_results: dict[int, float] = {}

    # Vectorize circuit breaker with numpy
    n_out = len(tick_result.outputs)
    if n_out == 0:
        return ohlc_results, volume_results, imbalance_results

    prev_closes = np.array([price_overlay.get(out.company_id, 100.0) for out in tick_result.outputs], dtype=float)
    raw_prices = np.array([out.price for out in tick_result.outputs], dtype=float)
    # Vectorized circuit breaker: |r| <= r_cap
    returns = (raw_prices - prev_closes) / np.maximum(prev_closes, 0.01)
    clipped_returns = np.clip(returns, -r_cap, r_cap)
    cb_prices = prev_closes * (1.0 + clipped_returns)
    cb_prices = np.maximum(cb_prices, 0.01)

    for i, out in enumerate(tick_result.outputs):
        cid = out.company_id
        prev_close = float(prev_closes[i])
        cb_price = float(cb_prices[i])

        # Use pre-batched gauss draws for OHLC synthesis
        open_pert = gauss_open_arr[i] if gauss_open_arr is not None else rng.gauss(0, intraday_vol / 2)
        o = prev_close * (1.0 + open_pert)
        # Use gauss_epsilon (N(0,1)) as the intraday range w draw
        w_val = gauss_open_arr[i] if gauss_open_arr is not None else rng.gauss(0, 1)
        w_val = float(w_val)
        half_range = abs(w_val) * intraday_vol
        h = max(o, cb_price) * (1 + half_range)
        l = min(o, cb_price) * (1 - half_range)
        ohlc = {
            "open": max(0.01, round(o, 4)),
            "high": max(0.01, round(h, 4)),
            "low": max(0.01, round(l, 4)),
            "close": max(0.01, round(cb_price, 4)),
        }

        company = company_by_id.get(cid)
        free_float = float(company.free_float_pct) if company else 0.5
        mcap = max(prev_close * float(company.shares_outstanding), 1e6) if company else 1e9

        abs_return = abs(cb_price - prev_close) / max(prev_close, 0.01)
        ns_now = company_ns.get(cid, 0.0)
        ns_prev = prev_ns.get(cid, 0.0)
        ns_delta = abs(ns_now - ns_prev)
        is_earnings_day = False
        if tick_count > 5:
            is_earnings_day = (tick_count % QUARTER_LENGTH) == 0

        # Volume uses pre-batched gauss_vol for noise
        vol_noise = gauss_vol_arr[i] if gauss_vol_arr is not None else rng.gauss(0, 0.1)
        base_vol = mcap * free_float * float(params.get("vol_turnover_rate", 0.001))
        multiplier = 1.0 + float(params.get("vol_coeff_return", 0.5)) * abs_return + float(params.get("vol_coeff_news", 0.3)) * ns_delta
        if is_earnings_day:
            multiplier += float(params.get("vol_coeff_earnings", 0.2))
        multiplier *= math.exp(vol_noise)
        vol = int(base_vol * multiplier)
        vol = max(1000, vol)

        sens = float(params.get("liquidity_sensitivity", 0.5))
        demand = demand_from_pressure(mcap * 0.001, out.price_pressure, sens)
        supply = supply_from_pressure(mcap * 0.001, out.price_pressure, sens)
        imb = order_imbalance(demand, supply)

        ohlc_results[cid] = ohlc
        volume_results[cid] = vol
        imbalance_results[cid] = imb

    return ohlc_results, volume_results, imbalance_results


def _write_tick_results(
    session: Session,
    timeline_id: int,
    sim_date: date,
    company_by_id: dict[int, Company],
    tick_inputs: tuple[CompanyTickInput, ...],
    tick_result: TickResult,
    ohlc_results: dict[int, dict],
    volume_results: dict[int, int],
    imbalance_results: dict[int, float],
) -> None:
    """Write PriceHistory and PriceDriverScore rows for all companies.

    Bulk-inserted via two `session.execute(insert(...), rows)` calls instead
    of one ORM `session.add()` per row (previously ~150 PriceHistory +
    ~1,050 PriceDriverScore individually-tracked inserts per tick) — these
    are pure append-only historical facts, never re-read later in the same
    tick, so per-object ORM identity tracking buys nothing here and was a
    meaningful share of a tick's cost at 150 companies.
    """
    tick_input_by_id = {inp.company_id: inp for inp in tick_inputs}

    price_history_rows: list[dict] = []
    driver_score_rows: list[dict] = []

    for out in tick_result.outputs:
        cid = out.company_id
        ohlc = ohlc_results[cid]
        vol_val = volume_results[cid]
        imb = imbalance_results[cid]
        # This timeline's own IV for the tick just computed (sourced from
        # state.iv_overlay via _compute_drivers), not company_by_id[cid]
        # .intrinsic_value -- which may belong to a different timeline's
        # last write (see db/timeline_resolver.py).
        iv = float(tick_input_by_id[cid].intrinsic_value)

        price_history_rows.append(dict(
            timeline_id=timeline_id,
            company_id=cid,
            sim_date=sim_date,
            open=ohlc["open"],
            high=ohlc["high"],
            low=ohlc["low"],
            close=ohlc["close"],
            volume=vol_val,
            intrinsic_value=iv,
            order_imbalance=imb,
        ))

        inp = tick_input_by_id[cid]
        total_pressure = composite_price_pressure(inp.driver_values, inp.driver_weights)
        for drv_key, drv_val in inp.driver_values.items():
            drv_w = inp.driver_weights.get(drv_key, 0.0)
            raw_contribution = drv_w * drv_val / max(abs(total_pressure), 1e-10)
            contribution = round(max(-1.0, min(1.0, raw_contribution)), 6)
            driver_score_rows.append(dict(
                timeline_id=timeline_id,
                company_id=cid,
                sim_date=sim_date,
                driver_key=drv_key,
                value=round(drv_val, 6),
                weight=round(drv_w, 6),
                contribution=contribution,
            ))

    if price_history_rows:
        session.execute(insert(PriceHistory), price_history_rows)
    if driver_score_rows:
        session.execute(insert(PriceDriverScore), driver_score_rows)


def _update_denormalized_fields(
    company_by_id: dict[int, Company],
    ohlc_results: dict[int, dict],
    volume_results: dict[int, int],
    tick_result: TickResult,
    company_sigma: dict[int, float],
    is_live: bool,
) -> None:
    """Update Company.current_price, .intrinsic_value, .market_cap, .market_liquidity_score, .volatility.

    These are a single shared, timeline-agnostic cache -- only the live
    timeline is allowed to persist its tick result here (`is_live`). A
    non-live (Future Lab branch) timeline's per-tick price/IV/liquidity is
    already durably captured in that timeline's own PriceHistory row
    (_write_tick_results) and CompanyFactorScore row; writing it here too
    would let a branch's fast-forward job silently overwrite the live
    market's displayed price and the price live trades execute against (see
    db/timeline_resolver.py's module docstring for the read-side half of
    this fix). No-op for non-live timelines rather than raising, since every
    tick still needs OHLC/volume computed regardless of which timeline it's
    for -- only the persistence step is gated.
    """
    if not is_live:
        return
    for out in tick_result.outputs:
        cid = out.company_id
        ohlc = ohlc_results[cid]
        vol_val = volume_results[cid]
        company = company_by_id[cid]
        iv = float(company.intrinsic_value)
        company.current_price = round(ohlc["close"], 4)
        company.intrinsic_value = round(iv, 4)
        company.market_cap = round(ohlc["close"] * float(company.shares_outstanding), 2)
        liq_score = market_liquidity_score(
            float(company.free_float_pct), vol_val, float(company.market_cap or 1e9),
        )
        company.market_liquidity_score = round(liq_score, 4)
        sigma_val = company_sigma.get(cid)
        if sigma_val is not None:
            # sigma_val is the engine's real per-company/per-tick DAILY volatility
            # (industry base vol scaled by company size/leverage). Company.volatility
            # is displayed/filtered everywhere as an annualized percentage (e.g. "25.00%"
            # for a 25% annualized vol) -- the same units industry.base_volatility itself
            # is defined in (see seed_industries.py) -- so annualize and convert to a
            # percent-scale number here rather than storing the raw daily fraction.
            annualized_pct = float(sigma_val) * math.sqrt(TRADING_DAYS_PER_YEAR) * 100.0
            company.volatility = round(annualized_pct, 4)


def _execute_events(
    session: Session,
    timeline_id: int,
    state: SimpleNamespace,
    sim_date: date,
    companies: list[Company],
) -> None:
    """Select and fire probabilistic events, generate news, apply factor score effects."""
    company_ids_list = [c.id for c in companies]
    industry_ids_list = [ind.id for ind in state.industries.values()]
    fired_events = select_and_fire_events(
        session, timeline_id, sim_date, state.rng, company_ids_list, industry_ids_list,
        is_quarter_boundary=state.is_quarter_boundary,
    )
    # The app's session factory runs with autoflush=False (apps/api/database.py),
    # so the newly session.add()-ed EventInstance rows above are not yet visible
    # to a plain query. Without this flush, every re-query below (here and in
    # _apply_event_factor_effects) silently returns empty — no news ever
    # generated, no event effects ever applied to factor scores/IV, despite
    # events firing correctly.
    session.flush()
    # Batch company/industry lookups instead of one query per EventInstance
    # (SPEED.md #3) -- `companies`/`state.industries` already hold every
    # company/industry for this tick, so scope_ref resolution is a dict
    # lookup. A representative company per industry (the "industry-scope
    # template refers to {company}" fallback) is also precomputed once.
    company_by_id = {c.id: c for c in companies}
    representative_company_by_industry: dict[int, Company] = {}
    for c in companies:
        representative_company_by_industry.setdefault(c.industry_id, c)

    # Batch-load all EventInstance rows for the just-fired events in a single
    # query (SPEED.md #9) instead of one query per fired event.
    batch_event_ids = [ev.id for ev in fired_events]
    batched_instances: dict[int, list[EventInstance]] = {}
    if batch_event_ids:
        for ei in session.query(EventInstance).filter(
            EventInstance.event_id.in_(batch_event_ids),
            EventInstance.timeline_id == timeline_id,
            EventInstance.sim_date == sim_date,
        ).order_by(EventInstance.id).all():
            batched_instances.setdefault(ei.event_id, []).append(ei)

    for ev in fired_events:
        event_def = state.event_defs.get(ev.id)
        for ei in batched_instances.get(ev.id, []):
            company_name = None
            industry_name = None
            extra_replacements: dict[str, str] = {}
            if ei.scope_type == "company":
                comp = company_by_id.get(ei.scope_ref)
                if comp:
                    company_name = comp.name
                # "{eps}"/"{consensus}" in the earnings templates need real
                # figures, not the literal placeholder text — reuse the same
                # latest_inc/latest_ce lookups _compute_drivers already does.
                if ev.category == "earnings":
                    latest_inc = state.latest_inc.get(ei.scope_ref)
                    latest_ce = state.latest_ce.get(ei.scope_ref)
                    if latest_inc is not None:
                        extra_replacements["{eps}"] = f"${float(latest_inc.eps):.2f}"
                    if latest_ce is not None:
                        extra_replacements["{consensus}"] = f"${float(latest_ce.consensus_eps):.2f}"
            elif ei.scope_type == "industry":
                ind = state.industries.get(ei.scope_ref)
                if ind:
                    industry_name = ind.name
                # Industry-scope templates sometimes reference {company}. Use
                # a representative company from that industry as the fallback.
                if company_name is None:
                    rep_co = representative_company_by_industry.get(ei.scope_ref)
                    if rep_co:
                        company_name = rep_co.name
            generate_news(session, timeline_id, sim_date, ei, state.rng,
                          company_name=company_name, industry_name=industry_name,
                          extra_replacements=extra_replacements, event_def=event_def)

    _apply_event_factor_effects(
        session, companies, sim_date, timeline_id,
        state.params, state.neutral_industry_pegs, state.industries, state.timeline.is_live,
    )

    if state.factor_score_bias_map:
        _apply_timeline_factor_score_overrides(
            session, companies, timeline_id, state.factor_score_bias_map,
            state.params, state.neutral_industry_pegs, state.latest_inc, state.timeline.is_live,
        )


def _apply_timeline_factor_score_overrides(
    session: Session,
    companies: list[Company],
    timeline_id: int,
    factor_score_bias_map: dict,
    params: dict[str, float],
    neutral_industry_pegs: dict[int, float],
    latest_inc_by_company: dict,
    is_live: bool,
) -> None:
    """Future Lab (Section 11.2) -- apply a flat additive factor_score
    override on top of each affected company's *natural* (un-overridden)
    factor scores for this tick, then recompute IntrinsicScore/FairPE/IV so
    the override actually shows up in price, not just in the stored factor
    row.

    This is a non-decaying nudge, re-applied at the same fixed magnitude
    every tick it's active -- appropriate for a user-authored branch override
    (e.g. "Severe Recession" backing financial_quality down 15 points for
    leverage-heavy industries), not a firing news event. Naively reading
    `getattr(cfs, key)` as "current value" and writing the nudged result back
    would compound: since this runs unconditionally every tick (not just on
    quarter boundaries when CompanyFactorScore is otherwise refreshed), each
    tick would nudge an already-nudged value, turning a flat -15 into -15*N
    after N ticks. Instead this mirrors _apply_factor_effects_to_company's
    base-plus-delta pattern: management_quality/growth_potential/fcf_quality
    recompute from their *_base snapshot (never itself mutated by overrides),
    and moat_score/financial_quality recompute fresh from their MoatSubscore/
    FinancialQualitySubscore rows (their real source of truth) -- so the
    override delta is always added on top of the same undecayed anchor, not
    on top of yesterday's already-overridden result.
    """
    company_map = {c.id: c for c in companies}
    market_bias = factor_score_bias_map.get(None, {})
    affected_ids = set(factor_score_bias_map.keys()) - {None}
    if market_bias:
        affected_ids |= set(company_map.keys())

    if not affected_ids:
        return

    batch = _load_factor_effect_batch(session, timeline_id, affected_ids)

    for cid in affected_ids:
        cfs = batch.latest_cfs_by_company.get(cid)
        company = company_map.get(cid)
        if cfs is None or company is None:
            continue

        bias = {**market_bias, **factor_score_bias_map.get(cid, {})}

        moat_rows = batch.moat_rows_by_company.get(cid, [])
        moat_weights = batch.moat_weights
        weighted_subfactors = {
            ms.subfactor_key: float(ms.score) for ms in moat_rows if ms.subfactor_key in moat_weights
        }
        # No subscore rows to re-derive from (legacy/edge-case row) -- fall
        # back to the immutable moat_score_base anchor rather than the
        # current (possibly already-overridden) moat_score column.
        natural_moat = (
            moat_composite(weighted_subfactors, moat_weights)
            if weighted_subfactors
            else float(cfs.moat_score_base) if cfs.moat_score_base is not None
            else float(cfs.moat_score)
        )

        fq_subs = {fs.subfactor_key: float(fs.subscore) for fs in batch.fq_subs_by_company.get(cid, [])}
        ind_pw = batch.industry_pw.get(company.industry_id, {})
        natural_fq = (
            financial_quality_composite(fq_subs, ind_pw, batch.subfactor_pillar)
            if fq_subs
            else float(cfs.financial_quality_base) if cfs.financial_quality_base is not None
            else float(cfs.financial_quality)
        )

        if cfs.moat_score_base is None:
            cfs.moat_score_base = round(float(cfs.moat_score), 4)
        if cfs.financial_quality_base is None:
            cfs.financial_quality_base = round(float(cfs.financial_quality), 4)

        natural = {
            "management_quality": (
                float(cfs.management_quality_base) if cfs.management_quality_base is not None
                else float(cfs.management_quality)
            ),
            "moat_score": natural_moat,
            "financial_quality": natural_fq,
            "fcf_quality": (
                float(cfs.fcf_quality_base) if cfs.fcf_quality_base is not None else float(cfs.fcf_quality)
            ),
            "growth_potential": (
                float(cfs.growth_potential_base) if cfs.growth_potential_base is not None
                else float(cfs.growth_potential)
            ),
        }

        for key, delta in bias.items():
            natural[key] = max(0.0, min(100.0, natural[key] + delta))

        cfs.management_quality = round(natural["management_quality"], 4)
        cfs.moat_score = round(natural["moat_score"], 4)
        cfs.financial_quality = round(natural["financial_quality"], 4)
        cfs.fcf_quality = round(natural["fcf_quality"], 4)
        cfs.growth_potential = round(natural["growth_potential"], 4)

        iscore = compute_intrinsic_score(
            natural["management_quality"], natural["moat_score"],
            natural["financial_quality"], natural["fcf_quality"], natural["growth_potential"],
        )
        latest_inc = latest_inc_by_company.get(cid)
        eps_val = float(latest_inc.eps) if latest_inc else 0.0
        fpe, iv = _recompute_valuation(
            iscore, natural["growth_potential"], company.industry_id, neutral_industry_pegs, params, eps_val,
        )
        cfs.intrinsic_score = round(iscore, 4)
        cfs.fair_pe = round(fpe, 4)
        cfs.intrinsic_value = round(iv, 4)

        if is_live:
            company.intrinsic_score = round(iscore, 4)
            company.fair_pe = round(fpe, 4)
            company.intrinsic_value = round(iv, 4)


def _load_params(session: Session) -> dict[str, float]:
    # Only global-scope rows: industry-scoped params like neutral_industry_peg
    # share the same key across all 15 industries, so folding them into this
    # flat dict would silently overwrite each other. Load those separately
    # via _load_neutral_industry_pegs.
    rows = session.query(ConfigParameter).filter_by(scope="global").all()
    result: dict[str, float] = {}
    for p in rows:
        try:
            result[p.key] = float(p.value)
        except ValueError:
            pass
    return result


def _load_neutral_industry_pegs(session: Session) -> dict[int, float]:
    """{industry_id: neutral_industry_peg} — Section 6.D PEG-based valuation."""
    rows = session.query(ConfigParameter).filter_by(
        key="neutral_industry_peg", scope="industry",
    ).all()
    return {p.scope_id: float(p.value) for p in rows}


def _recompute_valuation(
    intrinsic_score: float,
    growth_potential: float,
    industry_id: int,
    neutral_industry_pegs: dict[int, float],
    params: dict[str, float],
    eps: float,
) -> tuple[float, float]:
    """Section 6.D — IntrinsicScore -> M(S) -> Fair PEG -> Fair P/E -> IV.

    Single shared implementation of the PEG valuation chain so
    _refresh_fundamentals, _apply_factor_effects_to_company, and the initial
    seed (db/seeds/seed_initial_prices.py) don't each hand-roll their own
    copy of the same six lines with the risk of the defaults or param keys
    drifting apart between copies. Returns (fair_pe, intrinsic_value).
    """
    m_min = float(params.get("quality_mult_min", DEFAULT_M_MIN))
    m_max = float(params.get("quality_mult_max", DEFAULT_M_MAX))
    m_k = float(params.get("quality_mult_k", DEFAULT_M_STEEPNESS))
    m_c = float(params.get("quality_mult_inflection", DEFAULT_M_INFLECTION))
    growth_rate_min = float(params.get("growth_rate_min", DEFAULT_GROWTH_RATE_MIN))
    growth_rate_max = float(params.get("growth_rate_max", DEFAULT_GROWTH_RATE_MAX))

    neutral_peg = neutral_industry_pegs.get(industry_id, 1.0)
    peg = fair_peg(neutral_peg, intrinsic_score, m_min, m_max, m_k, m_c)
    growth_rate_pct = growth_score_to_rate(growth_potential, growth_rate_min, growth_rate_max)
    baseline_pe = float(params.get("fair_pe_baseline", DEFAULT_BASELINE_PE))
    fpe = fair_pe_from_peg(peg, growth_rate_pct, baseline_pe)
    iv = intrinsic_value_per_share(fpe, eps)
    return fpe, iv


def _refresh_fundamentals(
    session: Session,
    timeline_id: int,
    companies: list[Company],
    industries: dict[int, Industry],
    params: dict[str, float],
    neutral_industry_pegs: dict[int, float],
    now: datetime,
    rng: random.Random,
    tick_count: int,
    sim_date: date,
    is_live: bool = True,
) -> None:
    """Section 6.F -- generate new financial statements and recompute FQ/IV at quarter boundary.

    `is_live` gates the Company.intrinsic_value/.intrinsic_score/.fair_pe
    write below the same way _update_denormalized_fields gates price -- only
    the live timeline is allowed to overwrite that shared, timeline-agnostic
    cache. A non-live timeline's quarter-boundary IV is still fully captured
    in this quarter's CompanyFactorScore row (now timeline_id-scoped, see
    migration 0015), which is the actual source of truth _compute_drivers
    and the next tick's iv_overlay read from.
    """
    pw_rows = session.query(IndustryPillarWeight).order_by(IndustryPillarWeight.id).all()
    industry_pw: dict[int, dict[str, float]] = {}
    for pw in pw_rows:
        industry_pw.setdefault(pw.industry_id, {})[pw.pillar] = float(pw.weight)

    fq_defs = session.query(FactorDefinition).filter_by(factor_type="fq_sub").order_by(FactorDefinition.id).all()
    subfactor_pillar = {fd.key: fd.pillar for fd in fq_defs}
    fq_directions = {fd.key: fd.direction for fd in fq_defs}
    fq_keys = [fd.key for fd in fq_defs]

    moat_defs = session.query(FactorDefinition).filter_by(factor_type="moat_sub").order_by(FactorDefinition.id).all()
    moat_weights = {md.key: float(md.default_weight) for md in moat_defs if md.default_weight}

    moat_scores: dict[int, dict[str, float]] = {}
    for ms in session.query(MoatSubscore).filter_by(timeline_id=timeline_id).order_by(MoatSubscore.id).all():
        moat_scores.setdefault(ms.company_id, {})[ms.subfactor_key] = float(ms.score)

    latest_period = _compute_fiscal_period(tick_count)

    # Carry forward each company's existing management_quality/growth_potential/
    # fcf_quality rather than re-rolling them from scratch every quarter.
    # These are meant to be stable qualitative attributes (set at seed time,
    # nudged only by explicit events) -- previously this function replaced
    # them with fresh rng.uniform(30,85) draws every 63 ticks, discarding the
    # seeded values and causing every company's IntrinsicScore (and hence
    # FairPE/IV, since growth_potential drives growth_score_to_rate) to lurch
    # randomly at each quarter boundary for reasons unrelated to its
    # financials.
    latest_cfs_by_company: dict[int, CompanyFactorScore] = {}
    for cfs_row in session.query(CompanyFactorScore).filter_by(timeline_id=timeline_id).order_by(
        CompanyFactorScore.id.asc()
    ).all():
        latest_cfs_by_company[cfs_row.company_id] = cfs_row

    # Full financial_quality *history* (not just the latest row) per company,
    # ordered oldest -> newest by fiscal_period, so the generator below can
    # detect an improving/declining FQ trend rather than only seeing the
    # single most-recent value. Kept separate from latest_cfs_by_company
    # (which intentionally only tracks the newest row per company) to avoid
    # changing that dict's existing semantics.
    fq_history_by_company: dict[int, list[float]] = {}
    for cfs_row in session.query(CompanyFactorScore).filter_by(timeline_id=timeline_id).order_by(
        CompanyFactorScore.company_id.asc(), CompanyFactorScore.fiscal_period.asc()
    ).all():
        fq_history_by_company.setdefault(cfs_row.company_id, []).append(float(cfs_row.financial_quality))

    all_incomes_by_company: dict[int, list[IncomeStatement]] = {}
    for inc_row in session.query(IncomeStatement).filter_by(timeline_id=timeline_id).order_by(
        IncomeStatement.fiscal_period.asc()
    ).all():
        all_incomes_by_company.setdefault(inc_row.company_id, []).append(inc_row)

    # Quarter-over-quarter price return per company, used only as a small
    # stabilizing nudge (see _generate_fake_quarterly_financials) -- price is
    # meant to be an OUTPUT of financials, not a driver, so this is
    # deliberately queried once here (not re-derived per-tick) and capped
    # tightly downstream. Looks up the close nearest the start of the
    # just-completed quarter (QUARTER_LENGTH trading days back) and the most
    # recent close before/at sim_date.
    quarter_start_date = sim_date - timedelta(days=QUARTER_LENGTH * 2)
    price_return_by_company: dict[int, float] = {}
    company_ids_for_price = [c.id for c in companies]
    if company_ids_for_price:
        recent_prices = session.query(PriceHistory).filter(
            PriceHistory.timeline_id == timeline_id,
            PriceHistory.company_id.in_(company_ids_for_price),
            PriceHistory.sim_date <= sim_date,
            PriceHistory.sim_date >= quarter_start_date,
        ).order_by(PriceHistory.company_id.asc(), PriceHistory.sim_date.asc()).all()
        prices_by_company: dict[int, list[PriceHistory]] = {}
        for ph in recent_prices:
            prices_by_company.setdefault(ph.company_id, []).append(ph)
        for cid, rows in prices_by_company.items():
            if len(rows) >= 2:
                start_close = float(rows[0].close)
                end_close = float(rows[-1].close)
                if start_close > 0:
                    price_return_by_company[cid] = (end_close - start_close) / start_close

    # Aggregate company- and industry-scoped event effect deltas that fired
    # during the just-completed quarter (approximated as the last
    # QUARTER_LENGTH calendar days, since ticks map ~1:1 to business days and
    # EventInstance.sim_date is a calendar date) so a company's reported
    # quarter reflects "what actually happened" news-wise, not just a random
    # walk. Only the revenue-relevant and margin-relevant effect_profile keys
    # are summed; unrelated keys (e.g. pure price/driver-only effects with no
    # analogous factor-score key) are ignored here since they have no
    # sensible financial-statement mapping.
    quarter_events_start = sim_date - timedelta(days=QUARTER_LENGTH * 2)
    event_rows: list[EventInstance] = []
    if company_ids_for_price:
        event_rows = session.query(EventInstance).filter(
            EventInstance.timeline_id == timeline_id,
            EventInstance.sim_date >= quarter_events_start,
            EventInstance.sim_date <= sim_date,
            EventInstance.scope_type.in_(["company", "industry"]),
        ).all()
    event_sentiment_by_company: dict[int, float] = {}
    event_sentiment_by_industry: dict[int, float] = {}
    for ei in event_rows:
        # applied_effects is the already severity/decay-scaled delta dict
        # recorded at fire time (see engine.events.apply_effect_to_factor_scores
        # and _apply_event_factor_effects below) -- summing its values gives a
        # rough "net positive/negative impact" scalar per event without
        # needing to re-derive severity*decay here.
        net = sum(float(v) for v in (ei.applied_effects or {}).values())
        if ei.scope_type == "company":
            event_sentiment_by_company[ei.scope_ref] = event_sentiment_by_company.get(ei.scope_ref, 0.0) + net
        elif ei.scope_type == "industry":
            event_sentiment_by_industry[ei.scope_ref] = event_sentiment_by_industry.get(ei.scope_ref, 0.0) + net

    # Prior-quarter con-call guidance signal. If the ConCall model (built by a
    # parallel workstream) isn't importable/queryable yet in this working
    # tree, this degrades to a neutral 0.0 delta for every company rather than
    # blocking fundamentals generation -- see _load_concall_guidance_signal.
    guidance_signal_by_company: dict[int, float] = _load_concall_guidance_signal(
        session, [c.id for c in companies], latest_period,
    )
    extended_signal_by_company: dict[int, dict[str, float]] = _load_concall_extended_signals(
        session, [c.id for c in companies], latest_period,
    )

    # Batch the "does this company's quarter already exist" idempotency
    # check (SPEED.md #7/1.4) into 3 IN (...) queries covering every company
    # at once, instead of _generate_fake_quarterly_financials issuing 3
    # queries per company (~450 queries at 150 companies). Same three-table
    # check as before -- see that function's docstring for why all three
    # must agree before a company's quarter is treated as already-refreshed.
    company_ids_for_refresh = [c.id for c in companies]
    inc_exists_ids = {
        row[0] for row in session.query(IncomeStatement.company_id).filter(
            IncomeStatement.timeline_id == timeline_id,
            IncomeStatement.fiscal_period == latest_period,
            IncomeStatement.company_id.in_(company_ids_for_refresh),
        ).all()
    }
    bal_exists_ids = {
        row[0] for row in session.query(BalanceSheet.company_id).filter(
            BalanceSheet.timeline_id == timeline_id,
            BalanceSheet.fiscal_period == latest_period,
            BalanceSheet.company_id.in_(company_ids_for_refresh),
        ).all()
    }
    cf_exists_ids = {
        row[0] for row in session.query(CashFlowStatement.company_id).filter(
            CashFlowStatement.timeline_id == timeline_id,
            CashFlowStatement.fiscal_period == latest_period,
            CashFlowStatement.company_id.in_(company_ids_for_refresh),
        ).all()
    }
    already_refreshed_ids = inc_exists_ids & bal_exists_ids & cf_exists_ids

    company_rows = []
    for company in companies:
        prior_cfs_for_mgmt = latest_cfs_by_company.get(company.id)
        if prior_cfs_for_mgmt is not None and prior_cfs_for_mgmt.management_quality_base is not None:
            mgmt_quality_signal = float(prior_cfs_for_mgmt.management_quality_base)
        elif prior_cfs_for_mgmt is not None:
            mgmt_quality_signal = float(prior_cfs_for_mgmt.management_quality)
        else:
            mgmt_quality_signal = 50.0
        extended_signal = extended_signal_by_company.get(company.id, {})
        raw = _generate_fake_quarterly_financials(
            session, timeline_id, company, latest_period, rng,
            management_quality=mgmt_quality_signal,
            fq_history=fq_history_by_company.get(company.id, []),
            price_return_qtr=price_return_by_company.get(company.id, 0.0),
            already_refreshed=company.id in already_refreshed_ids,
            event_sentiment=event_sentiment_by_company.get(company.id, 0.0)
                + event_sentiment_by_industry.get(company.industry_id, 0.0),
            guidance_signal=guidance_signal_by_company.get(company.id, 0.0),
            concall_margin_bias=extended_signal.get("margin_bias", 0.0),
            concall_capex_bias=extended_signal.get("capex_bias", 0.0),
            concall_debt_bias=extended_signal.get("debt_bias", 0.0),
        )
        company_rows.append(dict(company=company, raw=raw, fq_subscores={}, fq_percentiles={}))

    fq_percentiles: dict[str, np.ndarray] = {}
    for key in fq_keys:
        relevant = [r for r in company_rows if key in r["raw"]]
        if not relevant:
            continue
        vals = np.array([_safe_finite(r["raw"][key]) for r in relevant])
        lower = fq_directions.get(key, "higher_better") == "lower_better"
        scores = percentile_rank_scores(vals, lower_is_better=lower)
        fq_percentiles[key] = scores
        score_idx = 0
        for r in company_rows:
            if key in r["raw"]:
                r["fq_subscores"][key] = float(scores[score_idx])
                r["fq_percentiles"][key] = float(scores[score_idx])
                score_idx += 1

    for r in company_rows:
        company = r["company"]
        ind = industries.get(company.industry_id)
        if ind is None:  # pragma: no cover — blocked by FK constraint
            continue  # pragma: no cover

        ind_pw = industry_pw.get(company.industry_id, {})
        fq = financial_quality_composite(r["fq_subscores"], ind_pw, subfactor_pillar)
        moat_val = moat_composite(moat_scores.get(company.id, {}), moat_weights)
        prior_cfs = latest_cfs_by_company.get(company.id)
# Carry forward management and FCF quality from *_base snapshot (not
        # the event-mutated effective column), but derive growth_potential
        # afresh from trailing financials each quarter.
        mgmt_base = float(prior_cfs.management_quality_base) if prior_cfs and prior_cfs.management_quality_base is not None else (float(prior_cfs.management_quality) if prior_cfs else 50.0)
        fcfq_base = float(prior_cfs.fcf_quality_base) if prior_cfs and prior_cfs.fcf_quality_base is not None else (float(prior_cfs.fcf_quality) if prior_cfs else 50.0)
        growth_rate_min = float(params.get("growth_rate_min", DEFAULT_GROWTH_RATE_MIN))
        growth_rate_max = float(params.get("growth_rate_max", DEFAULT_GROWTH_RATE_MAX))
        company_incs = all_incomes_by_company.get(company.id, [])
        growth = compute_growth_potential_from_financials(company_incs, growth_rate_min, growth_rate_max)
        iscore = compute_intrinsic_score(mgmt_base, moat_val, fq, fcfq_base, growth)

        eps_val = float(r["raw"].get("eps", 0.0))
        fpe, iv = _recompute_valuation(
            iscore, growth, company.industry_id, neutral_industry_pegs, params, eps_val,
        )

        if is_live:
            company.intrinsic_value = round(iv, 4)
            company.intrinsic_score = round(iscore, 4)
            company.fair_pe = round(fpe, 4)

        # Idempotency guards against re-crossing the same quarter boundary
        # (a retried advance call, or — as found live — leftover partial data
        # from a request that crashed for an unrelated reason after some but
        # not all rows for this period were flushed): check each row
        # individually rather than gating on a single "already has this
        # period" signal, since a prior partial write can leave some rows for
        # a (company_id, fiscal_period) present without others.
        existing_cfs = session.query(CompanyFactorScore).filter_by(
            company_id=company.id, fiscal_period=latest_period, timeline_id=timeline_id,
        ).first()
        if existing_cfs is None:
            cfs = CompanyFactorScore(
                company_id=company.id,
                timeline_id=timeline_id,
                fiscal_period=latest_period,
                management_quality=round(mgmt_base, 4),
                moat_score=round(moat_val, 4),
                financial_quality=round(fq, 4),
                fcf_quality=round(fcfq_base, 4),
                growth_potential=round(growth, 4),
                management_quality_base=round(mgmt_base, 4),
                growth_potential_base=round(growth, 4),
                fcf_quality_base=round(fcfq_base, 4),
                intrinsic_score=round(iscore, 4),
                fair_pe=round(fpe, 4),
                intrinsic_value=round(iv, 4),
                computed_at=now,
            )
            session.add(cfs)

        for sub_key, sub_score in r["fq_subscores"].items():
            pillar = subfactor_pillar[sub_key]
            pw_val = ind_pw.get(pillar, 0.0)
            n_in_pillar = max(sum(1 for k in fq_keys if subfactor_pillar.get(k) == pillar), 1)
            applied_w = pw_val / n_in_pillar
            # Use per-company percentile from the stored dict
            peer_pct = r["fq_percentiles"].get(sub_key, 50.0)
            existing_fq = session.query(FinancialQualitySubscore).filter_by(
                company_id=company.id, fiscal_period=latest_period, subfactor_key=sub_key, timeline_id=timeline_id,
            ).first()
            if existing_fq is None:
                session.add(FinancialQualitySubscore(
                    company_id=company.id,
                    timeline_id=timeline_id,
                    fiscal_period=latest_period,
                    subfactor_key=sub_key,
                    raw_metric_value=_safe_finite(r["raw"].get(sub_key, 0.0)),
                    peer_percentile=peer_pct,
                    subscore=sub_score,
                    applied_weight=applied_w,
                ))


def _clamp_band(value: float, lo: float, hi: float) -> float:
    """Clamp a margin-band draw so a large margin_bias nudge can't push a
    uniform(0.x, 0.y) draw outside a sane range (e.g. negative COGS%)."""
    return max(lo, min(hi, value))


# Trailing-quarter weights for trend_drift below: most recent quarter counted
# heaviest, decaying for older quarters, matching the "weighted average of
# last 3-4 quarters" spec. Fewer available quarters just re-normalizes over
# whatever weights are available (see _weighted_trailing_growth).
_TREND_WEIGHTS = (0.40, 0.28, 0.20, 0.12)


def _weighted_trailing_growth(revenue_history: list[float]) -> float:
    """Recency-weighted average QoQ growth rate over the last up to 4 quarters
    of `revenue_history` (oldest -> newest). Returns 0.0 if fewer than 2
    quarters of history exist (nothing to compute a growth rate from)."""
    if len(revenue_history) < 2:
        return 0.0
    # QoQ growth rates for every consecutive pair, most recent last.
    qoq_rates = []
    for prev, curr in zip(revenue_history[:-1], revenue_history[1:]):
        if prev > 0:
            qoq_rates.append((curr - prev) / prev)
    if not qoq_rates:
        return 0.0
    trailing = qoq_rates[-len(_TREND_WEIGHTS):]
    trailing_weights = _TREND_WEIGHTS[: len(trailing)]
    # trailing is oldest->newest but weights are newest-first, so pair from the end.
    weighted_sum = sum(rate * w for rate, w in zip(reversed(trailing), trailing_weights))
    weight_total = sum(trailing_weights)
    return weighted_sum / weight_total if weight_total > 0 else 0.0


def _financial_quality_trend_bias(fq_history: list[float]) -> float:
    """Momentum/mean-reversion blend on the last up to 4 financial_quality
    readings: a sustained improving trend biases growth slightly positive, a
    sustained decline biases it slightly negative. Deliberately small and
    self-limiting (uses the average slope over the window, not just the last
    delta) so it can't compound into a runaway spiral across many quarters --
    each quarter's bias is recomputed fresh from the trailing window, not
    accumulated from the previous quarter's bias."""
    recent = fq_history[-4:]
    if len(recent) < 2:
        return 0.0
    deltas = [b - a for a, b in zip(recent[:-1], recent[1:])]
    avg_delta = sum(deltas) / len(deltas)
    # financial_quality is on a 0-100 scale; a +/-10 point average swing per
    # quarter is already a large move, so normalize against that and cap the
    # resulting growth-rate bias at +/-1.5% -- momentum should nudge, not
    # dominate, the growth number.
    normalized = max(-1.0, min(1.0, avg_delta / 10.0))
    return normalized * 0.015


def _management_quality_bias_and_noise(management_quality: float) -> tuple[float, float]:
    """Map management_quality (0-100) to (mean growth-rate bias, noise stddev).

    Well-run companies (high management_quality) should both perform better
    on average AND more consistently -- a 90-quality company beating guidance
    by a wide, random margin every quarter is exactly the kind of noise this
    redesign is meant to reduce. Centered at 50 (neutral, matches the
    seed-time neutral default) so an average-management company's behavior is
    close to the old flat rng.gauss(0.01, 0.03) baseline.
    """
    centered = (management_quality - 50.0) / 50.0  # -1.0 .. +1.0
    mean_bias = centered * 0.02  # up to +/-2% mean growth shift
    # Noise stddev shrinks from 4.5% (quality=0, chaotic) to 1.5% (quality=100,
    # highly consistent), linearly in management_quality.
    noise_scale = 0.045 - (management_quality / 100.0) * 0.03
    return mean_bias, max(0.01, noise_scale)


def _compute_quarterly_growth_and_margin_bias(
    revenue_history: list[float],
    management_quality: float,
    fq_history: list[float],
    price_return_qtr: float,
    event_sentiment: float,
    guidance_signal: float,
    rng: random.Random,
    concall_margin_bias: float = 0.0,
) -> tuple[float, float]:
    """Combine every signal into (growth_rate, margin_bias) for one company's
    new quarter. See _generate_fake_quarterly_financials' docstring for what
    each term represents; this is split out as its own function so the
    weighting/blending formula is unit-testable in isolation from the DB/ORM
    side of financial-statement generation.
    """
    trend_drift = _weighted_trailing_growth(revenue_history)
    mgmt_mean_bias, mgmt_noise_scale = _management_quality_bias_and_noise(management_quality)
    fq_bias = _financial_quality_trend_bias(fq_history)

    # Price is meant to be an OUTPUT of financials, not an input driver -- this
    # is a deliberately tiny, hard-capped mean-reversion nudge representing
    # "the market may have overreacted," not a feedback channel. A -50%
    # quarterly price return caps out at the same -1.0% nudge as a -90% return
    # would, so it can never dominate the other signals.
    price_reversion = max(-0.01, min(0.01, -price_return_qtr * 0.02))

    # event_sentiment is a sum of already severity/decay-scaled factor-score
    # deltas (roughly -100..+100 scale per event, typically much smaller after
    # decay); divide down to a growth-rate-sized contribution and cap it so a
    # single quarter packed with extreme events still can't single-handedly
    # blow through the outer GROWTH_RATE_CLAMP_MIN/MAX bounds.
    event_bias = max(-0.05, min(0.05, event_sentiment / 400.0))

    # guidance_signal is already normalized to [-1, 1] (neutral 0.0 when the
    # con-call model isn't available yet -- see _load_concall_guidance_signal).
    guidance_bias = guidance_signal * 0.015

    noise = rng.gauss(0.0, mgmt_noise_scale)

    growth_rate = (
        trend_drift + mgmt_mean_bias + fq_bias + price_reversion + event_bias + guidance_bias + noise
    )
    growth_rate = max(GROWTH_RATE_CLAMP_MIN, min(GROWTH_RATE_CLAMP_MAX, growth_rate))

    # margin_bias reuses the management/FQ-trend/event signals (not price or
    # guidance, which are revenue-specific) at a smaller scale, since a
    # well-run company with improving fundamentals and positive news flow
    # should also show better cost discipline, not just top-line growth.
    # concall_margin_bias is the prior quarter's con-call margin commentary
    # signal (engine/concalls.py's driver_deltas["margin_bias"], already
    # clamped to [-0.03, 0.03] there) -- added directly, same small scale as
    # the other terms here.
    margin_bias = max(-0.08, min(0.08, mgmt_mean_bias * 0.5 + fq_bias * 0.5 + event_bias * 0.3 + concall_margin_bias))

    return growth_rate, margin_bias


def _load_concall_guidance_signal(
    session: Session, company_ids: list[int], current_period: str,
) -> dict[int, float]:
    """Prior-quarter con-call guidance/tone signal, one scalar per company in
    roughly [-1, 1] (negative = cautious guidance, positive = bullish).

    Queries the ConCall model built by a parallel workstream. Import is
    lazy and every failure mode (model not present, table not migrated yet,
    schema still in flux) degrades to an all-neutral (0.0) dict rather than
    hard-failing -- guidance is a minor input signal and must never block
    fundamentals generation.
    """
    neutral = {cid: 0.0 for cid in company_ids}
    if not company_ids:
        return neutral
    try:
        from db.models import ConCall  # type: ignore[attr-defined]
    except ImportError:
        return neutral

    try:
        with session.begin_nested():
            rows = session.query(ConCall).filter(
                ConCall.company_id.in_(company_ids),
                ConCall.fiscal_period < current_period,
            ).order_by(ConCall.company_id.asc(), ConCall.fiscal_period.desc()).all()
    except Exception:
        return neutral

    seen: set[int] = set()
    result = dict(neutral)
    for row in rows:
        if row.company_id in seen:
            continue  # already took the most recent row for this company
        seen.add(row.company_id)
        tone = getattr(row, "tone_score", None)
        if tone is None:
            tone = getattr(row, "guidance_revenue_growth", None)
        if tone is not None:
            result[row.company_id] = max(-1.0, min(1.0, float(tone)))
    return result


def _load_concall_extended_signals(
    session: Session, company_ids: list[int], current_period: str,
) -> dict[int, dict[str, float]]:
    """Prior-quarter con-call margin/capex/debt bias signals, one dict per
    company, mirroring _load_concall_guidance_signal's single-query,
    degrade-to-neutral-on-any-failure contract. Pulled from the same most
    recent prior ConCall.driver_deltas that guidance/tone_score come from,
    so this adds no extra query beyond what _load_concall_guidance_signal
    already issues in the same tick (both could be merged into one query in
    a future pass; kept separate here for a smaller, more reviewable diff).
    """
    neutral = {cid: {"margin_bias": 0.0, "capex_bias": 0.0, "debt_bias": 0.0} for cid in company_ids}
    if not company_ids:
        return neutral
    try:
        from db.models import ConCall  # type: ignore[attr-defined]
    except ImportError:
        return neutral

    try:
        with session.begin_nested():
            rows = session.query(ConCall).filter(
                ConCall.company_id.in_(company_ids),
                ConCall.fiscal_period < current_period,
            ).order_by(ConCall.company_id.asc(), ConCall.fiscal_period.desc()).all()
    except Exception:
        return neutral

    seen: set[int] = set()
    result = dict(neutral)
    for row in rows:
        if row.company_id in seen:
            continue
        seen.add(row.company_id)
        deltas = row.driver_deltas or {}
        result[row.company_id] = {
            "margin_bias": max(-0.03, min(0.03, float(deltas.get("margin_bias", 0.0)))),
            "capex_bias": max(-0.10, min(0.10, float(deltas.get("capex_bias", 0.0)))),
            "debt_bias": max(-0.05, min(0.05, float(deltas.get("debt_bias", 0.0)))),
        }
    return result


def _load_previous_concalls(
    session: Session, company_ids: list[int], current_period: str,
) -> dict[int, ConCall]:
    """Most recent prior ConCall ORM row per company, one batched query --
    mirrors _load_concall_guidance_signal/_load_concall_extended_signals'
    query shape and dedup-by-first-row-per-company pattern, but keeps the
    full ConCall row (rather than extracting a scalar/dict of driver_deltas)
    since _generate_concalls_for_quarter's generate_concall() call needs the
    whole object (.trend_context, .guidance_revenue_growth, etc.) as its
    previous_concall argument.

    Unlike the two signal loaders above, this has no neutral-default
    fallback -- callers treat a missing company_id as "no prior con-call"
    (None), which is the same semantics the per-company query it replaces
    had via .first() returning None.
    """
    if not company_ids:
        return {}

    rows = (
        session.query(ConCall)
        .filter(ConCall.company_id.in_(company_ids), ConCall.fiscal_period < current_period)
        .order_by(ConCall.company_id.asc(), ConCall.fiscal_period.desc())
        .all()
    )

    seen: set[int] = set()
    result: dict[int, ConCall] = {}
    for row in rows:
        if row.company_id in seen:
            continue  # already took the most recent row for this company
        seen.add(row.company_id)
        result[row.company_id] = row
    return result


def _generate_fake_quarterly_financials(
    session: Session,
    timeline_id: int,
    company: Company,
    fiscal_period: str,
    rng: random.Random,
    management_quality: float = 50.0,
    fq_history: Optional[list[float]] = None,
    price_return_qtr: float = 0.0,
    event_sentiment: float = 0.0,
    guidance_signal: float = 0.0,
    already_refreshed: Optional[bool] = None,
    concall_margin_bias: float = 0.0,
    concall_capex_bias: float = 0.0,
    concall_debt_bias: float = 0.0,
) -> dict[str, float]:
    """Generate plausible next-quarter financials from the company's trailing
    history and quality/context signals.

    Revenue growth for the new quarter is built as a sum of independent,
    individually-small signals rather than a flat random walk:

      1. trend_drift    -- weighted average of the last 3-4 quarters' QoQ
                            growth rates (recency-weighted), replacing the old
                            "just look at last quarter" base.
      2. mgmt_bias/      -- higher management_quality shifts the mean growth
         mgmt_noise_scale   up and shrinks the noise stddev (consistent
                            execution); lower management_quality does the
                            opposite (volatile, weaker outcomes).
      3. fq_trend_bias   -- momentum/mean-reversion blend on the
                            financial_quality trend across up to the last 4
                            quarters.
      4. price_reversion -- tiny mean-reverting nudge off the quarter's price
                            return, capped hard so it can't become a feedback
                            loop.
      5. event_bias      -- aggregate company+industry event effect deltas
                            that fired during the quarter.
      6. guidance_bias   -- prior quarter's con-call guidance/tone signal
                            (neutral 0.0 if the con-call table is unavailable).

    All six are summed into a single growth-rate delta and clamped to
    [-0.40, 0.60] QoQ (GROWTH_RATE_CLAMP_MIN/MAX) so no combination of
    extreme signals can produce a pathological (negative or runaway) revenue
    figure. See _compute_quarterly_growth_and_margin_bias for the formula.
    """
    # Check every table this function writes to, not just IncomeStatement --
    # gating solely on IncomeStatement let a retried/re-crossed advance for
    # this (company_id, fiscal_period) fall through to the insert path below
    # and hit uq_balance_sheets_company_period on an already-present
    # BalanceSheet row even though IncomeStatement looked absent (e.g. it was
    # queried via a stale relationship cache). Only treat the quarter as
    # already-refreshed when every row this function writes is present --
    # a genuine transaction rollback removes all of them together, so a
    # same-fiscal-period retry is either "none of these rows exist yet" or
    # "all of them already do".
    # `already_refreshed` lets a caller that already batch-checked every
    # company's existence for this fiscal_period (SPEED.md #7/1.4 --
    # _refresh_fundamentals's 3 IN (...) pre-check) skip these 3 queries
    # here. Left as None (the default), this function checks for itself --
    # e.g. direct test calls that don't do the batch pre-check.
    if already_refreshed is None:
        existing_inc = session.query(IncomeStatement).filter_by(
            company_id=company.id, fiscal_period=fiscal_period, timeline_id=timeline_id,
        ).first()
        existing_bal = session.query(BalanceSheet).filter_by(
            company_id=company.id, fiscal_period=fiscal_period, timeline_id=timeline_id,
        ).first()
        existing_cf = session.query(CashFlowStatement).filter_by(
            company_id=company.id, fiscal_period=fiscal_period, timeline_id=timeline_id,
        ).first()
        already_refreshed = existing_inc is not None and existing_bal is not None and existing_cf is not None
    else:
        existing_inc = existing_bal = existing_cf = None

    if already_refreshed:
        # This company's quarter was already refreshed (e.g. a retried advance
        # call re-crossing the same boundary) -- reuse the existing rows
        # instead of inserting a second row for the same (company_id,
        # fiscal_period) and hitting the unique constraint.
        if existing_inc is None:
            existing_inc = session.query(IncomeStatement).filter_by(
                company_id=company.id, fiscal_period=fiscal_period, timeline_id=timeline_id,
            ).first()
        if existing_bal is None:
            existing_bal = session.query(BalanceSheet).filter_by(
                company_id=company.id, fiscal_period=fiscal_period, timeline_id=timeline_id,
            ).first()
        if existing_cf is None:
            existing_cf = session.query(CashFlowStatement).filter_by(
                company_id=company.id, fiscal_period=fiscal_period, timeline_id=timeline_id,
            ).first()
        prior_incs = session.query(IncomeStatement).filter_by(
            company_id=company.id, timeline_id=timeline_id,
        ).order_by(IncomeStatement.fiscal_period.asc()).all()
        eps_history = [float(i.eps) for i in prior_incs]
        revenue_history = [float(i.revenue) for i in prior_incs]
        ind = session.query(Industry).filter_by(id=company.industry_id).first()
        if (ind.subfactor_set if ind else "standard") == "financials":
            return _compute_banking_raw(existing_inc, existing_bal)
        return _compute_standard_raw(existing_inc, existing_bal, existing_cf, eps_history, revenue_history)

    # Full statement history (queried before this quarter's new rows are
    # added below) so earnings_stability/revenue_consistency have real
    # multi-period series instead of the seed's neutral 50.0 placeholders.
    prior_incs = session.query(IncomeStatement).filter_by(
        company_id=company.id, timeline_id=timeline_id,
    ).order_by(IncomeStatement.fiscal_period.asc()).all()
    eps_history = [float(i.eps) for i in prior_incs]
    revenue_history = [float(i.revenue) for i in prior_incs]

    latest_inc = prior_incs[-1] if prior_incs else None

    latest_bal = session.query(BalanceSheet).filter_by(
        company_id=company.id, timeline_id=timeline_id,
    ).order_by(BalanceSheet.fiscal_period.desc()).first()

    # Load latest factor scores for fundamentals-based cost-ratio adjustments
    # (revenue growth itself comes from _compute_quarterly_growth_and_margin_bias
    # below, which already folds in management_quality/financial_quality trend/
    # events/con-call guidance -- these three are only used to bias cost ratios).
    latest_cfs = session.query(CompanyFactorScore).filter_by(
        company_id=company.id, timeline_id=timeline_id,
    ).order_by(CompanyFactorScore.fiscal_period.desc()).first()
    moat_score = float(latest_cfs.moat_score) if latest_cfs else 50.0
    fin_qual = float(latest_cfs.financial_quality) if latest_cfs else 50.0
    mgmt_qual = float(latest_cfs.management_quality) if latest_cfs else 50.0

    if latest_inc:
        growth_rate, margin_bias = _compute_quarterly_growth_and_margin_bias(
            revenue_history=revenue_history,
            management_quality=management_quality,
            fq_history=fq_history or [],
            price_return_qtr=price_return_qtr,
            event_sentiment=event_sentiment,
            guidance_signal=guidance_signal,
            rng=rng,
            concall_margin_bias=concall_margin_bias,
        )
        rev = float(latest_inc.revenue) * (1 + growth_rate)
        rev = max(rev, 1e3)
    else:
        rev = rng.uniform(100, 10000)
        rev = max(rev, 100)
        margin_bias = 0.0

    # Cost ratios are carried forward from the latest quarter (not re-rolled
    # from a flat rng.uniform band every quarter) and anchored to company
    # fundamentals: moat_score improves gross margin (pricing power),
    # management_quality lowers opex, financial_quality lowers the effective
    # interest rate. margin_bias (from _compute_quarterly_growth_and_margin_bias
    # above -- same management/FQ-trend/event signals driving growth_rate) is
    # layered on top so a quarter with strong execution and positive news flow
    # shows up as better cost control too, not just top-line growth.
    if latest_inc:
        prev_rev = float(latest_inc.revenue)
        # Cost ratios mean-revert toward a stable, quality-adjusted TARGET each
        # quarter instead of compounding a fixed quality multiplier on the prior
        # quarter's ratio. The old `prev_ratio * quality_adj` form re-applied the
        # same directional factor every quarter, so a below-average company's cost
        # ratios ratcheted geometrically to the clamp ceiling (AAP's opex/rev went
        # 11% -> 31% over 7 quarters) and its margins -- and EPS -- collapsed toward
        # zero, while above-average companies drifted the other way without bound.
        # A company's moat/management quality should set the LEVEL its costs settle
        # at, not a perpetual rate of change: so anchor to the company's baseline
        # (first income statement on this timeline) ratio, tilt it by the quality
        # factor to form a target, and move the prior ratio a fraction of the way
        # toward that target -- a stable Ornstein-Uhlenbeck-style reversion.
        COST_REVERSION = 0.30
        base_inc = (
            session.query(IncomeStatement)
            .filter_by(company_id=company.id, timeline_id=timeline_id)
            .order_by(IncomeStatement.fiscal_period.asc())
            .first()
        )
        base_rev = float(base_inc.revenue) if base_inc and float(base_inc.revenue) > 0 else prev_rev
        base_cogs_r = float(base_inc.cogs) / base_rev if base_inc and base_rev > 0 else 0.55
        base_opex_r = (
            float(base_inc.operating_expenses) / base_rev if base_inc and base_rev > 0 else 0.22
        )

        moat_adj = 1.0 - (moat_score - 50.0) / 100.0 * 0.15  # ±7.5% around 50
        target_cogs_r = base_cogs_r * moat_adj
        prev_cogs_r = float(latest_inc.cogs) / prev_rev if prev_rev > 0 else base_cogs_r
        cogs_r = prev_cogs_r + COST_REVERSION * (target_cogs_r - prev_cogs_r)
        cogs_r = cogs_r * (1 + rng.gauss(0, 0.02)) - margin_bias
        cogs_r = _clamp_band(cogs_r, 0.25, 0.80)

        mgmt_adj = 1.0 - (mgmt_qual - 50.0) / 100.0 * 0.12  # ±6% around 50
        target_opex_r = base_opex_r * mgmt_adj
        prev_opex_r = float(latest_inc.operating_expenses) / prev_rev if prev_rev > 0 else base_opex_r
        opex_r = prev_opex_r + COST_REVERSION * (target_opex_r - prev_opex_r)
        opex_r = opex_r * (1 + rng.gauss(0, 0.025)) - margin_bias
        opex_r = _clamp_band(opex_r, 0.08, 0.45)

        prev_da_r = float(latest_inc.depreciation_amortization) / prev_rev if prev_rev > 0 else 0.04
        da_r = prev_da_r * (1 + rng.gauss(0, 0.03))
        da_r = max(0.005, min(0.12, da_r))

        prev_int = float(latest_inc.interest_expense)
        fq_adj = 1.0 - (fin_qual - 50.0) / 100.0 * 0.2  # ±10% around 50
        if latest_bal:
            debt = float(latest_bal.total_debt)
            prev_int_r = prev_int / max(debt, 1) if debt > 1e6 else (prev_int / prev_rev if prev_rev > 0 else 0.02)
        else:
            prev_int_r = prev_int / prev_rev if prev_rev > 0 else 0.02
        int_r = prev_int_r * fq_adj * (1 + rng.gauss(0, 0.03))
        int_r = max(0.001, min(0.08, int_r))
    else:
        cogs_r = rng.uniform(0.35, 0.60)
        opex_r = rng.uniform(0.15, 0.30)
        da_r = rng.uniform(0.02, 0.06)
        int_r = rng.uniform(0.01, 0.04)

    cogs = rev * cogs_r
    gp = rev - cogs
    op_ex = rev * opex_r
    ebitda = gp - op_ex
    da = rev * da_r
    ebit = ebitda - da
    # total_debt is stored in "millions" scale (1 = $1M), same as revenue
    debt_val = float(latest_bal.total_debt) if latest_bal else 0
    int_exp = (rev * int_r) if debt_val < 10 else (debt_val * int_r)
    pretax = ebit - int_exp
    tax = pretax * TAX_RATE
    ni = pretax - tax

    shares = float(company.shares_outstanding)
    prev_shares_dil = float(latest_inc.shares_diluted) if latest_inc else None
    if prev_shares_dil:
        shares_dil = prev_shares_dil * (1 + rng.gauss(0, 0.002))
    else:
        shares_dil = shares * rng.uniform(1.0, 1.02)
    # net_profit (ni) and shares_diluted are both stored in absolute units --
    # net_profit in whole dollars, shares_diluted as an actual share count --
    # so EPS is simply net_profit / shares_diluted. The seeded income rows use
    # this same convention (e.g. ni 43,552,899 / 123,984,889 shares = 0.35 EPS);
    # multiplying by 1,000,000 here (as an earlier revision did, on the mistaken
    # assumption net_profit was in $M) inflated every engine-generated EPS by 1e6,
    # which propagated into intrinsic_value = fair_pe * eps and blew valuations
    # up into the hundreds of millions per share.
    eps = ni / shares_dil if shares_dil > 0 else 0

    inc = IncomeStatement(
        company_id=company.id, timeline_id=timeline_id, fiscal_period=fiscal_period,
        revenue=round(rev, 2), cogs=round(cogs, 2),
        gross_profit=round(gp, 2), operating_expenses=round(op_ex, 2),
        ebitda=round(ebitda, 2), depreciation_amortization=round(da, 2),
        ebit=round(ebit, 2), interest_expense=round(int_exp, 2),
        pretax_income=round(pretax, 2), tax=round(tax, 2),
        net_profit=round(ni, 2), eps=round(eps, 4),
        shares_diluted=round(shares_dil, 2),
    )
    session.add(inc)

    if latest_bal:
        ta = float(latest_bal.total_assets) * (1 + rng.gauss(0.005, 0.02))
        cash = float(latest_bal.cash_and_equivalents) * (1 + rng.gauss(0.01, 0.05))
        td = float(latest_bal.total_debt) * (1 + rng.gauss(0.0, 0.02) + concall_debt_bias)
        se = float(latest_bal.shareholders_equity) * (1 + rng.gauss(0.005, 0.01))
        prev_ta = float(latest_bal.total_assets)
        # Carry forward composition ratios from previous balance sheet
        if prev_ta > 1:
            recv_r = float(latest_bal.receivables or 0) / prev_ta
            inv_r = float(latest_bal.inventory or 0) / prev_ta
            ppe_r = float(latest_bal.ppe or 0) / prev_ta
            intan_r = float(latest_bal.intangibles or 0) / prev_ta
            pay_r = float(latest_bal.payables or 0) / prev_ta
            std_r = float(latest_bal.short_term_debt or 0) / max(td, 1)
        else:
            recv_r, inv_r, ppe_r, intan_r, pay_r, std_r = 0.1, 0.1, 0.45, 0.1, 0.06, 0.2
    else:
        ta = rev * rng.uniform(1.5, 3.0)
        cash = rev * rng.uniform(0.05, 0.15)
        td = rev * rng.uniform(0.3, 0.8)
        se = rev * rng.uniform(0.5, 1.5)
        recv_r, inv_r, ppe_r, intan_r, pay_r, std_r = 0.1, 0.1, 0.45, 0.1, 0.06, 0.2

    ta = max(ta, 1)
    se = max(se, 1)
    td = max(td, 1)
    recv = ta * recv_r * (1 + rng.gauss(0, 0.03))
    inv = ta * inv_r * (1 + rng.gauss(0, 0.03))
    ca = cash + recv + inv
    ppe = ta * ppe_r * (1 + rng.gauss(0, 0.02))
    intan = ta * intan_r * (1 + rng.gauss(0, 0.03))
    pay = ta * pay_r * (1 + rng.gauss(0, 0.03))
    std = td * std_r * (1 + rng.gauss(0, 0.03))
    cl = pay + std
    ltd = td - std
    tl = cl + ltd + ta * (rng.uniform(0.03, 0.08))  # other liabilities
    ic = se + td

    bal = BalanceSheet(
        company_id=company.id, timeline_id=timeline_id, fiscal_period=fiscal_period,
        cash_and_equivalents=round(cash, 2),
        receivables=round(recv, 2), inventory=round(inv, 2),
        current_assets=round(ca, 2), ppe=round(ppe, 2),
        intangibles=round(intan, 2), total_assets=round(ta, 2),
        payables=round(pay, 2), short_term_debt=round(std, 2),
        current_liabilities=round(cl, 2), long_term_debt=round(ltd, 2),
        total_debt=round(td, 2), total_liabilities=round(tl, 2),
        shareholders_equity=round(se, 2), invested_capital=round(ic, 2),
    )
    session.add(bal)

    # Carry forward cash flow ratios from latest CFS
    latest_cfs_stmt = session.query(CashFlowStatement).filter_by(
        company_id=company.id, timeline_id=timeline_id,
    ).order_by(CashFlowStatement.fiscal_period.desc()).first()
    if latest_cfs_stmt:
        prev_ppe = float(latest_bal.ppe) if latest_bal else 1
        capex_r = abs(float(latest_cfs_stmt.capex)) / max(prev_ppe, 1)
        prev_ni = float(latest_inc.net_profit) if latest_inc else ni
        div_payout_r = abs(float(latest_cfs_stmt.dividends_paid)) / max(prev_ni, 1)
        fcf_val = float(latest_cfs_stmt.free_cash_flow)
        bb_r = abs(float(latest_cfs_stmt.buybacks)) / max(fcf_val if fcf_val > 0 else 1, 1)
    else:
        capex_r = 0.035
        div_payout_r = 0.25
        bb_r = 0.15

    capex = -ppe * capex_r * (1 + rng.gauss(0, 0.05) + concall_capex_bias)
    ocf = ni + da - recv * rng.uniform(0, 0.05)
    fcf = ocf + capex
    icf = -capex - recv * rng.uniform(0, 0.03)
    div = -ni * div_payout_r * (1 + rng.gauss(0, 0.05))
    bb = fcf * bb_r * (1 + rng.gauss(0, 0.05)) if fcf > 0 else 0
    fincf = td * rng.gauss(0, 0.01) + div + bb
    ncc = ocf + icf + fincf

    cf = CashFlowStatement(
        company_id=company.id, timeline_id=timeline_id, fiscal_period=fiscal_period,
        operating_cash_flow=round(ocf, 2), capex=round(capex, 2),
        free_cash_flow=round(fcf, 2), investing_cash_flow=round(icf, 2),
        financing_cash_flow=round(fincf, 2), dividends_paid=round(div, 2),
        buybacks=round(bb, 2), net_change_in_cash=round(ncc, 2),
    )
    session.add(cf)

    ce = ConsensusEstimate(
        company_id=company.id, timeline_id=timeline_id, fiscal_period=fiscal_period,
        consensus_eps=round(eps * rng.uniform(0.9, 1.1), 4),
        consensus_revenue=round(rev * rng.uniform(0.9, 1.1), 2),
    )
    session.add(ce)

    ind = session.query(Industry).filter_by(id=company.industry_id).first()
    sset = ind.subfactor_set if ind else "standard"

    if sset == "financials":
        return _compute_banking_raw(inc, bal)
    eps_history.append(round(eps, 4))
    revenue_history.append(round(rev, 2))
    return _compute_standard_raw(inc, bal, cf, eps_history, revenue_history)


def _compute_standard_raw(
    inc: IncomeStatement, bal: BalanceSheet, cf: CashFlowStatement,
    eps_history: Optional[list[float]] = None,
    revenue_history: Optional[list[float]] = None,
) -> dict[str, float]:
    ni_f = float(inc.net_profit)
    r = float(inc.revenue)
    ebit = float(inc.ebit)
    ta = float(bal.total_assets)
    se = float(bal.shareholders_equity)
    ic = float(bal.invested_capital)
    cash = float(bal.cash_and_equivalents)
    recv = float(bal.receivables)
    inv = float(bal.inventory)
    ca = float(bal.current_assets)
    cl = float(bal.current_liabilities)
    td = float(bal.total_debt)
    pay = float(bal.payables)
    ebitda = float(inc.ebitda)
    ocf = float(cf.operating_cash_flow)
    div = float(cf.dividends_paid)
    dso = days_sales_outstanding(recv, r)
    dio = days_inventory_outstanding(inv, float(inc.cogs))
    dpo = days_payables_outstanding(pay, float(inc.cogs))
    return {
        "operating_margin": operating_margin(ebit, r),
        "roic": roic(ebit, TAX_RATE, ic),
        "roe": roe(ni_f, se),
        "asset_turnover": asset_turnover(r, ta),
        "cash_conversion_cycle": cash_conversion_cycle(dso, dio, dpo),
        "net_debt_to_ebitda": net_debt_to_ebitda(td, cash, ebitda),
        "interest_coverage": interest_coverage(ebit, float(inc.interest_expense)),
        "current_ratio": current_ratio(ca, cl),
        "accruals_ratio": accruals_ratio(ni_f, ocf, ta),
        "earnings_stability": earnings_stability(eps_history or [float(inc.eps)]),
        "revenue_consistency": revenue_consistency(revenue_history or [r]),
        "payout_sustainability": payout_sustainability(div, ni_f, ocf),
        "eps": float(inc.eps),
    }


def _compute_banking_raw(
    inc: IncomeStatement, bal: BalanceSheet,
) -> dict[str, float]:
    ni_f = float(inc.net_profit)
    ta = float(bal.total_assets)
    se = float(bal.shareholders_equity)
    interest_income = float(inc.revenue)
    interest_expense = float(inc.interest_expense)
    op_ex = float(inc.operating_expenses)
    nii = interest_income - interest_expense
    loans = ta * 0.6
    npl = loans * 0.02
    return {
        "net_interest_margin": net_interest_margin(interest_income, interest_expense, ta),
        "cost_to_income": cost_to_income(op_ex, nii),
        "roa": roa(ni_f, ta),
        "capital_adequacy_ratio": capital_adequacy_ratio(se, loans),
        "npa_ratio": npa_ratio(npl, loans),
        "eps": float(inc.eps),
    }


def _compute_fiscal_period(tick_count: int) -> str:
    """Compute a fiscal period string like '2027Q1' based on approximate calendar."""
    quarter = ((tick_count // QUARTER_LENGTH) % 4) + 1
    year = 2026 + (tick_count // (QUARTER_LENGTH * 4))
    return f"{year}Q{quarter}"


def _quarter_market_performance(
    session: Session, timeline_id: int, company_ids: list[int], quarter_start: date, quarter_end: date,
) -> dict[int, float]:
    """Close-to-close stock return over the quarter just closed, per company,
    for engine.concalls.generate_concall's market_performance tie-breaker.

    Looks up the closing price on/before quarter_start and on/before
    quarter_end (PriceHistory rows exist for trading days only, so an exact
    date match on a boundary isn't guaranteed). Companies missing either
    endpoint (e.g. IPO'd mid-quarter) are simply omitted -- generate_concall
    treats a missing market_performance as "no tie-breaker" rather than 0.0,
    which would otherwise misreport a flat quarter.
    """
    if not company_ids:
        return {}

    start_rows = (
        session.query(PriceHistory.company_id, PriceHistory.close)
        .filter(
            PriceHistory.timeline_id == timeline_id,
            PriceHistory.company_id.in_(company_ids),
            PriceHistory.sim_date <= quarter_start,
        )
        .order_by(PriceHistory.company_id.asc(), PriceHistory.sim_date.desc())
        .all()
    )
    end_rows = (
        session.query(PriceHistory.company_id, PriceHistory.close)
        .filter(
            PriceHistory.timeline_id == timeline_id,
            PriceHistory.company_id.in_(company_ids),
            PriceHistory.sim_date <= quarter_end,
        )
        .order_by(PriceHistory.company_id.asc(), PriceHistory.sim_date.desc())
        .all()
    )

    start_close: dict[int, float] = {}
    for company_id, close in start_rows:
        start_close.setdefault(company_id, float(close))  # first row per id = most recent <= quarter_start

    end_close: dict[int, float] = {}
    for company_id, close in end_rows:
        end_close.setdefault(company_id, float(close))

    performance: dict[int, float] = {}
    for company_id in company_ids:
        s = start_close.get(company_id)
        e = end_close.get(company_id)
        if s is None or e is None or s <= 0:
            continue
        performance[company_id] = (e - s) / s
    return performance


def _generate_concalls_for_quarter(
    session: Session,
    timeline_id: int,
    companies: list[Company],
    stale_latest_cfs: dict[int, CompanyFactorScore],
    sim_date: date,
    rng: random.Random,
    tick_count: int,
) -> None:
    """Section 6.O -- generate one ConCall per company for the quarter that
    _refresh_fundamentals just closed out.

    Must run after _refresh_fundamentals (it reads that quarter's
    IncomeStatement/ConsensusEstimate/CompanyFactorScore rows), and is
    idempotency-guarded the same way _generate_fake_quarterly_financials is,
    so a retried/re-crossed Advance call over the same boundary doesn't hit
    uq_con_calls_company_period.

    `stale_latest_cfs` is state.latest_cfs from _load_tick_state, which was
    queried BEFORE _refresh_fundamentals ran this tick and is therefore
    pre-quarter-refresh for the companies that just got a new
    CompanyFactorScore row -- used only as a management_quality/
    growth_potential fallback for companies _refresh_fundamentals may have
    skipped (defensive; in the normal path every company gets a fresh row).
    """
    latest_period = _compute_fiscal_period(tick_count)

    try:
        with session.begin_nested():
            fresh_cfs_by_company: dict[int, CompanyFactorScore] = {
                row.company_id: row
                for row in session.query(CompanyFactorScore).filter_by(
                    fiscal_period=latest_period, timeline_id=timeline_id,
                ).all()
            }

            # ConCall has no timeline_id column (built by a separate
            # workstream, out of Future Lab's Phase 0 scope) -- con-calls are
            # narrative-only and never feed back into price/valuation, and
            # this whole block is already wrapped in a try/except that
            # no-ops on any failure, so cross-timeline duplication here is a
            # cosmetic gap (a re-generated call, not a corrupted one), not a
            # correctness bug on the scale of the price/IV fixes above.
            existing_calls = {
                row.company_id
                for row in session.query(ConCall.company_id).filter_by(fiscal_period=latest_period).all()
            }

            quarter_start = sim_date - timedelta(days=QUARTER_LENGTH)
            market_performance_by_company = _quarter_market_performance(
                session, timeline_id, [c.id for c in companies], quarter_start, sim_date,
            )

            # Batched single-query load of each company's most recent prior
            # ConCall, replacing what used to be an unbatched per-company
            # query inside the loop below (see _load_previous_concalls'
            # docstring).
            previous_concall_by_company = _load_previous_concalls(
                session, [c.id for c in companies], latest_period,
            )

            for company in companies:
                if company.id in existing_calls:
                    continue  # already generated for this (company, fiscal_period) -- retried advance

                income_stmt = session.query(IncomeStatement).filter_by(
                    company_id=company.id, fiscal_period=latest_period, timeline_id=timeline_id,
                ).first()
                if income_stmt is None:
                    continue  # this company's financials weren't refreshed this boundary; nothing to report on

                prior_income_stmt = session.query(IncomeStatement).filter(
                    IncomeStatement.company_id == company.id,
                    IncomeStatement.timeline_id == timeline_id,
                    IncomeStatement.fiscal_period < latest_period,
                ).order_by(IncomeStatement.fiscal_period.desc()).first()

                consensus = session.query(ConsensusEstimate).filter_by(
                    company_id=company.id, fiscal_period=latest_period, timeline_id=timeline_id,
                ).first()
                balance_sheet = session.query(BalanceSheet).filter_by(
                    company_id=company.id, fiscal_period=latest_period, timeline_id=timeline_id,
                ).first()
                cash_flow = session.query(CashFlowStatement).filter_by(
                    company_id=company.id, fiscal_period=latest_period, timeline_id=timeline_id,
                ).first()

                cfs = fresh_cfs_by_company.get(company.id) or stale_latest_cfs.get(company.id)
                management_quality = float(cfs.management_quality) if cfs else 50.0
                growth_potential = float(cfs.growth_potential) if cfs else 50.0
                moat_score = float(cfs.moat_score) if cfs is not None and cfs.moat_score is not None else None

                previous_concall = previous_concall_by_company.get(company.id)
                prior_balance_sheet = session.query(BalanceSheet).filter(
                    BalanceSheet.company_id == company.id,
                    BalanceSheet.timeline_id == timeline_id,
                    BalanceSheet.fiscal_period < latest_period,
                ).order_by(BalanceSheet.fiscal_period.desc()).first()
                prior_cash_flow = session.query(CashFlowStatement).filter(
                    CashFlowStatement.company_id == company.id,
                    CashFlowStatement.timeline_id == timeline_id,
                    CashFlowStatement.fiscal_period < latest_period,
                ).order_by(CashFlowStatement.fiscal_period.desc()).first()

                concall = generate_concall(
                    company=company,
                    income_stmt=income_stmt,
                    prior_income_stmt=prior_income_stmt,
                    consensus=consensus,
                    management_quality=management_quality,
                    growth_potential=growth_potential,
                    fiscal_period=latest_period,
                    call_date=sim_date,
                    rng=rng,
                    balance_sheet=balance_sheet,
                    cash_flow=cash_flow,
                    moat_score=moat_score,
                    market_performance=market_performance_by_company.get(company.id),
                    previous_concall=previous_concall,
                    prior_balance_sheet=prior_balance_sheet,
                    prior_cash_flow=prior_cash_flow,
                )
                session.add(concall)

                # Small bounded factor-score nudge -- only against the
                # current-session-fresh CompanyFactorScore row for this
                # quarter (fresh_cfs_by_company), never against
                # stale_latest_cfs (a pre-tick snapshot that may not be
                # attached to this session / may be stale by the time this
                # flushes) -- see this function's docstring on stale_latest_cfs.
                cfs_for_nudge = fresh_cfs_by_company.get(company.id)
                mgmt_delta = 0.0
                moat_delta = 0.0
                if cfs_for_nudge is not None:
                    mgmt_delta = max(
                        -CONCALL_FACTOR_NUDGE_CLAMP,
                        min(CONCALL_FACTOR_NUDGE_CLAMP, concall.driver_deltas.get("guidance", 0.0) * CONCALL_FACTOR_NUDGE_SCALE),
                    )
                    moat_delta = max(
                        -CONCALL_FACTOR_NUDGE_CLAMP,
                        min(CONCALL_FACTOR_NUDGE_CLAMP, concall.driver_deltas.get("earnings_surprise", 0.0) * CONCALL_FACTOR_NUDGE_SCALE),
                    )
                    # 50.0 is the neutral-midpoint default used elsewhere in
                    # this file for a null factor-score column (see e.g.
                    # _generate_fake_quarterly_financials' management_quality
                    # default) -- guards a null column from raising TypeError
                    # in float() rather than silently defaulting to neutral.
                    current_mgmt = float(cfs_for_nudge.management_quality) if cfs_for_nudge.management_quality is not None else 50.0
                    current_moat = float(cfs_for_nudge.moat_score) if cfs_for_nudge.moat_score is not None else 50.0
                    cfs_for_nudge.management_quality = round(
                        max(0.0, min(100.0, current_mgmt + mgmt_delta)), 4,
                    )
                    cfs_for_nudge.moat_score = round(
                        max(0.0, min(100.0, current_moat + moat_delta)), 4,
                    )

                # Give the con-call a real entry in the news feed pipeline
                # (finally a consumer for driver_deltas -- see ConCall's
                # model docstring) via a direct NewsFeed insert rather than
                # engine.news_manager.generate_news, since that function is
                # hard-wired to an EventInstance+MarketEvent+NewsTemplate
                # join and a con-call already has its own statement text, no
                # template substitution needed.
                headline = f"{company.name} {concall.performance_bucket.upper()} on {latest_period} earnings call"
                news = NewsFeed(
                    timeline_id=timeline_id,
                    sim_date=sim_date,
                    company_id=company.id,
                    industry_id=None,
                    headline=headline[:300],
                    body=concall.statements.get("opening", headline),
                    sentiment="positive" if concall.tone_score > 0 else ("negative" if concall.tone_score < 0 else "neutral"),
                    severity=round(abs(concall.tone_score) * 5.0, 4),
                    news_type="both",
                    source_event_instance_id=None,
                )
                session.add(news)
                session.flush()

                concall.applied_deltas = {
                    "management_quality_delta": mgmt_delta,
                    "moat_score_delta": moat_delta,
                    "news_feed_id": news.id,
                }

            session.flush()
    except Exception as exc:
        # Con-call generation is an optional narrative layer. Local/dev
        # databases may not have the con_calls migration yet; never let that
        # block the market simulation tick. This savepoint spans the WHOLE
        # per-company loop (including Task 5's factor-score nudges and
        # NewsFeed inserts), so any single company's exception rolls back
        # every company's ConCall/nudge/news for this quarter -- log it so
        # that isn't silent.
        logger.warning(
            "Con-call generation failed for quarter %s: %s", latest_period, exc, exc_info=True,
        )
        return


def _safe_finite(v: float) -> float:
    if v == float("inf"):
        return 1e9
    if v == float("-inf"):
        return -1e9
    return v if np.isfinite(v) else 0.0


def _get_active_events_for_company(
    market_events: list[EventInstance],
    industry_events: dict[int, list[EventInstance]],
    company_events: dict[int, list[EventInstance]],
    event_defs: dict[int, MarketEvent],
    company_id: int,
    industry_id: int,
    epoch_start: date,
) -> list[dict]:
    """Return active EventInstance data for driver computation, from the
    per-tick batch load in `_load_active_events` — no DB access here."""
    instances = (
        company_events.get(company_id, [])
        + industry_events.get(industry_id, [])
        + market_events
    )

    result = []
    for inst in instances:
        event = event_defs.get(inst.event_id)
        if event is None:  # pragma: no cover — blocked by FK constraint
            continue  # pragma: no cover
        result.append({
            "severity": float(inst.resolved_severity),
            "start_day": (inst.sim_date - epoch_start).days,
            "effect_profile": inst.applied_effects,
            "decay_rate": float(event.decay_rate),
        })
    return result


def _jitter_event_severities(
    active_events: list[dict],
    rng: random.Random,
    jitter_std: float,
) -> list[dict]:
    """Apply small per-company multiplicative dispersion to each active event's
    severity, called once per company per tick from _compute_drivers.

    A single MarketEvent instance's resolved_severity (news_manager.py) is
    drawn ONCE per firing and then handed identically to every company in its
    scope by _get_active_events_for_company -- for a market-scope event that
    is all 153 companies, for an industry-scope event every company in that
    industry. Without dispersion here, one event moves every affected
    company's news_severity/guidance/etc. drivers by the exact same delta,
    which was a major contributor to lockstep phase-wide price moves.
    Multiplying by (1 + gauss(0, jitter_std)) has zero-mean noise, so the
    event's average severity across the affected population is unchanged --
    only which companies feel it slightly more or less each tick.
    """
    return [
        {**event_data, "severity": event_data.get("severity", 0.0) * (1.0 + rng.gauss(0, jitter_std))}
        for event_data in active_events
    ]


def _mark_to_market(
    session: Session,
    timeline_id: int,
    ohlc_results: dict[int, dict],
) -> None:
    """Section 6.O step 13 -- update portfolio market values based on latest prices.

    Prices come from THIS tick's ohlc_results (this timeline's own freshly
    computed closes), never from Company.current_price -- that column is a
    single shared, timeline-agnostic cache (see db/timeline_resolver.py's
    module docstring) that only the live timeline is allowed to write
    (_update_denormalized_fields). Reading it here for a non-live timeline
    would mark that timeline's portfolios to whatever price the live (or
    another branch's) timeline last wrote, corrupting portfolio valuations
    for every non-live timeline -- including the terminal-value distribution
    a Monte Carlo ensemble reduces over (timeline_group_service.compute_distribution).
    """
    portfolios = session.query(Portfolio).filter_by(timeline_id=timeline_id).all()
    price_map = {
        cid: Decimal(str(ohlc["close"])) for cid, ohlc in ohlc_results.items()
    }
    for pf in portfolios:
        holdings = session.query(Holding).filter_by(portfolio_id=pf.id).all()
        holdings_value = sum(
            (Decimal(str(h.quantity)) * price_map.get(h.company_id, Decimal(0)) for h in holdings),
            start=Decimal(0),
        )
        total_value = Decimal(str(pf.cash_balance)) + holdings_value
        pf.total_value = total_value.quantize(Decimal("0.01"))


def _scope_target_company_ids(
    ei: "EventInstance", company_map: dict[int, Company],
) -> list[int]:
    """Section 6.N -- companies affected by an event instance's scope.

    company scope -> just that company; industry scope -> every company in
    that industry; market scope -> every company. Previously only
    scope_type == "company" was handled here, silently dropping factor-score
    effects for industry- and market-scope events (e.g. sector-wide
    regulation, recessions) even though their effect_profile may target
    financial_quality/moat_score/etc. exactly like company-scope events.
    """
    if ei.scope_type == "company":
        return [ei.scope_ref] if ei.scope_ref in company_map else []
    if ei.scope_type == "industry":
        return [cid for cid, c in company_map.items() if c.industry_id == ei.scope_ref]
    if ei.scope_type == "market":
        return list(company_map.keys())
    return []


def _apply_event_factor_effects(
    session: Session,
    companies: list[Company],
    sim_date: date,
    timeline_id: int,
    params: dict[str, float],
    neutral_industry_pegs: dict[int, float],
    industries: dict[int, object],
    is_live: bool = True,
) -> set[int]:
    """Section 6.N -- apply structural event effect_profiles to factor scores and recompute IV.

    Re-applied every tick against every *currently active* (non-expired) EventInstance
    with factor-score effects, not just events that fired today -- otherwise the effect
    is baked in once at full severity and never decays. days_elapsed is computed fresh
    from each instance's own sim_date, so a still-active event's contribution shrinks
    tick by tick, matching how driver effects (apply_effect_to_drivers) already behave.

    Returns the set of company ids whose factor scores/IV were touched.
    """
    company_map = {c.id: c for c in companies}
    affected_company_ids: set[int] = set()

    active_instances = session.query(EventInstance).filter(
        EventInstance.timeline_id == timeline_id,
        EventInstance.expires_on >= sim_date,
    ).all()

    event_cache: dict[int, MarketEvent] = {}

    # Collect every active instance's decayed (effects, severity, rho, days_elapsed)
    # per target company first, so a company hit by N simultaneous events gets all N
    # deltas applied together against its one true base in a single pass -- calling
    # _apply_factor_effects_to_company once per event per company would have each
    # call read the previous call's already-mutated effective column as its
    # "factor_scores" input, silently re-introducing the same cross-call compounding
    # this function exists to eliminate across ticks.
    per_company_instances: dict[int, list[tuple[dict, float, float, int]]] = {}

    for ei in active_instances:
        profile = ei.applied_effects
        if not profile or not isinstance(profile, dict):
            continue
        factor_keys = [k for k in profile if k not in DRIVER_KEYS]
        if not factor_keys:
            continue

        target_cids = _scope_target_company_ids(ei, company_map)
        if not target_cids:
            continue

        if ei.event_id not in event_cache:
            event_cache[ei.event_id] = session.query(MarketEvent).filter_by(id=ei.event_id).first()
        event = event_cache[ei.event_id]

        days_elapsed = (sim_date - ei.sim_date).days
        severity = float(ei.resolved_severity)
        rho = float(event.decay_rate) if event else 0.1
        effects = {k: profile[k] for k in factor_keys}

        for cid in target_cids:
            per_company_instances.setdefault(cid, []).append((effects, severity, rho, days_elapsed))

    if not per_company_instances:
        return affected_company_ids

    # Batch-load everything _apply_factor_effects_to_company needs across
    # every affected company in a handful of queries, instead of 7 queries
    # per company inside the loop below (3 of which -- IndustryPillarWeight/
    # fq_sub/moat_sub definitions -- don't even vary by company and were
    # being re-fetched on every single call). A currently-active event can
    # span its full duration_days and touch a whole industry or the entire
    # market, so this loop can easily cover most/all companies on any given
    # tick, not just the ones with an event newly firing today.
    batch = _load_factor_effect_batch(session, timeline_id, set(per_company_instances.keys()))

    for cid, instances in per_company_instances.items():
        _apply_factor_effects_to_company(
            cid, company_map, industries, params, neutral_industry_pegs, instances, batch, is_live,
        )
        affected_company_ids.add(cid)

    return affected_company_ids


def _load_factor_effect_batch(session: Session, timeline_id: int, cids: set[int]) -> SimpleNamespace:
    """Batch-load everything `_apply_factor_effects_to_company` needs for a
    set of companies in a handful of queries, instead of 7 queries per
    company (3 of which -- IndustryPillarWeight/fq_sub/moat_sub definitions
    -- don't even vary by company and were being re-fetched every time)."""
    pw_rows = session.query(IndustryPillarWeight).order_by(IndustryPillarWeight.id).all()
    industry_pw: dict[int, dict[str, float]] = {}
    for pw in pw_rows:
        industry_pw.setdefault(pw.industry_id, {})[pw.pillar] = float(pw.weight)

    fq_defs = session.query(FactorDefinition).filter_by(factor_type="fq_sub").order_by(FactorDefinition.id).all()
    subfactor_pillar = {fd.key: fd.pillar for fd in fq_defs}

    moat_defs = session.query(FactorDefinition).filter_by(factor_type="moat_sub").order_by(FactorDefinition.id).all()
    moat_weights = {md.key: float(md.default_weight) for md in moat_defs if md.default_weight}

    moat_rows_by_company: dict[int, list[MoatSubscore]] = {}
    for ms in session.query(MoatSubscore).filter(
        MoatSubscore.company_id.in_(cids), MoatSubscore.timeline_id == timeline_id,
    ).order_by(MoatSubscore.id).all():
        moat_rows_by_company.setdefault(ms.company_id, []).append(ms)

    latest_cfs_by_company: dict[int, CompanyFactorScore] = {}
    for cfs in (
        session.query(CompanyFactorScore)
        .filter(CompanyFactorScore.company_id.in_(cids), CompanyFactorScore.timeline_id == timeline_id)
        .order_by(CompanyFactorScore.company_id, CompanyFactorScore.fiscal_period.desc())
        .all()
    ):
        if cfs.company_id not in latest_cfs_by_company:
            latest_cfs_by_company[cfs.company_id] = cfs

    # Full per-company list (fiscal_period desc), not deduplicated to the
    # latest row -- matches the prior per-company query's exact semantics.
    fq_subs_by_company: dict[int, list[FinancialQualitySubscore]] = {}
    for fs in (
        session.query(FinancialQualitySubscore)
        .filter(FinancialQualitySubscore.company_id.in_(cids), FinancialQualitySubscore.timeline_id == timeline_id)
        .order_by(FinancialQualitySubscore.company_id, FinancialQualitySubscore.fiscal_period.desc())
        .all()
    ):
        fq_subs_by_company.setdefault(fs.company_id, []).append(fs)

    latest_inc_by_company: dict[int, IncomeStatement] = {}
    for inc in (
        session.query(IncomeStatement)
        .filter(IncomeStatement.company_id.in_(cids), IncomeStatement.timeline_id == timeline_id)
        .order_by(IncomeStatement.company_id, IncomeStatement.fiscal_period.desc())
        .all()
    ):
        if inc.company_id not in latest_inc_by_company:
            latest_inc_by_company[inc.company_id] = inc

    return SimpleNamespace(
        industry_pw=industry_pw,
        subfactor_pillar=subfactor_pillar,
        moat_weights=moat_weights,
        moat_rows_by_company=moat_rows_by_company,
        latest_cfs_by_company=latest_cfs_by_company,
        fq_subs_by_company=fq_subs_by_company,
        latest_inc_by_company=latest_inc_by_company,
    )


def _apply_factor_effects_to_company(
    cid: int,
    company_map: dict[int, Company],
    industries: dict[int, object],
    params: dict[str, float],
    neutral_industry_pegs: dict[int, float],
    instances: list[tuple[dict, float, float, int]],
    batch: SimpleNamespace,
    is_live: bool = True,
) -> None:
    """Apply every currently-active event's factor-score effects to a single company
    and recompute IV. `instances` is a list of (effects, severity, rho, days_elapsed)
    tuples, one per active EventInstance targeting this company -- summed together so
    simultaneous events each contribute independently against the same base rather
    than compounding on each other's already-applied deltas.

    Handles all 5 top-level CompanyFactorScore fields (management_quality,
    moat_score, financial_quality, fcf_quality, growth_potential) plus
    individual MoatSubscore sub-factor keys. A direct "moat_score" effect
    nudges the composite after sub-factor aggregation, distinct from
    sub-factor keys like "innovation" which feed into the composite itself.

    management_quality/growth_potential/fcf_quality and MoatSubscore sub-factor
    scores have no other source of truth to re-derive from each tick (unlike
    moat_score/financial_quality, always recomputed fresh from MoatSubscore/
    FinancialQualitySubscore), so their deltas are computed against the *_base /
    score_base snapshot -- written once per quarter (or at seed time) and never
    itself mutated by events -- so a still-active event's contribution actually
    decays as days_elapsed grows, instead of compounding on top of yesterday's
    already-decayed-but-baked-in value.

    `batch` is the pre-loaded `_load_factor_effect_batch` result shared
    across every company touched this tick, in place of per-company queries.
    """
    moat_rows = batch.moat_rows_by_company.get(cid, [])
    latest_cfs = batch.latest_cfs_by_company.get(cid)
    if latest_cfs is None:
        return

    top_level_keys = {"management_quality", "moat_score", "financial_quality", "fcf_quality", "growth_potential"}

    base_scores = {
        ms.subfactor_key: float(ms.score_base) if ms.score_base is not None else float(ms.score)
        for ms in moat_rows
    }
    base_scores["management_quality"] = (
        float(latest_cfs.management_quality_base) if latest_cfs.management_quality_base is not None
        else float(latest_cfs.management_quality)
    )
    base_scores["moat_score"] = float(latest_cfs.moat_score)
    base_scores["financial_quality"] = float(latest_cfs.financial_quality)
    base_scores["fcf_quality"] = (
        float(latest_cfs.fcf_quality_base) if latest_cfs.fcf_quality_base is not None
        else float(latest_cfs.fcf_quality)
    )
    base_scores["growth_potential"] = (
        float(latest_cfs.growth_potential_base) if latest_cfs.growth_potential_base is not None
        else float(latest_cfs.growth_potential)
    )

    updated = dict(base_scores)
    for effects, severity, rho, days_elapsed in instances:
        updated = apply_effect_to_factor_scores(updated, effects, severity, rho, days_elapsed)

    # Write back MoatSubscore sub-factor updates (keys that aren't top-level);
    # score_base is untouched so next tick's decay is computed from the same anchor.
    for ms in moat_rows:
        if ms.subfactor_key in updated and ms.subfactor_key not in top_level_keys:
            ms.score = round(updated[ms.subfactor_key], 4)
            if ms.score_base is None:
                ms.score_base = round(base_scores[ms.subfactor_key], 4)

    ind_pw = batch.industry_pw.get(company_map[cid].industry_id, {})
    subfactor_pillar = batch.subfactor_pillar

    # financial_quality is normally re-derived each fiscal period from
    # FinancialQualitySubscore rows; an event's direct delta on it is a
    # temporary override on top of that base, not replaced by a fresh
    # recompute (otherwise the effect would always be silently discarded).
    latest_fq_subs = batch.fq_subs_by_company.get(cid, [])
    fq_subs = {fs.subfactor_key: float(fs.subscore) for fs in latest_fq_subs}
    base_fq = financial_quality_composite(fq_subs, ind_pw, subfactor_pillar) if fq_subs else float(latest_cfs.financial_quality)
    fq_delta = updated["financial_quality"] - base_scores["financial_quality"]
    fq = max(0.0, min(100.0, base_fq + fq_delta))

    moat_weights = batch.moat_weights
    # moat_composite requires every subfactor key to have a matching weight;
    # only pass sub-factors that are actually weighted (seed data may have
    # MoatSubscore rows with no corresponding moat_sub FactorDefinition yet).
    weighted_subfactors = {
        ms.subfactor_key: float(ms.score) for ms in moat_rows
        if ms.subfactor_key not in top_level_keys and ms.subfactor_key in moat_weights
    }
    subfactor_moat = (
        moat_composite(weighted_subfactors, moat_weights)
        if weighted_subfactors else float(latest_cfs.moat_score)
    )
    moat_delta = updated["moat_score"] - base_scores["moat_score"]
    moat_val = max(0.0, min(100.0, subfactor_moat + moat_delta))

    mgmt = updated["management_quality"]
    growth = updated["growth_potential"]
    fcfq = updated["fcf_quality"]
    iscore = compute_intrinsic_score(mgmt, moat_val, fq, fcfq, growth)

    ind_id = company_map[cid].industry_id
    eps_val = 0.0
    latest_inc = batch.latest_inc_by_company.get(cid)
    if latest_inc:
        eps_val = float(latest_inc.eps)
    fpe, iv = _recompute_valuation(iscore, growth, ind_id, neutral_industry_pegs, params, eps_val)

    # Persist onto the actual CompanyFactorScore row (not just the
    # denormalized Company fields) so the next tick's driver computations
    # and any direct query of CompanyFactorScore see the updated scores.
    # *_base columns are left untouched so next tick's decay is computed from
    # the same anchor -- except when a legacy/pre-migration row has no base
    # snapshot yet, in which case this tick's pre-effect value becomes the
    # anchor going forward (best available; the true undecayed value predates
    # this row and isn't otherwise recoverable).
    if latest_cfs.management_quality_base is None:
        latest_cfs.management_quality_base = round(base_scores["management_quality"], 4)
    if latest_cfs.fcf_quality_base is None:
        latest_cfs.fcf_quality_base = round(base_scores["fcf_quality"], 4)
    if latest_cfs.growth_potential_base is None:
        latest_cfs.growth_potential_base = round(base_scores["growth_potential"], 4)

    latest_cfs.management_quality = round(mgmt, 4)
    latest_cfs.moat_score = round(moat_val, 4)
    latest_cfs.financial_quality = round(fq, 4)
    latest_cfs.fcf_quality = round(fcfq, 4)
    latest_cfs.growth_potential = round(growth, 4)
    latest_cfs.intrinsic_score = round(iscore, 4)
    latest_cfs.fair_pe = round(fpe, 4)
    latest_cfs.intrinsic_value = round(iv, 4)

    if is_live:
        company_map[cid].intrinsic_score = round(iscore, 4)
        company_map[cid].fair_pe = round(fpe, 4)
        company_map[cid].intrinsic_value = round(iv, 4)


# ── Bulk in-memory tick mode ────────────────────────────────────────────


def _load_static_tick_state(
    session: Session,
    timeline_id: int,
    timeline: 'Timeline',
) -> TickStateArrays:
    """Load ONLY the immutable reference data into a TickStateArrays.

    This is the Phase 1 load-once function for bulk_run_ticks().
    It does NOT load per-tick mutable state (price_overlay, iv_overlay,
    sim_state pointer, cycle state, recent_closes, prev_ns) — those are
    initialized separately in bulk_run_ticks() from the simulation's
    current state, and mutated in-place by _bulk_tick_iteration().

    Returns a TickStateArrays with static fields populated and mutable
    fields at their defaults (to be filled by the caller).
    """
    companies = session.query(Company).order_by(Company.id).all()
    company_by_id = {c.id: c for c in companies}
    industries = {ind.id: ind for ind in session.query(Industry).order_by(Industry.id).all()}
    industry_ids = list(industries.keys())
    timeline_chain = get_timeline_chain(session, timeline_id)

    # Config params (global scope only)
    params = _load_params(session)
    neutral_industry_pegs = _load_neutral_industry_pegs(session)

    # Override maps
    override_rows = session.query(TimelineOverride).filter_by(timeline_id=timeline_id).all()
    # Use epoch_start=None since static load has no tick date yet; the
    # caller will resolve active overrides per tick if needed. For bulk
    # mode we load active overrides relative to the bulk start date.
    active_overrides = resolve_active_overrides(override_rows, None)
    params = apply_config_overrides(params, active_overrides.get("config", []))
    driver_bias_map = driver_bias_by_company(active_overrides.get("driver_bias", []))
    factor_score_bias_map = factor_score_bias_by_company(active_overrides.get("factor_score", []))

    cycle_transition_override: Optional[dict] = None
    for row in active_overrides.get("cycle_transition", []):
        try:
            strength = float(row.override_value)
        except (TypeError, ValueError):
            strength = 1.0
        cycle_transition_override = build_cycle_transition_override(row.target_key, strength)

    # Batch-load financial statements (latest per company)
    all_bal = session.query(BalanceSheet).filter_by(timeline_id=timeline_id).order_by(
        BalanceSheet.fiscal_period.desc()
    ).all()
    latest_bal: dict[int, BalanceSheet] = {}
    for bal in all_bal:
        if bal.company_id not in latest_bal:
            latest_bal[bal.company_id] = bal

    all_inc = session.query(IncomeStatement).filter_by(timeline_id=timeline_id).order_by(
        IncomeStatement.fiscal_period.desc()
    ).all()
    latest_inc: dict[int, IncomeStatement] = {}
    for inc in all_inc:
        if inc.company_id not in latest_inc:
            latest_inc[inc.company_id] = inc

    all_ce = session.query(ConsensusEstimate).filter_by(timeline_id=timeline_id).order_by(
        ConsensusEstimate.fiscal_period.desc()
    ).all()
    latest_ce: dict[int, ConsensusEstimate] = {}
    for ce in all_ce:
        if ce.company_id not in latest_ce:
            latest_ce[ce.company_id] = ce

    all_cfs = session.query(CompanyFactorScore).filter_by(timeline_id=timeline_id).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).all()
    latest_cfs: dict[int, CompanyFactorScore] = {}
    for cfs_row in all_cfs:
        if cfs_row.company_id not in latest_cfs:
            latest_cfs[cfs_row.company_id] = cfs_row

    # Factor-effect batch (loaded once, same approach as _load_factor_effect_batch)
    pw_rows = session.query(IndustryPillarWeight).order_by(IndustryPillarWeight.id).all()
    industry_pw: dict[int, dict[str, float]] = {}
    for pw in pw_rows:
        industry_pw.setdefault(pw.industry_id, {})[pw.pillar] = float(pw.weight)

    fq_defs = session.query(FactorDefinition).filter_by(factor_type="fq_sub").order_by(FactorDefinition.id).all()
    subfactor_pillar = {fd.key: fd.pillar for fd in fq_defs}

    moat_defs = session.query(FactorDefinition).filter_by(factor_type="moat_sub").order_by(FactorDefinition.id).all()
    moat_weights = {md.key: float(md.default_weight) for md in moat_defs if md.default_weight}

    cids = set(c.id for c in companies)
    moat_rows_by_company: dict[int, list[MoatSubscore]] = {}
    for ms in session.query(MoatSubscore).filter(
        MoatSubscore.company_id.in_(cids), MoatSubscore.timeline_id == timeline_id,
    ).order_by(MoatSubscore.id).all():
        moat_rows_by_company.setdefault(ms.company_id, []).append(ms)

    fq_subs_by_company: dict[int, list[FinancialQualitySubscore]] = {}
    for fs in session.query(FinancialQualitySubscore).filter(
        FinancialQualitySubscore.company_id.in_(cids), FinancialQualitySubscore.timeline_id == timeline_id,
    ).order_by(FinancialQualitySubscore.company_id, FinancialQualitySubscore.fiscal_period.desc()).all():
        fq_subs_by_company.setdefault(fs.company_id, []).append(fs)

    return TickStateArrays(
        timeline_id=timeline_id,
        timeline=timeline,
        companies=companies,
        company_by_id=company_by_id,
        industries=industries,
        industry_ids=industry_ids,
        params=params,
        neutral_industry_pegs=neutral_industry_pegs,
        timeline_chain=timeline_chain,
        event_defs={},
        latest_bal=latest_bal,
        latest_inc=latest_inc,
        latest_ce=latest_ce,
        latest_cfs=latest_cfs,
        industry_pw=industry_pw,
        subfactor_pillar=subfactor_pillar,
        moat_weights=moat_weights,
        moat_rows_by_company=moat_rows_by_company,
        fq_subs_by_company=fq_subs_by_company,
        driver_bias_map=driver_bias_map,
        factor_score_bias_map=factor_score_bias_map,
        cycle_transition_override=cycle_transition_override,
    )


def _bulk_tick_iteration(
    arrays: TickStateArrays,
) -> TickMemoryOutput:
    """Run ONE tick entirely from TickStateArrays in-memory state.

    No DB reads, no DB writes. Mutates `arrays` in place.
    Returns a TickMemoryOutput with deferred-insert rows.
    """
    rng = random.Random(arrays.timeline.rng_seed + arrays.current_tick_count)
    sim_date = arrays.current_sim_date
    tick_count = arrays.current_tick_count

    # ── Quarter boundary check ───────────────────────────────────────────
    arrays.is_quarter_boundary = tick_count > 0 and tick_count % QUARTER_LENGTH == 0

    # ── Drift cycle state ────────────────────────────────────────────────
    if tick_count > 0:
        prev_phase = arrays.cycle_phase
        cycle_phase = advance_cycle_phase(prev_phase, rng, arrays.cycle_transition_override)
        if cycle_phase != prev_phase:
            cycle_state = compute_cycle_state(cycle_phase, rng)
            arrays.cycle_state = cycle_state
            arrays.cycle_phase = cycle_phase
            arrays.f_m = cycle_state["market_factor_return"]
            arrays.sector_shocks = generate_sector_shocks(
                industry_ids=arrays.industry_ids,
                cycle_sensitivity_map={ind.id: float(ind.cycle_sensitivity)
                                        for ind in arrays.industries.values()},
                sector_beta_default_map={ind.id: float(ind.sector_beta_default)
                                          for ind in arrays.industries.values()},
                market_factor_return=arrays.f_m,
                rng=rng,
            )
            arrays.cycle_state_entries.append(dict(
                timeline_id=arrays.timeline_id,
                sim_date=sim_date,
                cycle_phase=cycle_phase,
                market_factor_return=arrays.f_m,
                gdp_growth=arrays.cycle_state["gdp_growth"],
                interest_rate=arrays.cycle_state["interest_rate"],
                market_sentiment=arrays.cycle_state["market_sentiment"],
            ))

    # ── IV drift (vectorized over companies) ─────────────────────────────
    growth_rate_min = float(arrays.params.get("growth_rate_min", DEFAULT_GROWTH_RATE_MIN))
    growth_rate_max = float(arrays.params.get("growth_rate_max", DEFAULT_GROWTH_RATE_MAX))
    for company in arrays.companies:
        iv_start = arrays.iv_overlay.get(company.id)
        if iv_start is not None:
            cfs = arrays.latest_cfs.get(company.id)
            growth_potential = float(cfs.growth_potential) if cfs else 50.0
            growth_rate_pct = growth_score_to_rate(growth_potential, growth_rate_min, growth_rate_max)
            arrays.iv_overlay[company.id] = float(drift_iv(
                iv_start, growth_rate_pct, TRADING_DAYS_PER_YEAR,
            ))

    # ── Compute drivers per company ──────────────────────────────────────
    pricing_data: dict[str, list] = {
        "company_ids": [], "y": [], "theta": [],
        "driver_values": [], "driver_weights": [],
        "beta_market": [], "beta_sector": [],
        "sector_factors": [], "sigma": [],
        "epsilon": [], "intrinsic_value": [],
    }
    company_ns: dict[int, float] = {}
    company_sigma: dict[int, float] = {}

    for company in arrays.companies:
        result = _bulk_compute_drivers(company, arrays, sim_date, tick_count, rng)
        if result is None:
            continue
        pricing_data["company_ids"].append(result["company_id"])
        pricing_data["y"].append(result["y"])
        pricing_data["theta"].append(result["theta"])
        pricing_data["driver_values"].append(result["driver_values"])
        pricing_data["driver_weights"].append(result["driver_weights"])
        pricing_data["beta_market"].append(result["beta_market"])
        pricing_data["beta_sector"].append(result["beta_sector"])
        pricing_data["sector_factors"].append(result["sector_factor"])
        pricing_data["sigma"].append(result["sigma"])
        pricing_data["epsilon"].append(result["epsilon"])
        pricing_data["intrinsic_value"].append(result["intrinsic_value"])
        company_ns[company.id] = result["news_severity"]
        company_sigma[company.id] = result["sigma"]

    if not pricing_data["company_ids"]:
        raise ValueError("No companies with valid pricing data")

    # ── Run the engine tick ──────────────────────────────────────────────
    tick_inputs = tuple(
        CompanyTickInput(
            company_id=cid, y=y, theta=th,
            driver_values=dv, driver_weights=dw,
            beta_market=bm, beta_sector=bs,
            sector_factor_return=sf, sigma=sig,
            epsilon=eps, intrinsic_value=iv,
        )
        for cid, y, th, dv, dw, bm, bs, sf, sig, eps, iv in zip(
            pricing_data["company_ids"],
            pricing_data["y"],
            pricing_data["theta"],
            pricing_data["driver_values"],
            pricing_data["driver_weights"],
            pricing_data["beta_market"],
            pricing_data["beta_sector"],
            pricing_data["sector_factors"],
            pricing_data["sigma"],
            pricing_data["epsilon"],
            pricing_data["intrinsic_value"],
        )
    )

    tick_state = TickState(
        sim_day=tick_count,
        market_factor_return=arrays.f_m,
        companies=tick_inputs,
        pressure_scale=float(arrays.params.get("k_drift", 0.03)),
    )
    tick_result = engine_run_tick(tick_state, k_drift=1.0)

    # ── Circuit breaker + OHLC + volume ──────────────────────────────────
    ohlc_results, volume_results, imbalance_results = _update_prices_and_ohlc(
        arrays.companies, arrays.company_by_id, tick_result, arrays.params,
        arrays.prev_ns, company_ns, rng, tick_count, arrays.price_overlay,
    )

    # ── Update in-memory overlays ────────────────────────────────────────
    for out in tick_result.outputs:
        cid = out.company_id
        ohlc = ohlc_results[cid]
        arrays.price_overlay[cid] = float(ohlc["close"])
        # recent_closes sliding window
        ma_window = int(arrays.params.get("ma_window", 20))
        if ma_window > 0:
            if cid not in arrays.recent_closes:
                arrays.recent_closes[cid] = collections.deque(maxlen=ma_window)
            arrays.recent_closes[cid].append(float(ohlc["close"]))

    arrays.prev_ns = dict(company_ns)

    # ── Build deferred insert rows ──────────────────────────────────────
    tick_input_by_id = {inp.company_id: inp for inp in tick_inputs}
    price_history_rows: list[dict] = []
    driver_score_rows: list[dict] = []

    for out in tick_result.outputs:
        cid = out.company_id
        ohlc = ohlc_results[cid]
        vol_val = volume_results[cid]
        imb = imbalance_results[cid]
        iv = float(tick_input_by_id[cid].intrinsic_value)

        price_history_rows.append(dict(
            timeline_id=arrays.timeline_id,
            company_id=cid,
            sim_date=sim_date,
            open=ohlc["open"],
            high=ohlc["high"],
            low=ohlc["low"],
            close=ohlc["close"],
            volume=vol_val,
            intrinsic_value=iv,
            order_imbalance=imb,
        ))

        inp = tick_input_by_id[cid]
        composite_price_pressure_val = composite_price_pressure(inp.driver_values, inp.driver_weights)
        DRIVER_KEYS_ORDERED_LOCAL = [
            "value_opportunity", "earnings_surprise", "news_severity",
            "economic_outlook", "guidance", "technical_momentum",
            "institutional_buying",
        ]
        for k_idx, drv_key in enumerate(DRIVER_KEYS_ORDERED_LOCAL):
            drv_val = float(inp.driver_values[k_idx])
            drv_w = float(inp.driver_weights[k_idx])
            raw_contribution = drv_w * drv_val / max(abs(composite_price_pressure_val), 1e-10)
            contribution = round(max(-1.0, min(1.0, raw_contribution)), 6)
            driver_score_rows.append(dict(
                timeline_id=arrays.timeline_id,
                company_id=cid,
                sim_date=sim_date,
                driver_key=drv_key,
                value=round(drv_val, 6),
                weight=round(drv_w, 6),
                contribution=contribution,
            ))

    # ── Advance in-memory sim state ──────────────────────────────────────
    arrays.current_sim_date = sim_date + timedelta(days=1)
    arrays.current_tick_count = tick_count + 1

    return TickMemoryOutput(
        sim_date=sim_date,
        tick_count=tick_count,
        ohlc_results=ohlc_results,
        volume_results=volume_results,
        imbalance_results=imbalance_results,
        tick_result=tick_result,
        tick_inputs=tick_inputs,
        driver_scores=driver_score_rows,
        price_history_rows=price_history_rows,
    )


def _bulk_compute_drivers(
    company: 'Company',
    arrays: TickStateArrays,
    sim_date: date,
    tick_count: int,
    rng: random.Random,
) -> Optional[dict]:
    """Compute all 7 driver values and OU pricing inputs for one company,
    using in-memory TickStateArrays instead of DB queries.
    """
    prev_close = arrays.price_overlay.get(company.id)
    if prev_close is None or prev_close <= 0:
        return None
    iv = arrays.iv_overlay.get(company.id)
    if iv is None or iv <= 0:
        return None

    ind = arrays.industries.get(company.industry_id)
    if ind is None:
        return None

    y = np.log(max(prev_close, 0.01) / max(iv, 0.01))
    _mcap = max(prev_close * float(company.shares_outstanding), 1e6)
    _log_mcap = math.log(_mcap / 1e9)
    theta_base = float(arrays.params.get("theta_default", 0.05))
    theta = theta_base * (0.3 + 1.2 * (1 + math.tanh(_log_mcap / 2)) / 2)
    BETA_JITTER_STD = 0.7
    beta_m = float(company.beta_market) * (1.0 + rng.gauss(0, BETA_JITTER_STD))
    beta_s = float(company.beta_sector) * (1.0 + rng.gauss(0, BETA_JITTER_STD))
    epsilon = rng.gauss(0, 1)
    s_factor = arrays.sector_shocks.get(company.industry_id, 0.0)

    ind_base_vol = float(ind.base_volatility) / math.sqrt(252)
    mcap = _mcap
    log_mcap = math.log(mcap / 1e9)
    f_size = 1.3 - 0.3 * math.tanh(log_mcap / 1.5)
    sigma_val = ind_base_vol * f_size
    bal = arrays.latest_bal.get(company.id)
    if bal:
        td = float(bal.total_debt)
        se = float(bal.shareholders_equity)
        if se > 0:
            leverage = td / se
            max_lev = float(arrays.params.get("vol_max_leverage", 5.0))
            lev_factor = float(arrays.params.get("vol_leverage_factor", 0.2))
            f_lev = 1.0 + lev_factor * min(leverage, max_lev)
            sigma_val *= f_lev

    vo = value_opportunity(iv, prev_close)
    trailing_closes = list(arrays.recent_closes.get(company.id, []))
    moving_avg = sum(trailing_closes) / len(trailing_closes) if trailing_closes else prev_close
    tm = technical_momentum(prev_close, moving_avg, float(arrays.params.get("k_m", 0.5)))
    ECON_OUTLOOK_JITTER_STD = 0.3
    eo = compute_economic_outlook(
        arrays.cycle_state["market_sentiment"] + rng.gauss(0, ECON_OUTLOOK_JITTER_STD)
    )

    latest_inc_row = arrays.latest_inc.get(company.id)
    latest_ce_row = arrays.latest_ce.get(company.id)
    days_since_earnings = tick_count % QUARTER_LENGTH

    es = 0.0
    if latest_inc_row and latest_ce_row:
        actual_eps = float(latest_inc_row.eps)
        consensus_eps = float(latest_ce_row.consensus_eps)
        es = earnings_surprise(actual_eps, consensus_eps, days_since_earnings,
                                float(arrays.params.get("earnings_surprise_decay_rate", 0.15)))

    gd = 0.0
    if latest_inc_row and latest_ce_row:
        actual_eps = float(latest_inc_row.eps)
        consensus_eps = float(latest_ce_row.consensus_eps)
        beat = actual_eps > consensus_eps
        miss = actual_eps < consensus_eps
        if beat:
            gd = guidance("raised", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5),
                           days_since_earnings, float(arrays.params.get("guidance_decay_rate", 0.15)))
        elif miss:
            gd = guidance("cut", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5),
                           days_since_earnings, float(arrays.params.get("guidance_decay_rate", 0.15)))

    ib = institutional_buying(rng.uniform(-0.1, 0.1) + arrays.cycle_state.get("market_sentiment", 0) * 0.05)

    ns = 0.0
    active_events = _get_active_events_for_company(
        arrays.market_events, arrays.industry_events, arrays.company_events, arrays.event_defs,
        company.id, ind.id, sim_date - timedelta(days=arrays.current_tick_count),
    )
    if active_events:
        active_events = _jitter_event_severities(active_events, rng, EVENT_SEVERITY_JITTER_STD)
        ns = news_severity(active_events, tick_count, float(arrays.params.get("news_decay_rate", 0.1)))

    driver_values = {
        "value_opportunity": vo,
        "earnings_surprise": es,
        "news_severity": ns,
        "economic_outlook": eo,
        "guidance": gd,
        "technical_momentum": tm,
        "institutional_buying": ib,
    }

    if active_events:
        for event_data in active_events:
            effect_profile = {
                k: v for k, v in event_data.get("effect_profile", {}).items() if k in DRIVER_KEYS
            }
            if effect_profile:
                severity = event_data.get("severity", 0.0)
                decay_rate = event_data.get("decay_rate", 0.1)
                start_day = event_data.get("start_day", 0)
                days_elapsed = tick_count - start_day
                driver_effects = {k: v for k, v in effect_profile.items() if k in DRIVER_KEYS}
                if driver_effects:
                    driver_values = apply_effect_to_drivers(
                        driver_values, driver_effects, severity, decay_rate, days_elapsed,
                    )

    if arrays.driver_bias_map:
        market_bias = arrays.driver_bias_map.get(None, {})
        company_bias = arrays.driver_bias_map.get(company.id, {})
        combined_bias = {**market_bias}
        for key, delta in company_bias.items():
            combined_bias[key] = combined_bias.get(key, 0.0) + delta
        if combined_bias:
            driver_values = apply_driver_bias(driver_values, combined_bias)

    drv_weights = {
        "value_opportunity": float(arrays.params.get("w_vo", 0.10)),
        "earnings_surprise": float(arrays.params.get("w_es", 0.15)),
        "news_severity": float(arrays.params.get("w_ns", 0.25)),
        "economic_outlook": float(arrays.params.get("w_eo", 0.25)),
        "guidance": float(arrays.params.get("w_g", 0.15)),
        "technical_momentum": float(arrays.params.get("w_tm", 0.10)),
        "institutional_buying": float(arrays.params.get("w_ib", 0.15)),
    }

    news_severity_val = driver_values.get("news_severity", ns)

    return {
        "company_id": company.id,
        "y": y,
        "theta": theta,
        "driver_values": driver_values,
        "driver_weights": drv_weights,
        "beta_market": beta_m,
        "beta_sector": beta_s,
        "sector_factor": s_factor,
        "sigma": sigma_val,
        "epsilon": epsilon,
        "intrinsic_value": iv,
        "news_severity": news_severity_val,
    }


def _bulk_refresh_fundamentals(
    arrays: TickStateArrays,
    session: Session,
) -> None:
    """Refresh financial statement caches at quarter boundary for bulk mode.

    Re-queries the latest financial statements from DB (one batch query per
    table) and updates the TickStateArrays caches so the next tick's driver
    computations see the latest quarter's data. Does NOT generate new
    financial statements — the interactive path handles that via
    _refresh_fundamentals. In bulk fast-forward mode, the statements from
    the interactive ticks leading up to the bulk start are sufficient to
    maintain proper driver computation dynamics.
    """
    all_bal = session.query(BalanceSheet).filter_by(timeline_id=arrays.timeline_id).order_by(
        BalanceSheet.fiscal_period.desc()
    ).all()
    latest_bal: dict[int, BalanceSheet] = {}
    for bal in all_bal:
        if bal.company_id not in latest_bal:
            latest_bal[bal.company_id] = bal
    arrays.latest_bal = latest_bal

    all_inc = session.query(IncomeStatement).filter_by(timeline_id=arrays.timeline_id).order_by(
        IncomeStatement.fiscal_period.desc()
    ).all()
    latest_inc: dict[int, IncomeStatement] = {}
    for inc in all_inc:
        if inc.company_id not in latest_inc:
            latest_inc[inc.company_id] = inc
    arrays.latest_inc = latest_inc

    all_ce = session.query(ConsensusEstimate).filter_by(timeline_id=arrays.timeline_id).order_by(
        ConsensusEstimate.fiscal_period.desc()
    ).all()
    latest_ce: dict[int, ConsensusEstimate] = {}
    for ce in all_ce:
        if ce.company_id not in latest_ce:
            latest_ce[ce.company_id] = ce
    arrays.latest_ce = latest_ce

    all_cfs = session.query(CompanyFactorScore).filter_by(timeline_id=arrays.timeline_id).order_by(
        CompanyFactorScore.fiscal_period.desc()
    ).all()
    latest_cfs: dict[int, CompanyFactorScore] = {}
    for cfs_row in all_cfs:
        if cfs_row.company_id not in latest_cfs:
            latest_cfs[cfs_row.company_id] = cfs_row
    arrays.latest_cfs = latest_cfs


def _bulk_flush(
    arrays: TickStateArrays,
    arrays_after_last_tick: TickMemoryOutput,
    session: Session,
) -> None:
    """Write all deferred buffers to SQLite in one go.

    Takes the TickStateArrays (which has accumulated buffers) and the
    final tick's TickMemoryOutput, and writes everything.
    """
    # PriceHistory rows
    if arrays.price_history_buffer:
        session.execute(insert(PriceHistory), arrays.price_history_buffer)

    # PriceDriverScore rows
    if arrays.driver_score_buffer:
        session.execute(insert(PriceDriverScore), arrays.driver_score_buffer)

    # EconomicCycleState entries
    for entry in arrays.cycle_state_entries:
        session.add(EconomicCycleState(**entry))

    # Update SimulationState pointer
    sim_state = session.query(SimulationState).filter_by(timeline_id=arrays.timeline_id).first()
    if sim_state is not None:
        sim_state.current_sim_date = arrays.current_sim_date
        sim_state.tick_count = arrays.current_tick_count
        sim_state.is_running = True

    session.flush()
    session.commit()


def bulk_run_ticks(
    session: Session,
    timeline_id: int,
    num_ticks: int = 1,
    skip_events: bool = True,
    skip_news: bool = True,
    skip_concalls: bool = True,
    flush_interval: Optional[int] = None,
) -> list[dict]:
    """Run N ticks entirely in memory, bulk-write once at the end.

    Phase 1: Load static reference data once.
    Phase 2: Run N ticks in memory, accumulating deferred-insert buffers.
    Phase 3: Flush all buffers to DB in one go.

    Returns a list of per-tick result dicts (same format as run_ticks,
    but without per-tick DB round-trips).
    """
    # ── Phase 1: Load static reference data ──────────────────────────────
    timeline = session.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise ValueError(f"Timeline {timeline_id} not found")

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        raise ValueError(f"No SimulationState for timeline {timeline_id}")

    # Load static data
    arrays = _load_static_tick_state(session, timeline_id, timeline)

    # Initialize mutable state from sim_state
    arrays.current_sim_date = sim_state.current_sim_date
    arrays.current_tick_count = sim_state.tick_count

    # Resolve tick target date (same logic as _resolve_tick_target_date)
    sim_date = sim_state.current_sim_date
    if not sim_state.is_running:
        seeded_baseline_exists = session.query(PriceHistory).filter_by(
            timeline_id=timeline_id, sim_date=sim_date
        ).first() is not None
        if seeded_baseline_exists:
            sim_date = sim_date + timedelta(days=1)
            arrays.current_sim_date = sim_date

    # Load price/IV overlays from DB
    arrays.price_overlay = {
        cid: float(price)
        for cid, price in get_latest_prices(
            session, [c.id for c in arrays.companies], timeline_id, arrays.timeline_chain
        ).items()
    }
    arrays.iv_overlay = {
        cid: float(iv)
        for cid, iv in get_latest_intrinsic_values(
            session, [c.id for c in arrays.companies], timeline_id, arrays.timeline_chain
        ).items()
    }

    # Load sector shocks for initial cycle state
    arrays.f_m = sim_state.f_m if hasattr(sim_state, 'f_m') else 0.0
    arrays.cycle_phase = sim_state.cycle_phase if hasattr(sim_state, 'cycle_phase') else "expansion"

    # Initial cycle state from DB
    latest_cycle = session.query(EconomicCycleState).filter_by(
        timeline_id=timeline_id
    ).order_by(EconomicCycleState.sim_date.desc()).first()
    if latest_cycle is not None:
        arrays.cycle_phase = latest_cycle.cycle_phase
        arrays.cycle_state = {
            "market_factor_return": float(latest_cycle.market_factor_return),
            "gdp_growth": float(latest_cycle.gdp_growth),
            "interest_rate": float(latest_cycle.interest_rate),
            "market_sentiment": float(latest_cycle.market_sentiment),
        }
        arrays.f_m = float(latest_cycle.market_factor_return)
        rng_init = random.Random(timeline.rng_seed + arrays.current_tick_count)
        arrays.sector_shocks = generate_sector_shocks(
            industry_ids=arrays.industry_ids,
            cycle_sensitivity_map={ind.id: float(ind.cycle_sensitivity)
                                    for ind in arrays.industries.values()},
            sector_beta_default_map={ind.id: float(ind.sector_beta_default)
                                      for ind in arrays.industries.values()},
            market_factor_return=arrays.f_m,
            rng=rng_init,
        )

    # Load recent closes from DB for MA computation
    ma_window = int(arrays.params.get("ma_window", 20))
    if ma_window > 0:
        window_start = sim_date - timedelta(days=ma_window)
        price_rows = (
            session.query(PriceHistory.company_id, PriceHistory.close)
            .filter(
                PriceHistory.timeline_id == timeline_id,
                PriceHistory.sim_date >= window_start,
                PriceHistory.sim_date < sim_date,
            )
            .order_by(PriceHistory.sim_date.asc())
            .all()
        )
        for company_id, close in price_rows:
            closes = arrays.recent_closes.setdefault(company_id, collections.deque(maxlen=ma_window))
            closes.append(float(close))

    # Load prev_ns from DB
    prev_ns: dict[int, float] = {}
    if arrays.current_tick_count > 0:
        prev_date = sim_date - timedelta(days=1)
        prev_scores = session.query(PriceDriverScore).filter_by(
            timeline_id=timeline_id, sim_date=prev_date, driver_key="news_severity"
        ).all()
        for ps in prev_scores:
            prev_ns[ps.company_id] = float(ps.value)
    arrays.prev_ns = prev_ns

    # Load active events (batch-loaded once)
    market_events, industry_events, company_events, event_defs = _load_active_events(
        session, timeline_id, sim_date,
    )
    arrays.market_events = market_events
    arrays.industry_events = industry_events
    arrays.company_events = company_events
    arrays.event_defs = event_defs

    # Override active overrides for this start date
    override_rows = session.query(TimelineOverride).filter_by(timeline_id=timeline_id).all()
    active_overrides = resolve_active_overrides(override_rows, sim_date)
    arrays.params = apply_config_overrides(arrays.params, active_overrides.get("config", []))
    arrays.driver_bias_map = driver_bias_by_company(active_overrides.get("driver_bias", []))
    arrays.factor_score_bias_map = factor_score_bias_by_company(active_overrides.get("factor_score", []))
    cycle_transition_override = None
    for row in active_overrides.get("cycle_transition", []):
        try:
            strength = float(row.override_value)
        except (TypeError, ValueError):
            strength = 1.0
        cycle_transition_override = build_cycle_transition_override(row.target_key, strength)
    arrays.cycle_transition_override = cycle_transition_override

    results: list[dict] = []

    # ── Phase 2: Run N ticks in memory ──────────────────────────────────
    for _ in range(num_ticks):
        _t0 = time.perf_counter()

        # Quarter boundary: refresh financial statement caches
        if arrays.current_tick_count > 0 and arrays.current_tick_count % QUARTER_LENGTH == 0:
            _bulk_refresh_fundamentals(arrays, session)

        # Apply skip logic: skip events/news/concalls during bulk
        # (handled naturally since we don't call _execute_events in the loop)
        output = _bulk_tick_iteration(arrays)

        # Accumulate deferred buffers
        arrays.price_history_buffer.extend(output.price_history_rows)
        arrays.driver_score_buffer.extend(output.driver_scores)

        # Intermediate flush if flush_interval is set
        if flush_interval is not None and len(arrays.price_history_buffer) >= flush_interval * 150:
            _bulk_flush(arrays, output, session)
            # Clear buffers after intermediate flush
            arrays.price_history_buffer = []
            arrays.driver_score_buffer = []

        _elapsed = (time.perf_counter() - _t0) * 1000
        _tag = f"BULK{output.tick_count}"
        print(f"[TIMING {_tag}] total={_elapsed:.1f}ms")

        results.append({
            "status": "completed",
            "sim_date": output.sim_date,
            "next_date": arrays.current_sim_date,
            "tick_count": arrays.current_tick_count,
            "companies_updated": len(output.tick_result.outputs),
            "cycle_phase": arrays.cycle_phase,
            "market_factor_return": arrays.f_m,
        })

        # Skip events/news/concalls during bulk loop
        # (events are optionally fired once post-bulk in Phase 4)

    # ── Phase 3: Bulk flush ─────────────────────────────────────────────
    # Apply SQLite bulk pragmas before flush
    if session.bind.dialect.name == "sqlite":
        conn = session.connection()
        conn.execute(text("PRAGMA synchronous=OFF"))
        conn.execute(text("PRAGMA cache_size=-2000000"))

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is not None:
        sim_state.current_sim_date = arrays.current_sim_date
        sim_state.tick_count = arrays.current_tick_count
        sim_state.is_running = True

    if arrays.price_history_buffer:
        session.execute(insert(PriceHistory), arrays.price_history_buffer)
    if arrays.driver_score_buffer:
        session.execute(insert(PriceDriverScore), arrays.driver_score_buffer)

    for entry in arrays.cycle_state_entries:
        session.add(EconomicCycleState(**entry))

    session.flush()
    session.commit()

    # Restore SQLite pragmas after bulk flush
    if session.bind.dialect.name == "sqlite":
        conn = session.connection()
        conn.execute(text("PRAGMA synchronous=NORMAL"))
        conn.execute(text("PRAGMA cache_size=-1000000"))

    # ── Phase 4: Post-bulk bookkeeping ──────────────────────────────────
    try:
        from apps.api.services.trade_service import check_and_fill_limit_orders
        from apps.api.services import notification_service
        check_and_fill_limit_orders(session, timeline_id)
    except Exception as exc:
        logger.warning("Post-bulk limit order check failed: %s", exc)

    try:
        notification_service.evaluate_price_alerts(session, timeline_id)
    except Exception as exc:
        logger.warning("Post-bulk price alert evaluation failed: %s", exc)

    try:
        notification_service.evaluate_watchlist_movers(session, timeline_id)
    except Exception as exc:
        logger.warning("Post-bulk watchlist mover evaluation failed: %s", exc)

    return results
