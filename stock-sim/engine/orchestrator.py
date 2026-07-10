"""Phase 4 — Full engine-to-DB simulation tick orchestration loop.

Wires the pure-function engine modules (tick, market, drivers, valuation, liquidity,
ohlc, cycle, events) to the database.  Each call to run_tick() advances the
simulation by one business day for all companies.
"""

import math
import random
from datetime import date, datetime, timezone, timedelta
from types import SimpleNamespace
from typing import Optional

import numpy as np
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
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
    Portfolio,
    PriceDriverScore,
    PriceHistory,
    SimulationState,
    Timeline,
)
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
from engine.scoring import (
    financial_quality_composite,
    intrinsic_score as compute_intrinsic_score,
    moat_composite,
    percentile_rank_scores,
)
from engine.tick import CompanyTickInput, CompanyTickOutput, TickResult, TickState, run_tick as engine_run_tick
from engine.valuation import (
    DEFAULT_GROWTH_RATE_MAX,
    DEFAULT_GROWTH_RATE_MIN,
    DEFAULT_M_INFLECTION,
    DEFAULT_M_MAX,
    DEFAULT_M_MIN,
    DEFAULT_M_STEEPNESS,
    drift_iv,
    fair_pe_from_peg,
    fair_peg,
    growth_score_to_rate,
    intrinsic_value_per_share,
)

TAX_RATE = 0.25
TRADING_DAYS_PER_YEAR = 252
QUARTER_LENGTH = 63
DRIVER_KEYS = frozenset({
    "value_opportunity", "earnings_surprise", "news_severity",
    "economic_outlook", "guidance", "technical_momentum",
    "institutional_buying",
})


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
    for _ in range(num_ticks):
        state = _load_tick_state(session, timeline_id)
        sim_date = state.sim_date
        tick_count = state.tick_count
        companies = state.companies

        existing = session.query(PriceHistory).filter_by(
            timeline_id=timeline_id, sim_date=sim_date
        ).first()
        if existing is not None:
            results.append({"status": "skipped", "reason": "already_executed", "sim_date": sim_date})
            continue

        # -- Quarter boundary: refresh fundamentals -------------------------
        if state.is_quarter_boundary:
            _refresh_fundamentals(
                session, timeline_id, companies, state.industries,
                state.params, state.neutral_industry_pegs,
                datetime.now(timezone.utc), state.rng, tick_count,
            )

        # -- IV drift -------------------------------------------------------
        for company in companies:
            if company.intrinsic_value is not None:
                expected_growth = float(state.params.get("expected_annual_growth", 0.08))
                company.intrinsic_value = float(drift_iv(
                    float(company.intrinsic_value), expected_growth, TRADING_DAYS_PER_YEAR,
                ))

        # -- Compute drivers per company ------------------------------------
        pricing_data: dict[str, list] = {
            "company_ids": [], "y": [], "theta": [],
            "driver_values": [], "driver_weights": [],
            "beta_market": [], "beta_sector": [],
            "sector_factors": [], "sigma": [],
            "epsilon": [], "intrinsic_value": [],
        }
        company_ns: dict[int, float] = {}

        for company in companies:
            result = _compute_drivers(session, company, state, timeline_id, sim_date, tick_count)
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
        )
        tick_result = engine_run_tick(tick_state)

        # -- Circuit breaker + OHLC + volume --------------------------------
        ohlc_results, volume_results, imbalance_results = _update_prices_and_ohlc(
            companies, tick_result, state.params, state.prev_ns, company_ns, state.rng, tick_count,
        )

        # -- Write DB rows --------------------------------------------------
        _write_tick_results(
            session, timeline_id, sim_date, companies, tick_inputs, tick_result,
            ohlc_results, volume_results, imbalance_results,
        )

        # -- Update denormalized Company fields -----------------------------
        _update_denormalized_fields(
            companies, ohlc_results, volume_results, tick_result,
        )

        # -- Mark to market -------------------------------------------------
        _mark_to_market(session, timeline_id, companies)

        # -- Fire events + generate news ------------------------------------
        _execute_events(session, timeline_id, state, sim_date, companies)

        # -- Advance simulation state ---------------------------------------
        next_date = sim_date + timedelta(days=1)
        state.sim_state.current_sim_date = next_date
        state.sim_state.tick_count = tick_count + 1
        state.sim_state.is_running = True

        session.flush()

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


def _load_tick_state(session: Session, timeline_id: int) -> SimpleNamespace:
    """Load and return all simulation state for one tick.

    Loads timeline, sim_state, economic cycle, companies, industries, balance
    sheets, and previous tick news_severity.  Raises ValueError if the timeline
    or simulation state does not exist.  Does NOT check idempotency — the
    caller is responsible for that.
    """
    timeline = session.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise ValueError(f"Timeline {timeline_id} not found")

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        raise ValueError(f"No SimulationState for timeline {timeline_id} -- run seed_initial_prices first")

    sim_date = sim_state.current_sim_date
    tick_count = sim_state.tick_count
    epoch_start = sim_date - timedelta(days=tick_count)

    rng = random.Random(timeline.rng_seed + tick_count)
    params = _load_params(session)
    neutral_industry_pegs = _load_neutral_industry_pegs(session)

    # Economic cycle
    latest_cycle = session.query(EconomicCycleState).filter_by(
        timeline_id=timeline_id
    ).order_by(EconomicCycleState.sim_date.desc()).first()

    if latest_cycle is None or latest_cycle.sim_date < sim_date:
        prev_phase = latest_cycle.cycle_phase if latest_cycle else "expansion"
        cycle_phase = advance_cycle_phase(prev_phase, rng)
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

    companies = session.query(Company).all()
    industries = {ind.id: ind for ind in session.query(Industry).all()}
    industry_ids = list(industries.keys())

    sector_shocks = generate_sector_shocks(
        industry_ids=industry_ids,
        cycle_sensitivity_map={ind.id: float(ind.cycle_sensitivity) for ind in industries.values()},
        sector_beta_default_map={ind.id: float(ind.sector_beta_default) for ind in industries.values()},
        market_factor_return=f_m,
        rng=rng,
    )

    all_bal = session.query(BalanceSheet).order_by(BalanceSheet.fiscal_period.desc()).all()
    latest_bal: dict[int, BalanceSheet] = {}
    for bal in all_bal:
        if bal.company_id not in latest_bal:
            latest_bal[bal.company_id] = bal

    # Batch-load IncomeStatement and ConsensusEstimate so _compute_drivers
    # does not issue N queries per company per tick.
    all_inc = session.query(IncomeStatement).order_by(IncomeStatement.fiscal_period.desc()).all()
    latest_inc: dict[int, IncomeStatement] = {}
    for inc in all_inc:
        if inc.company_id not in latest_inc:
            latest_inc[inc.company_id] = inc

    all_ce = session.query(ConsensusEstimate).order_by(ConsensusEstimate.fiscal_period.desc()).all()
    latest_ce: dict[int, ConsensusEstimate] = {}
    for ce in all_ce:
        if ce.company_id not in latest_ce:
            latest_ce[ce.company_id] = ce

    # Trailing closes for the technical_momentum moving average, batch-loaded
    # so _compute_drivers doesn't issue N queries per company per tick.
    ma_window = int(params.get("ma_window", 20))
    recent_closes: dict[int, list[float]] = {}
    if ma_window > 0:
        window_start = sim_date - timedelta(days=ma_window * 3)  # calendar-day buffer for weekends/gaps
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
        industries=industries,
        industry_ids=industry_ids,
        sector_shocks=sector_shocks,
        latest_bal=latest_bal,
        latest_inc=latest_inc,
        latest_ce=latest_ce,
        recent_closes=recent_closes,
        prev_ns=prev_ns,
        is_quarter_boundary=is_quarter_boundary,
    )


def _compute_drivers(
    session: Session,
    company: Company,
    state: SimpleNamespace,
    timeline_id: int,
    sim_date: date,
    tick_count: int,
) -> Optional[dict]:
    """Compute all 7 driver values and OU pricing inputs for one company.

    Returns a dict with keys: company_id, y, theta, driver_values,
    driver_weights, beta_market, beta_sector, sector_factor, sigma, epsilon,
    intrinsic_value, news_severity.  Returns None if the company has invalid
    pricing data (missing price or intrinsic value).
    """
    if company.current_price is None or company.current_price <= 0:
        return None
    if company.intrinsic_value is None or company.intrinsic_value <= 0:
        return None

    ind = state.industries.get(company.industry_id)
    if ind is None:  # pragma: no cover — blocked by FK constraint
        return None  # pragma: no cover

    prev_close = float(company.current_price)
    iv = float(company.intrinsic_value)

    y = np.log(max(prev_close, 0.01) / max(iv, 0.01))
    theta = float(state.params.get("mean_reversion_rate", 0.05))
    beta_m = float(company.beta_market)
    beta_s = float(company.beta_sector)
    epsilon = state.rng.gauss(0, 1)
    s_factor = state.sector_shocks.get(company.industry_id, 0.0)

    ind_base_vol = float(ind.base_volatility) / 100.0
    mcap = max(float(company.market_cap or 1e9), 1e6)
    log_mcap = math.log(mcap / 1e9)
    f_size = 1.0 - 0.2 * math.tanh(log_mcap)
    sigma_val = ind_base_vol * f_size
    bal = state.latest_bal.get(company.id)
    if bal:
        td = float(bal.total_debt)
        se = float(bal.shareholders_equity)
        if se > 0:
            leverage = td / se
            max_lev = float(state.params.get("vol_max_leverage", 5.0))
            lev_factor = float(state.params.get("vol_leverage_factor", 0.3))
            f_lev = 1.0 + lev_factor * min(leverage, max_lev)
            sigma_val *= f_lev

    vo = value_opportunity(iv, prev_close)
    trailing_closes = state.recent_closes.get(company.id, [])
    moving_avg = sum(trailing_closes) / len(trailing_closes) if trailing_closes else prev_close
    tm = technical_momentum(prev_close, moving_avg, float(state.params.get("k_m", 0.5)))
    eo = compute_economic_outlook(state.cycle_state["market_sentiment"])

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
        es = earnings_surprise(actual_eps, consensus_eps, days_since_earnings, float(state.params.get("rho_es", 0.15)))

    gd = 0.0
    if latest_inc and latest_ce:
        actual_eps = float(latest_inc.eps)
        consensus_eps = float(latest_ce.consensus_eps)
        beat = actual_eps > consensus_eps
        miss = actual_eps < consensus_eps
        if beat:
            gd = guidance("raised", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5), days_since_earnings, float(state.params.get("rho_g", 0.15)))
        elif miss:
            gd = guidance("cut", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5), days_since_earnings, float(state.params.get("rho_g", 0.15)))

    ib = institutional_buying(state.rng.uniform(-0.1, 0.1) + state.cycle_state.get("market_sentiment", 0) * 0.05)

    ns = 0.0
    active_events = _get_active_events_for_company(
        session, timeline_id, company.id, ind.id, sim_date, state.epoch_start,
    )
    if active_events:
        ns = news_severity(active_events, tick_count, float(state.params.get("rho_news", 0.1)))

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
            effect_profile = event_data.get("effect_profile", {})
            if effect_profile:
                severity = event_data.get("severity", 0.0)
                decay_rate = event_data.get("decay_rate", 0.1)
                start_day = event_data.get("start_day", 0)
                days_elapsed = tick_count - start_day
                driver_values = apply_effect_to_drivers(
                    driver_values, effect_profile, severity, decay_rate, days_elapsed,
                )

    drv_weights = {
        "value_opportunity": float(state.params.get("w_vo", 0.20)),
        "earnings_surprise": float(state.params.get("w_es", 0.15)),
        "news_severity": float(state.params.get("w_ns", 0.15)),
        "economic_outlook": float(state.params.get("w_eo", 0.10)),
        "guidance": float(state.params.get("w_g", 0.15)),
        "technical_momentum": float(state.params.get("w_tm", 0.10)),
        "institutional_buying": float(state.params.get("w_ib", 0.15)),
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


def _update_prices_and_ohlc(
    companies: list[Company],
    tick_result: TickResult,
    params: dict[str, float],
    prev_ns: dict[int, float],
    company_ns: dict[int, float],
    rng: random.Random,
    tick_count: int,
) -> tuple[dict[int, dict], dict[int, int], dict[int, float]]:
    """Apply circuit breaker, synthesize OHLC, and compute volume for each company.

    Returns (ohlc_results, volume_results, imbalance_results) keyed by company_id.
    """
    r_cap = float(params.get("r_cap", 0.20))

    prev_prices: dict[int, float] = {}
    for company in companies:
        if company.current_price is not None:
            prev_prices[company.id] = float(company.current_price)

    ohlc_results: dict[int, dict] = {}
    volume_results: dict[int, int] = {}
    imbalance_results: dict[int, float] = {}

    for out in tick_result.outputs:
        cid = out.company_id
        prev_close = prev_prices.get(cid, 100.0)
        raw_price = out.price
        cb_price = apply_circuit_breaker(raw_price, prev_close, r_cap=r_cap)
        ohlc = synthesize_ohlc(prev_close, cb_price, rng)

        company = next((c for c in companies if c.id == cid), None)
        free_float = float(company.free_float_pct) if company else 0.5
        mcap = float(company.market_cap or 1e9)

        abs_return = abs(cb_price - prev_close) / max(prev_close, 0.01)
        ns_now = company_ns.get(cid, 0.0)
        ns_prev = prev_ns.get(cid, 0.0)
        ns_delta = abs(ns_now - ns_prev)
        is_earnings_day = False
        if tick_count > 5:
            is_earnings_day = (tick_count % QUARTER_LENGTH) <= 5

        vol = compute_volume_prd(
            market_cap=mcap,
            free_float_pct=free_float,
            abs_return=abs_return,
            news_severity_delta=ns_delta,
            is_earnings_day=is_earnings_day,
            turnover_rate=float(params.get("vol_turnover_rate", 0.001)),
            coeff_return=float(params.get("vol_coeff_return", 0.5)),
            coeff_news=float(params.get("vol_coeff_news", 0.3)),
            coeff_earnings=float(params.get("vol_coeff_earnings", 0.2)),
            noise_sigma=float(params.get("vol_noise_sigma", 0.1)),
            rng=rng,
        )

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
    companies: list[Company],
    tick_inputs: tuple[CompanyTickInput, ...],
    tick_result: TickResult,
    ohlc_results: dict[int, dict],
    volume_results: dict[int, int],
    imbalance_results: dict[int, float],
) -> None:
    """Write PriceHistory and PriceDriverScore rows for all companies."""
    for out in tick_result.outputs:
        cid = out.company_id
        ohlc = ohlc_results[cid]
        vol_val = volume_results[cid]
        imb = imbalance_results[cid]
        iv = float(next(c.intrinsic_value for c in companies if c.id == cid))

        ph = PriceHistory(
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
        )
        session.add(ph)

        inp = next(c for c in tick_inputs if c.company_id == cid)
        total_pressure = composite_price_pressure(inp.driver_values, inp.driver_weights)
        for drv_key, drv_val in inp.driver_values.items():
            drv_w = inp.driver_weights.get(drv_key, 0.0)
            session.add(PriceDriverScore(
                timeline_id=timeline_id,
                company_id=cid,
                sim_date=sim_date,
                driver_key=drv_key,
                value=round(drv_val, 6),
                weight=round(drv_w, 6),
                contribution=round(drv_w * drv_val / max(abs(total_pressure), 1e-10), 6),
            ))


def _update_denormalized_fields(
    companies: list[Company],
    ohlc_results: dict[int, dict],
    volume_results: dict[int, int],
    tick_result: TickResult,
) -> None:
    """Update Company.current_price, .intrinsic_value, .market_cap, .market_liquidity_score."""
    for out in tick_result.outputs:
        cid = out.company_id
        ohlc = ohlc_results[cid]
        vol_val = volume_results[cid]
        company = next(c for c in companies if c.id == cid)
        iv = float(company.intrinsic_value)
        company.current_price = round(ohlc["close"], 4)
        company.intrinsic_value = round(iv, 4)
        company.market_cap = round(ohlc["close"] * float(company.shares_outstanding), 2)
        liq_score = market_liquidity_score(
            float(company.free_float_pct), vol_val, float(company.market_cap or 1e9),
        )
        company.market_liquidity_score = round(liq_score, 4)


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
    )
    for ev in fired_events:
        event_instances = session.query(EventInstance).filter_by(
            event_id=ev.id, timeline_id=timeline_id, sim_date=sim_date,
        ).all()
        for ei in event_instances:
            company_name = None
            industry_name = None
            if ei.scope_type == "company":
                comp = session.query(Company).filter_by(id=ei.scope_ref).first()
                if comp:
                    company_name = comp.name
            elif ei.scope_type == "industry":
                ind = session.query(Industry).filter_by(id=ei.scope_ref).first()
                if ind:
                    industry_name = ind.name
            generate_news(session, timeline_id, sim_date, ei, state.rng,
                          company_name=company_name, industry_name=industry_name)

    _apply_event_factor_effects(
        session, companies, fired_events, sim_date, timeline_id,
        state.rng, state.params, state.neutral_industry_pegs,
        datetime.now(timezone.utc), state.industries,
    )


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
    fpe = fair_pe_from_peg(peg, growth_rate_pct)
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
) -> None:
    """Section 6.F -- generate new financial statements and recompute FQ/IV at quarter boundary."""
    pw_rows = session.query(IndustryPillarWeight).all()
    industry_pw: dict[int, dict[str, float]] = {}
    for pw in pw_rows:
        industry_pw.setdefault(pw.industry_id, {})[pw.pillar] = float(pw.weight)

    fq_defs = session.query(FactorDefinition).filter_by(factor_type="fq_sub").all()
    subfactor_pillar = {fd.key: fd.pillar for fd in fq_defs}
    fq_directions = {fd.key: fd.direction for fd in fq_defs}
    fq_keys = [fd.key for fd in fq_defs]

    moat_defs = session.query(FactorDefinition).filter_by(factor_type="moat_sub").all()
    moat_weights = {md.key: float(md.default_weight) for md in moat_defs if md.default_weight}

    moat_scores: dict[int, dict[str, float]] = {}
    for ms in session.query(MoatSubscore).all():
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
    for cfs_row in session.query(CompanyFactorScore).order_by(CompanyFactorScore.id.asc()).all():
        latest_cfs_by_company[cfs_row.company_id] = cfs_row

    company_rows = []
    for company in companies:
        raw = _generate_fake_quarterly_financials(session, company, latest_period, rng)
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
        mgmt = float(prior_cfs.management_quality) if prior_cfs else 50.0
        growth = float(prior_cfs.growth_potential) if prior_cfs else 50.0
        fcfq = float(prior_cfs.fcf_quality) if prior_cfs else 50.0
        iscore = compute_intrinsic_score(mgmt, moat_val, fq, fcfq, growth)

        eps_val = float(r["raw"].get("eps", 0.0))
        fpe, iv = _recompute_valuation(
            iscore, growth, company.industry_id, neutral_industry_pegs, params, eps_val,
        )

        cfs = CompanyFactorScore(
            company_id=company.id,
            fiscal_period=latest_period,
            management_quality=round(mgmt, 4),
            moat_score=round(moat_val, 4),
            financial_quality=round(fq, 4),
            fcf_quality=round(fcfq, 4),
            growth_potential=round(growth, 4),
            intrinsic_score=round(iscore, 4),
            fair_pe=round(fpe, 4),
            intrinsic_value=round(iv, 4),
            computed_at=now,
        )
        session.add(cfs)

        company.intrinsic_value = round(iv, 4)
        company.intrinsic_score = round(iscore, 4)
        company.fair_pe = round(fpe, 4)

        for sub_key, sub_score in r["fq_subscores"].items():
            pillar = subfactor_pillar[sub_key]
            pw_val = ind_pw.get(pillar, 0.0)
            n_in_pillar = max(sum(1 for k in fq_keys if subfactor_pillar.get(k) == pillar), 1)
            applied_w = pw_val / n_in_pillar
            # Use per-company percentile from the stored dict
            peer_pct = r["fq_percentiles"].get(sub_key, 50.0)
            session.add(FinancialQualitySubscore(
                company_id=company.id,
                fiscal_period=latest_period,
                subfactor_key=sub_key,
                raw_metric_value=_safe_finite(r["raw"].get(sub_key, 0.0)),
                peer_percentile=peer_pct,
                subscore=sub_score,
                applied_weight=applied_w,
            ))


def _generate_fake_quarterly_financials(
    session: Session,
    company: Company,
    fiscal_period: str,
    rng: random.Random,
) -> dict[str, float]:
    """Generate plausible next-quarter financials from the most recent quarter."""
    # Full statement history (queried before this quarter's new rows are
    # added below) so earnings_stability/revenue_consistency have real
    # multi-period series instead of the seed's neutral 50.0 placeholders.
    prior_incs = session.query(IncomeStatement).filter_by(
        company_id=company.id
    ).order_by(IncomeStatement.fiscal_period.asc()).all()
    eps_history = [float(i.eps) for i in prior_incs]
    revenue_history = [float(i.revenue) for i in prior_incs]

    latest_inc = prior_incs[-1] if prior_incs else None

    latest_bal = session.query(BalanceSheet).filter_by(
        company_id=company.id
    ).order_by(BalanceSheet.fiscal_period.desc()).first()

    if latest_inc:
        rev = float(latest_inc.revenue) * (1 + rng.gauss(0.01, 0.03))
    else:
        rev = rng.uniform(1e8, 1e10)
    rev = max(rev, 1e6)

    cogs = rev * rng.uniform(0.4, 0.7)
    gp = rev - cogs
    op_ex = rev * rng.uniform(0.15, 0.35)
    ebitda = gp - op_ex
    da = rev * rng.uniform(0.02, 0.06)
    ebit = ebitda - da
    int_exp = rev * rng.uniform(0.01, 0.04)
    pretax = ebit - int_exp
    tax = pretax * TAX_RATE
    ni = pretax - tax

    shares = float(company.shares_outstanding)
    shares_dil = shares * rng.uniform(1.0, 1.05)
    eps = ni / shares_dil if shares_dil > 0 else 0

    inc = IncomeStatement(
        company_id=company.id, fiscal_period=fiscal_period,
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
        td = float(latest_bal.total_debt) * (1 + rng.gauss(0.0, 0.02))
        se = float(latest_bal.shareholders_equity) * (1 + rng.gauss(0.005, 0.01))
    else:
        ta = rev * rng.uniform(1.5, 3.0)
        cash = rev * rng.uniform(0.05, 0.15)
        td = rev * rng.uniform(0.3, 0.8)
        se = rev * rng.uniform(0.5, 1.5)

    ta = max(ta, 1e6)
    se = max(se, 1e6)
    recv = ta * rng.uniform(0.05, 0.15)
    inv = ta * rng.uniform(0.05, 0.2)
    ca = cash + recv + inv
    ppe = ta * rng.uniform(0.3, 0.6)
    intan = ta * rng.uniform(0.05, 0.15)
    pay = ta * rng.uniform(0.03, 0.1)
    std = td * rng.uniform(0.1, 0.3)
    cl = pay + std
    ltd = td - std
    tl = cl + ltd + ta * rng.uniform(0.05, 0.15)
    ic = se + td

    bal = BalanceSheet(
        company_id=company.id, fiscal_period=fiscal_period,
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

    ocf = ni + da - recv * rng.uniform(0, 0.1)
    capex = -ppe * rng.uniform(0.02, 0.05)
    fcf = ocf + capex
    icf = -capex - recv * rng.uniform(0, 0.05)
    div = -ni * rng.uniform(0.1, 0.4)
    bb = -fcf * rng.uniform(0, 0.3) if fcf > 0 else 0
    fincf = td * rng.uniform(-0.02, 0.02) + div + bb
    ncc = ocf + icf + fincf

    cf = CashFlowStatement(
        company_id=company.id, fiscal_period=fiscal_period,
        operating_cash_flow=round(ocf, 2), capex=round(capex, 2),
        free_cash_flow=round(fcf, 2), investing_cash_flow=round(icf, 2),
        financing_cash_flow=round(fincf, 2), dividends_paid=round(div, 2),
        buybacks=round(bb, 2), net_change_in_cash=round(ncc, 2),
    )
    session.add(cf)

    ce = ConsensusEstimate(
        company_id=company.id, fiscal_period=fiscal_period,
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


def _safe_finite(v: float) -> float:
    if v == float("inf"):
        return 1e9
    if v == float("-inf"):
        return -1e9
    return v if np.isfinite(v) else 0.0


def _get_active_events_for_company(
    session: Session,
    timeline_id: int,
    company_id: int,
    industry_id: int,
    sim_date: date,
    epoch_start: date,
) -> list[dict]:
    """Return active EventInstance data for driver computation."""
    instances = session.query(EventInstance).filter(
        EventInstance.timeline_id == timeline_id,
        EventInstance.expires_on >= sim_date,
        or_(
            EventInstance.scope_type == "market",
            and_(EventInstance.scope_type == "company", EventInstance.scope_ref == company_id),
            and_(EventInstance.scope_type == "industry", EventInstance.scope_ref == industry_id),
        ),
    ).all()

    result = []
    for inst in instances:
        severity = float(inst.resolved_severity)
        event = session.query(MarketEvent).filter_by(id=inst.event_id).first()
        if event is None:  # pragma: no cover — blocked by FK constraint
            continue  # pragma: no cover
        rho = float(event.decay_rate)
        result.append({
            "severity": severity,
            "start_day": (inst.sim_date - epoch_start).days,
            "effect_profile": inst.applied_effects,
            "decay_rate": rho,
        })
    return result


def _mark_to_market(
    session: Session,
    timeline_id: int,
    companies: list[Company],
) -> None:
    """Section 6.O step 13 -- update portfolio market values based on latest prices."""
    portfolios = session.query(Portfolio).filter_by(timeline_id=timeline_id).all()
    price_map = {c.id: float(c.current_price or 0) for c in companies}
    for pf in portfolios:
        holdings = session.query(Holding).filter_by(portfolio_id=pf.id).all()
        holdings_value = sum(
            float(h.quantity) * price_map.get(h.company_id, 0)
            for h in holdings
        )
        total_value = float(pf.cash_balance) + holdings_value
        pf.total_value = round(total_value, 2)


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
    fired_events: list,
    sim_date: date,
    timeline_id: int,
    rng: random.Random,
    params: dict[str, float],
    neutral_industry_pegs: dict[int, float],
    now: datetime,
    industries: dict[int, object],
) -> set[int]:
    """Section 6.N -- apply structural event effect_profiles to factor scores and recompute IV.

    Returns the set of company ids whose factor scores/IV were touched.
    """
    company_map = {c.id: c for c in companies}
    affected_company_ids: set[int] = set()

    for ev in fired_events:
        event_instances = session.query(EventInstance).filter_by(
            event_id=ev.id, timeline_id=timeline_id, sim_date=sim_date
        ).all()
        for ei in event_instances:
            profile = ei.applied_effects
            if not profile or not isinstance(profile, dict):
                continue
            factor_keys = [k for k in profile if k not in DRIVER_KEYS]
            if not factor_keys:
                continue

            target_cids = _scope_target_company_ids(ei, company_map)
            if not target_cids:
                continue

            days_elapsed = 0
            severity = float(ei.resolved_severity)
            event = session.query(MarketEvent).filter_by(id=ei.event_id).first()
            rho = float(event.decay_rate) if event else 0.1

            for cid in target_cids:
                _apply_factor_effects_to_company(
                    session, cid, company_map, industries, params, neutral_industry_pegs,
                    {k: profile[k] for k in factor_keys}, severity, rho, days_elapsed,
                )
                affected_company_ids.add(cid)

    return affected_company_ids


def _apply_factor_effects_to_company(
    session: Session,
    cid: int,
    company_map: dict[int, Company],
    industries: dict[int, object],
    params: dict[str, float],
    neutral_industry_pegs: dict[int, float],
    effects: dict[str, float],
    severity: float,
    rho: float,
    days_elapsed: int,
) -> None:
    """Apply one event's factor-score effects to a single company and recompute IV.

    Handles all 5 top-level CompanyFactorScore fields (management_quality,
    moat_score, financial_quality, fcf_quality, growth_potential) plus
    individual MoatSubscore sub-factor keys. A direct "moat_score" effect
    nudges the composite after sub-factor aggregation, distinct from
    sub-factor keys like "innovation" which feed into the composite itself.
    """
    moat_rows = session.query(MoatSubscore).filter_by(company_id=cid).all()
    latest_cfs = session.query(CompanyFactorScore).filter_by(
        company_id=cid
    ).order_by(CompanyFactorScore.fiscal_period.desc()).first()
    if latest_cfs is None:
        return

    top_level_keys = {"management_quality", "moat_score", "financial_quality", "fcf_quality", "growth_potential"}
    factor_scores = {ms.subfactor_key: float(ms.score) for ms in moat_rows}
    factor_scores["management_quality"] = float(latest_cfs.management_quality)
    factor_scores["moat_score"] = float(latest_cfs.moat_score)
    factor_scores["financial_quality"] = float(latest_cfs.financial_quality)
    factor_scores["fcf_quality"] = float(latest_cfs.fcf_quality)
    factor_scores["growth_potential"] = float(latest_cfs.growth_potential)

    updated = apply_effect_to_factor_scores(factor_scores, effects, severity, rho, days_elapsed)

    # Write back MoatSubscore sub-factor updates (keys that aren't top-level).
    for ms in moat_rows:
        if ms.subfactor_key in updated and ms.subfactor_key not in top_level_keys:
            ms.score = round(updated[ms.subfactor_key], 4)

    pw_rows = session.query(IndustryPillarWeight).all()
    industry_pw: dict[int, dict[str, float]] = {}
    for pw in pw_rows:
        industry_pw.setdefault(pw.industry_id, {})[pw.pillar] = float(pw.weight)

    fq_defs = session.query(FactorDefinition).filter_by(factor_type="fq_sub").all()
    subfactor_pillar = {fd.key: fd.pillar for fd in fq_defs}

    ind_pw = industry_pw.get(company_map[cid].industry_id, {})

    # financial_quality is normally re-derived each fiscal period from
    # FinancialQualitySubscore rows; an event's direct delta on it is a
    # temporary override on top of that base, not replaced by a fresh
    # recompute (otherwise the effect would always be silently discarded).
    latest_fq_subs = session.query(FinancialQualitySubscore).filter_by(
        company_id=cid
    ).order_by(FinancialQualitySubscore.fiscal_period.desc()).all()
    fq_subs = {fs.subfactor_key: float(fs.subscore) for fs in latest_fq_subs}
    base_fq = financial_quality_composite(fq_subs, ind_pw, subfactor_pillar) if fq_subs else float(latest_cfs.financial_quality)
    fq_delta = updated["financial_quality"] - factor_scores["financial_quality"]
    fq = max(0.0, min(100.0, base_fq + fq_delta))

    moat_defs = session.query(FactorDefinition).filter_by(factor_type="moat_sub").all()
    moat_weights = {md.key: float(md.default_weight) for md in moat_defs if md.default_weight}
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
    moat_delta = updated["moat_score"] - factor_scores["moat_score"]
    moat_val = max(0.0, min(100.0, subfactor_moat + moat_delta))

    mgmt = updated["management_quality"]
    growth = updated["growth_potential"]
    fcfq = updated["fcf_quality"]
    iscore = compute_intrinsic_score(mgmt, moat_val, fq, fcfq, growth)

    ind_id = company_map[cid].industry_id
    eps_val = 0.0
    latest_inc = session.query(IncomeStatement).filter_by(
        company_id=cid
    ).order_by(IncomeStatement.fiscal_period.desc()).first()
    if latest_inc:
        eps_val = float(latest_inc.eps)
    fpe, iv = _recompute_valuation(iscore, growth, ind_id, neutral_industry_pegs, params, eps_val)

    # Persist onto the actual CompanyFactorScore row (not just the
    # denormalized Company fields) so the next tick's driver computations
    # and any direct query of CompanyFactorScore see the updated scores.
    latest_cfs.management_quality = round(mgmt, 4)
    latest_cfs.moat_score = round(moat_val, 4)
    latest_cfs.financial_quality = round(fq, 4)
    latest_cfs.fcf_quality = round(fcfq, 4)
    latest_cfs.growth_potential = round(growth, 4)
    latest_cfs.intrinsic_score = round(iscore, 4)
    latest_cfs.fair_pe = round(fpe, 4)
    latest_cfs.intrinsic_value = round(iv, 4)

    company_map[cid].intrinsic_value = round(iv, 4)
    company_map[cid].intrinsic_score = round(iscore, 4)
    company_map[cid].fair_pe = round(fpe, 4)
