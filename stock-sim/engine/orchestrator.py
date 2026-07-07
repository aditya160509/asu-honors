"""Phase 4 — Full engine-to-DB simulation tick orchestration loop.

Wires the pure-function engine modules (tick, market, drivers, valuation, liquidity,
ohlc, cycle, events) to the database.  Each call to run_tick() advances the
simulation by one business day for all companies.
"""

import random
from datetime import date, datetime, timezone, timedelta

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
from engine.events import apply_effect_to_drivers
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
    interest_coverage,
    net_debt_to_ebitda,
    net_interest_margin,
    npa_ratio,
    operating_margin,
    payout_sustainability,
    roa,
    roe,
    roic,
)
from engine.liquidity import (
    daily_volume,
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
from engine.tick import CompanyTickInput, TickState, run_tick as engine_run_tick
from engine.valuation import drift_iv, fair_pe, intrinsic_value_per_share

TAX_RATE = 0.25
TRADING_DAYS_PER_YEAR = 252
QUARTER_LENGTH = 63


def run_tick(session: Session, timeline_id: int) -> dict:
    """Advance the simulation by one trading day for the given timeline.

    Steps (PRD Section 6.O):
      1. Load simulation state
      2. Check idempotency (skip if already executed)
      3. Advance economic cycle -> market_factor_return, F^s
      4. Check quarter boundary -> refresh fundamentals
      5. Drift IV for all companies
      6. Compute 7 driver values per company
      7. Fire probabilistic events, apply effects -> compute news_severity
      8. Build TickState, call engine_run_tick
      9. Apply circuit breaker, synthesize OHLC
      10. Compute volume, order imbalance, liquidity
      11. Write price_history, price_driver_scores, cycle_state rows
      12. Update Company denormalized fields
      13. Mark-to-market portfolios
      14. Generate news from fired events
      15. Advance SimulationState

    Returns a summary dict with counts and the new sim_date.
    """
    now = datetime.now(timezone.utc)
    timeline = session.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise ValueError(f"Timeline {timeline_id} not found")

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        raise ValueError(f"No SimulationState for timeline {timeline_id} -- run seed_initial_prices first")

    sim_date = sim_state.current_sim_date
    tick_count = sim_state.tick_count
    epoch_start = sim_date - timedelta(days=tick_count)

    # -- Step 2: idempotency ------------------------------------------------
    existing = session.query(PriceHistory).filter_by(
        timeline_id=timeline_id, sim_date=sim_date
    ).first()
    if existing is not None:
        return {"status": "skipped", "reason": "already_executed", "sim_date": sim_date}

    rng = random.Random(timeline.rng_seed + tick_count)
    params = _load_params(session)

    # -- Step 3: economic cycle ---------------------------------------------
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

    # -- Load companies and industry data ------------------------------------
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

    # -- Step 4: quarter boundary -> refresh fundamentals -------------------
    is_quarter_boundary = tick_count > 0 and tick_count % QUARTER_LENGTH == 0
    if is_quarter_boundary:
        _refresh_fundamentals(session, timeline_id, companies, industries, params, now, rng, tick_count)

    # -- Step 5: IV drift ---------------------------------------------------
    eps_map: dict[int, float] = {}
    for company in companies:
        latest_inc = session.query(IncomeStatement).filter_by(
            company_id=company.id
        ).order_by(IncomeStatement.fiscal_period.desc()).first()
        if latest_inc:
            eps_map[company.id] = float(latest_inc.eps)
        if company.intrinsic_value is not None:
            expected_growth = float(
                params.get("expected_annual_growth", 0.08)
            )
            company.intrinsic_value = float(drift_iv(
                float(company.intrinsic_value), expected_growth, TRADING_DAYS_PER_YEAR
            ))

    # -- Steps 6-7: compute drivers per company -----------------------------
    pricing_data: dict[str, list] = {
        "company_ids": [], "y": [], "theta": [],
        "driver_values": [], "driver_weights": [],
        "beta_market": [], "beta_sector": [],
        "sector_factors": [], "sigma": [],
        "epsilon": [], "intrinsic_value": [],
    }

    for company in companies:
        if company.current_price is None or company.current_price <= 0:
            continue
        if company.intrinsic_value is None or company.intrinsic_value <= 0:
            continue

        ind = industries.get(company.industry_id)
        if ind is None:
            continue

        prev_close = float(company.current_price)
        iv = float(company.intrinsic_value)

        y = np.log(max(prev_close, 0.01) / max(iv, 0.01))
        theta = float(params.get("mean_reversion_rate", 0.05))
        beta_m = float(company.beta_market)
        beta_s = float(company.beta_sector)
        sigma_val = float(company.volatility or 0.02)
        epsilon = rng.gauss(0, 1)

        s_factor = sector_shocks.get(company.industry_id, 0.0)

        vo = value_opportunity(iv, prev_close)
        tm = technical_momentum(prev_close, prev_close * 0.98, float(params.get("k_m", 0.5)))
        eo = compute_economic_outlook(cycle_state["market_sentiment"])

        latest_inc = session.query(IncomeStatement).filter_by(
            company_id=company.id
        ).order_by(IncomeStatement.fiscal_period.desc()).first()
        latest_ce = session.query(ConsensusEstimate).filter_by(
            company_id=company.id
        ).order_by(ConsensusEstimate.fiscal_period.desc()).first()

        es = 0.0
        if latest_inc and latest_ce:
            actual_eps = float(latest_inc.eps)
            consensus_eps = float(latest_ce.consensus_eps)
            es = earnings_surprise(actual_eps, consensus_eps, tick_count, float(params.get("rho_es", 0.15)))

        gd = 0.0
        if latest_inc and latest_ce:
            actual_eps = float(latest_inc.eps)
            consensus_eps = float(latest_ce.consensus_eps)
            beat = actual_eps > consensus_eps
            miss = actual_eps < consensus_eps
            if beat:
                gd = guidance("raised", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5), tick_count, float(params.get("rho_g", 0.15)))
            elif miss:
                gd = guidance("cut", min(abs(actual_eps - consensus_eps) / max(abs(consensus_eps), 0.01), 0.5), tick_count, float(params.get("rho_g", 0.15)))

        ib = institutional_buying(rng.uniform(-0.1, 0.1) + cycle_state.get("market_sentiment", 0) * 0.05)

        ns = 0.0
        active_events = _get_active_events_for_company(
            session, timeline_id, company.id, ind.id, sim_date, epoch_start
        )
        if active_events:
            ns = news_severity(active_events, tick_count, float(params.get("rho_news", 0.1)))

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
                        driver_values, effect_profile, severity, decay_rate, days_elapsed
                    )

        drv_weights = {
            "value_opportunity": float(params.get("w_vo", 0.20)),
            "earnings_surprise": float(params.get("w_es", 0.15)),
            "news_severity": float(params.get("w_ns", 0.15)),
            "economic_outlook": float(params.get("w_eo", 0.10)),
            "guidance": float(params.get("w_g", 0.15)),
            "technical_momentum": float(params.get("w_tm", 0.10)),
            "institutional_buying": float(params.get("w_ib", 0.15)),
        }

        pricing_data["company_ids"].append(company.id)
        pricing_data["y"].append(y)
        pricing_data["theta"].append(theta)
        pricing_data["driver_values"].append(driver_values)
        pricing_data["driver_weights"].append(drv_weights)
        pricing_data["beta_market"].append(beta_m)
        pricing_data["beta_sector"].append(beta_s)
        pricing_data["sector_factors"].append(s_factor)
        pricing_data["sigma"].append(sigma_val)
        pricing_data["epsilon"].append(epsilon)
        pricing_data["intrinsic_value"].append(iv)

    if not pricing_data["company_ids"]:
        raise ValueError("No companies with valid pricing data")

    # -- Step 8: run the tick -----------------------------------------------
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
        market_factor_return=f_m,
        companies=tick_inputs,
    )
    tick_result = engine_run_tick(tick_state)

    # -- Step 9: circuit breaker + OHLC -------------------------------------
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
        market_cap = float(company.market_cap or 1e9)

        base_vol = market_cap * 0.001
        sens = float(params.get("liquidity_sensitivity", 0.5))
        demand = demand_from_pressure(base_vol, out.price_pressure, sens)
        supply = supply_from_pressure(base_vol, out.price_pressure, sens)
        imb = order_imbalance(demand, supply)
        vol = daily_volume(int(base_vol), free_float, imb)
        vol = max(1000, int(vol))

        ohlc_results[cid] = ohlc
        volume_results[cid] = vol
        imbalance_results[cid] = imb

    # -- Steps 11-12: write DB rows -----------------------------------------
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

        company = next(c for c in companies if c.id == cid)
        company.current_price = round(ohlc["close"], 4)
        company.intrinsic_value = round(iv, 4)
        company.market_cap = round(ohlc["close"] * float(company.shares_outstanding), 2)
        liq_score = market_liquidity_score(float(company.free_float_pct), vol_val, float(company.market_cap or 1e9))
        company.market_liquidity_score = round(liq_score, 4)

    # -- Step 13: mark-to-market portfolios ---------------------------------
    _mark_to_market(session, timeline_id, companies)

    # -- Step 14: fire events + generate news -------------------------------
    company_ids_list = [c.id for c in companies]
    industry_ids_list = [ind.id for ind in industries.values()]
    fired_events = select_and_fire_events(
        session, timeline_id, sim_date, rng, company_ids_list, industry_ids_list
    )
    for ev in fired_events:
        event_instances = session.query(EventInstance).filter_by(
            event_id=ev.id, timeline_id=timeline_id, sim_date=sim_date
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
            generate_news(session, timeline_id, sim_date, ei, rng,
                          company_name=company_name, industry_name=industry_name)

    # -- Step 15: advance simulation state ----------------------------------
    next_date = sim_date + timedelta(days=1)
    sim_state.current_sim_date = next_date
    sim_state.tick_count = tick_count + 1
    sim_state.is_running = True

    session.flush()

    return {
        "status": "completed",
        "sim_date": sim_date,
        "next_date": next_date,
        "tick_count": tick_count + 1,
        "companies_updated": len(tick_result.outputs),
        "cycle_phase": cycle_phase,
        "market_factor_return": f_m,
    }


def run_ticks(
    session: Session,
    timeline_id: int,
    num_ticks: int = 1,
) -> list[dict]:
    """Run multiple ticks in sequence. Each tick is idempotent."""
    results = []
    for _ in range(num_ticks):
        result = run_tick(session, timeline_id)
        session.commit()
        results.append(result)
    return results


def _load_params(session: Session) -> dict[str, float]:
    rows = session.query(ConfigParameter).all()
    result: dict[str, float] = {}
    for p in rows:
        try:
            result[p.key] = float(p.value)
        except ValueError:
            pass
    return result


def _refresh_fundamentals(
    session: Session,
    timeline_id: int,
    companies: list[Company],
    industries: dict[int, Industry],
    params: dict[str, float],
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
    beta_pe = params.get("beta_pe", 0.5)
    beta_g = params.get("beta_g", 0.3)

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
        if ind is None:
            continue

        ind_pw = industry_pw.get(company.industry_id, {})
        fq = financial_quality_composite(r["fq_subscores"], ind_pw, subfactor_pillar)
        moat_val = moat_composite(moat_scores.get(company.id, {}), moat_weights)
        mgmt = float(rng.uniform(30, 85))
        growth = float(rng.uniform(30, 85))
        fcfq = float(rng.uniform(30, 85))
        iscore = compute_intrinsic_score(mgmt, moat_val, fq, fcfq, growth)

        fpe = fair_pe(
            float(ind.baseline_pe), iscore, growth, beta_pe, beta_g,
            float(ind.pe_min), float(ind.pe_max),
        )
        eps_val = float(r["raw"].get("eps", 0.0))
        iv = intrinsic_value_per_share(fpe, eps_val)

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
    latest_inc = session.query(IncomeStatement).filter_by(
        company_id=company.id
    ).order_by(IncomeStatement.fiscal_period.desc()).first()

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
    return _compute_standard_raw(inc, bal, cf)


def _compute_standard_raw(
    inc: IncomeStatement, bal: BalanceSheet, cf: CashFlowStatement,
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
        if event is None:
            continue
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
