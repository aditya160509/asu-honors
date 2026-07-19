"""Step 11.6 — Run engine once to compute FQ, FairPE, IV, initial price for all companies.

Reads financial statements from DB, computes cross-sectional FQ scores,
MOAT composite, intrinsic score, FairPE, and IV.  Sets initial market price
slightly perturbed around IV and writes the first price_history row.
"""

import os
import random as _random
from datetime import date, datetime, timezone

import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, joinedload

# Path setup handled by run_all.py entry point

from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
    ConfigParameter,
    EconomicCycleState,
    FactorDefinition,
    FinancialQualitySubscore,
    IncomeStatement,
    Industry,
    IndustryPillarWeight,
    MoatSubscore,
    PriceHistory,
    SimulationState,
    Timeline,
)
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
from engine.scoring import (
    financial_quality_composite,
    intrinsic_score as compute_intrinsic_score,
    moat_composite,
    percentile_rank_scores,
)
from engine.valuation import (
    DEFAULT_GROWTH_RATE_MAX,
    DEFAULT_GROWTH_RATE_MIN,
    DEFAULT_M_INFLECTION,
    DEFAULT_M_MAX,
    DEFAULT_M_MIN,
    DEFAULT_M_STEEPNESS,
    compute_growth_potential_from_financials,
    fair_pe_from_peg,
    fair_peg,
    growth_score_to_rate,
    intrinsic_value_per_share,
)

FIRST_SIM_DATE = date(2026, 1, 2)
PREV_SIM_DATE = date(2025, 12, 31)
FISCAL_PERIOD = "2026Q4"
TAX_RATE = 0.25


def _load_company_data(session: Session) -> dict:
    """Load all reference data needed for the computation."""
    params = {
        p.key: float(p.value) for p in session.query(ConfigParameter).filter_by(scope="global").all()
    }
    neutral_industry_pegs = {
        p.scope_id: float(p.value)
        for p in session.query(ConfigParameter).filter_by(key="neutral_industry_peg", scope="industry").all()
    }
    industries = {ind.id: ind for ind in session.query(Industry).order_by(Industry.id).all()}
    pw_rows = session.query(IndustryPillarWeight).order_by(IndustryPillarWeight.id).all()
    industry_pw: dict[int, dict[str, float]] = {}
    for pw in pw_rows:
        industry_pw.setdefault(pw.industry_id, {})[pw.pillar] = float(pw.weight)
    fq_defs = session.query(FactorDefinition).filter_by(factor_type="fq_sub").order_by(FactorDefinition.id).all()
    subfactor_pillar = {fd.key: fd.pillar for fd in fq_defs}
    fq_directions = {fd.key: fd.direction for fd in fq_defs}
    moat_defs = session.query(FactorDefinition).filter_by(factor_type="moat_sub").order_by(FactorDefinition.id).all()
    moat_weights = {md.key: float(md.default_weight) for md in moat_defs if md.default_weight}
    companies = session.query(Company).options(joinedload(Company.industry)).order_by(Company.id).all()
    income_map = {r.company_id: r for r in session.query(IncomeStatement).filter_by(fiscal_period=FISCAL_PERIOD).order_by(IncomeStatement.id).all()}
    balance_map = {r.company_id: r for r in session.query(BalanceSheet).filter_by(fiscal_period=FISCAL_PERIOD).order_by(BalanceSheet.id).all()}
    cashflow_map = {r.company_id: r for r in session.query(CashFlowStatement).filter_by(fiscal_period=FISCAL_PERIOD).order_by(CashFlowStatement.id).all()}
    ms_rows = session.query(MoatSubscore).order_by(MoatSubscore.id).all()
    moat_scores: dict[int, dict[str, float]] = {}
    for ms in ms_rows:
        moat_scores.setdefault(ms.company_id, {})[ms.subfactor_key] = float(ms.score)
    seed_rows = session.query(CompanyFactorScore).filter_by(fiscal_period="SEED").order_by(CompanyFactorScore.id).all()
    seed_scores = {s.company_id: s for s in seed_rows}
    timeline = session.query(Timeline).filter_by(is_live=True).first()

    all_incomes_map: dict[int, list[IncomeStatement]] = {}
    for inc in session.query(IncomeStatement).order_by(IncomeStatement.fiscal_period.asc()).all():
        all_incomes_map.setdefault(inc.company_id, []).append(inc)

    all_balances_map: dict[int, list[BalanceSheet]] = {}
    for bal in session.query(BalanceSheet).order_by(BalanceSheet.fiscal_period.asc()).all():
        all_balances_map.setdefault(bal.company_id, []).append(bal)

    all_cashflows_map: dict[int, list[CashFlowStatement]] = {}
    for cf in session.query(CashFlowStatement).order_by(CashFlowStatement.fiscal_period.asc()).all():
        all_cashflows_map.setdefault(cf.company_id, []).append(cf)

    return dict(
        params=params, neutral_industry_pegs=neutral_industry_pegs,
        industries=industries, industry_pw=industry_pw,
        subfactor_pillar=subfactor_pillar, fq_directions=fq_directions,
        moat_weights=moat_weights, companies=companies,
        income_map=income_map, balance_map=balance_map, cashflow_map=cashflow_map,
        moat_scores=moat_scores, seed_scores=seed_scores, timeline=timeline,
        fq_subfactor_keys=[fd.key for fd in fq_defs],
        all_incomes_map=all_incomes_map,
        all_balances_map=all_balances_map,
        all_cashflows_map=all_cashflows_map,
    )



def _compute_raw_metrics(
    inc: IncomeStatement, bal: BalanceSheet, cf: CashFlowStatement,
    subfactor_set: str = "standard",
) -> dict[str, float]:
    """Compute all FQ raw metrics from one company's financials."""
    if subfactor_set == "financials":
        ni = float(inc.net_profit)
        ta = float(bal.total_assets)
        se = float(bal.shareholders_equity)
        interest_income = float(inc.revenue)
        interest_expense = float(inc.interest_expense)
        avg_earning_assets = ta
        op_ex = float(inc.operating_expenses)
        nii = interest_income - interest_expense
        ocf = float(cf.operating_cash_flow)
        div = float(cf.dividends_paid)
        loans = ta * 0.6
        npl = loans * 0.02
        return dict(
            net_interest_margin=net_interest_margin(interest_income, interest_expense, avg_earning_assets),
            cost_to_income=cost_to_income(op_ex, nii),
            roa=roa(ni, ta),
            capital_adequacy_ratio=capital_adequacy_ratio(se, loans),
            npa_ratio=npa_ratio(npl, loans),
            payout_sustainability=payout_sustainability(div, ni, ocf),
        )

    r = float(inc.revenue)
    cogs = float(inc.cogs)
    ebit = float(inc.ebit)
    ebitda = float(inc.ebitda)
    ni = float(inc.net_profit)
    ta = float(bal.total_assets)
    ic = float(bal.invested_capital)
    se = float(bal.shareholders_equity)
    cash = float(bal.cash_and_equivalents)
    recv = float(bal.receivables)
    inv = float(bal.inventory)
    ca = float(bal.current_assets)
    cl = float(bal.current_liabilities)
    td = float(bal.total_debt)
    pay = float(bal.payables)
    ocf = float(cf.operating_cash_flow)
    div = float(cf.dividends_paid)
    dso = days_sales_outstanding(recv, r)
    dio = days_inventory_outstanding(inv, cogs)
    dpo = days_payables_outstanding(pay, cogs)
    return dict(
        operating_margin=operating_margin(ebit, r),
        roic=roic(ebit, TAX_RATE, ic),
        roe=roe(ni, se),
        asset_turnover=asset_turnover(r, ta),
        cash_conversion_cycle=cash_conversion_cycle(dso, dio, dpo),
        net_debt_to_ebitda=net_debt_to_ebitda(td, cash, ebitda),
        interest_coverage=interest_coverage(ebit, float(inc.interest_expense)),
        current_ratio=current_ratio(ca, cl),
        accruals_ratio=accruals_ratio(ni, ocf, ta),
        earnings_stability=50.0,
        revenue_consistency=50.0,
        payout_sustainability=payout_sustainability(div, ni, ocf),
    )


def _safe_finite(v: float) -> float:
    if v == float("inf"):
        return 1e9
    if v == float("-inf"):
        return -1e9
    return v if np.isfinite(v) else 0.0


def seed(session: Session) -> None:
    now = datetime.now(timezone.utc)
    d = _load_company_data(session)
    timeline = d["timeline"]
    if timeline is None:
        msg = "No live timeline found — run seed_demo.py first."
        raise ValueError(msg)

    rng = _random.Random(42)
    params = d["params"]
    m_min = params.get("quality_mult_min", DEFAULT_M_MIN)
    m_max = params.get("quality_mult_max", DEFAULT_M_MAX)
    m_k = params.get("quality_mult_k", DEFAULT_M_STEEPNESS)
    m_c = params.get("quality_mult_inflection", DEFAULT_M_INFLECTION)
    growth_rate_min = params.get("growth_rate_min", DEFAULT_GROWTH_RATE_MIN)
    growth_rate_max = params.get("growth_rate_max", DEFAULT_GROWTH_RATE_MAX)

    rows = []
    for company in d["companies"]:
        inc = d["income_map"].get(company.id)
        bal = d["balance_map"].get(company.id)
        cf = d["cashflow_map"].get(company.id)
        seed_cfs = d["seed_scores"].get(company.id)
        if not all([inc, bal, cf, seed_cfs]):
            continue

        sset = d["industries"][company.industry_id].subfactor_set
        raw = _compute_raw_metrics(inc, bal, cf, subfactor_set=sset)
        rows.append(dict(company=company, raw=raw, seed_cfs=seed_cfs, subfactor_set=sset))
    if not rows:
        msg = "No companies with complete financial data found — run seed_financials.py first."
        raise ValueError(msg)

    all_fq_keys = d["fq_subfactor_keys"]
    fq_percentiles: dict[str, np.ndarray] = {}
    for key in all_fq_keys:
        relevant = [r for r in rows if key in r["raw"]]
        if not relevant:
            continue
        vals = np.array([_safe_finite(r["raw"][key]) for r in relevant])
        lower = d["fq_directions"].get(key, "higher_better") == "lower_better"
        scores = percentile_rank_scores(vals, lower_is_better=lower)
        fq_percentiles[key] = scores
        score_idx = 0
        for r in rows:
            if key in r["raw"]:
                r.setdefault("fq_subscores", {})[key] = float(scores[score_idx])
                score_idx += 1

    fq_subscores_all = []
    for r in rows:
        company = r["company"]
        if company.current_price is not None and company.current_price > 0:
            continue
        ind_id = company.industry_id
        fq = financial_quality_composite(
            r["fq_subscores"], d["industry_pw"].get(ind_id, {}), d["subfactor_pillar"]
        )
        moat_val = moat_composite(d["moat_scores"].get(company.id, {}), d["moat_weights"])
        mgmt = float(r["seed_cfs"].management_quality)
        all_incs = d["all_incomes_map"].get(company.id, [])
        growth = compute_growth_potential_from_financials(
            all_incs, growth_rate_min, growth_rate_max,
        )
        r["growth_potential"] = growth
        fcfq = float(r["seed_cfs"].fcf_quality)
        iscore = compute_intrinsic_score(mgmt, moat_val, fq, fcfq, growth)
        neutral_peg = d["neutral_industry_pegs"].get(ind_id, 1.0)
        peg = fair_peg(neutral_peg, iscore, m_min, m_max, m_k, m_c)
        growth_rate_pct = growth_score_to_rate(growth, growth_rate_min, growth_rate_max)
        fpe = fair_pe_from_peg(peg, growth_rate_pct)
        company_inc = d["income_map"].get(company.id)
        eps_val = float(company_inc.eps) if company_inc else 0.0
        iv = intrinsic_value_per_share(fpe, eps_val)

        initial_gap = rng.gauss(0, 0.03)
        price = iv * np.exp(initial_gap)
        price = max(price, 0.01)
        market_cap = price * float(company.shares_outstanding)
        industry = d["industries"][company.industry_id]
        # base_volatility is an annualized fraction (e.g. 0.25 = 25%/yr, see
        # seed_industries.py); Company.volatility is displayed/filtered everywhere
        # as a percent-scale number (formatPct just appends "%" with no *100), so
        # the seed value must already be in percent units, not divided by 100 again
        # (that produced a ~100x-too-small frozen value with zero per-company
        # variation until the engine overwrote it -- see engine/orchestrator.py's
        # _update_denormalized_fields, which now persists a real per-tick figure
        # in the same units).
        vol = float(industry.base_volatility) * 100.0
        liq_score = min(100.0, float(company.free_float_pct) * 100.0)

        r["fq"] = fq
        r["moat"] = moat_val
        r["intrinsic_score"] = iscore
        r["fair_pe"] = fpe
        r["intrinsic_value"] = iv
        r["price"] = price
        r["market_cap"] = market_cap
        r["volatility"] = vol
        r["liquidity_score"] = liq_score

        for sub_key, sub_score in r["fq_subscores"].items():
            pillar = d["subfactor_pillar"][sub_key]
            pw = d["industry_pw"].get(ind_id, {})
            pw_this_pillar = pw.get(pillar, 0.0)
            sub_key_set = [k for k in r["raw"] if k in all_fq_keys]
            n_in_pillar = sum(1 for k in sub_key_set if d["subfactor_pillar"].get(k) == pillar)
            applied_w = pw_this_pillar / n_in_pillar if n_in_pillar else 0.0
            peer_pct = float(fq_percentiles.get(sub_key, np.array([50.0]))[0]) if sub_key in fq_percentiles else 50.0
            fq_subscores_all.append(FinancialQualitySubscore(
                company_id=company.id, fiscal_period=FISCAL_PERIOD,
                subfactor_key=sub_key,
                raw_metric_value=_safe_finite(r["raw"].get(sub_key, 0.0)),
                peer_percentile=peer_pct,
                subscore=r["fq_subscores"][sub_key],
                applied_weight=applied_w,
            ))

    for x in fq_subscores_all:
        existing = session.query(FinancialQualitySubscore).filter_by(
            company_id=x.company_id, fiscal_period=x.fiscal_period,
            subfactor_key=x.subfactor_key,
        ).first()
        if existing is None:
            session.add(x)

    for r in rows:
        company = r["company"]
        cfs = r["seed_cfs"]
        cfs.moat_score = round(r["moat"], 4)
        cfs.financial_quality = round(r["fq"], 4)
        cfs.growth_potential = round(r["growth_potential"], 4)
        cfs.intrinsic_score = round(r["intrinsic_score"], 4)
        cfs.fair_pe = round(r["fair_pe"], 4)
        cfs.intrinsic_value = round(r["intrinsic_value"], 4)
        cfs.computed_at = now

        existing_ph = session.query(PriceHistory).filter_by(
            company_id=company.id, timeline_id=timeline.id, sim_date=FIRST_SIM_DATE
        ).first()
        if existing_ph is None:
            prev_price = round(r["price"] * rng.uniform(0.97, 1.03), 4)
            session.add(PriceHistory(
                timeline_id=timeline.id, company_id=company.id,
                sim_date=PREV_SIM_DATE,
                open=round(prev_price * rng.uniform(0.995, 1.005), 4),
                high=round(prev_price * rng.uniform(1.00, 1.015), 4),
                low=round(prev_price * rng.uniform(0.985, 1.00), 4),
                close=prev_price,
                volume=max(1000, int(r["market_cap"] * 0.001 * rng.uniform(0.5, 1.5))),
                intrinsic_value=round(r["intrinsic_value"], 4),
                order_imbalance=0.0,
            ))
            session.add(PriceHistory(
                timeline_id=timeline.id, company_id=company.id,
                sim_date=FIRST_SIM_DATE,
                open=round(r["price"], 4), high=round(r["price"] * 1.01, 4),
                low=round(r["price"] * 0.99, 4), close=round(r["price"], 4),
                volume=max(1000, int(r["market_cap"] * 0.001 * rng.uniform(0.5, 1.5))),
                intrinsic_value=round(r["intrinsic_value"], 4),
                order_imbalance=0.0,
            ))

        company.current_price = round(r["price"], 4)
        company.intrinsic_value = round(r["intrinsic_value"], 4)
        company.intrinsic_score = round(r["intrinsic_score"], 4)
        company.fair_pe = round(r["fair_pe"], 4)
        company.market_cap = round(r["market_cap"], 4)
        company.volatility = round(r["volatility"], 4)
        company.market_liquidity_score = round(r["liquidity_score"], 4)

    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline.id).first()
    if sim_state is None:
        session.add(SimulationState(
            timeline_id=timeline.id, current_sim_date=FIRST_SIM_DATE,
            tick_count=0, is_running=False,
        ))

    econ = session.query(EconomicCycleState).filter_by(
        timeline_id=timeline.id, sim_date=FIRST_SIM_DATE
    ).first()
    if econ is None:
        session.add(EconomicCycleState(
            timeline_id=timeline.id, sim_date=FIRST_SIM_DATE,
            cycle_phase="expansion",
            market_factor_return=0.0, gdp_growth=2.5,
            interest_rate=4.5, market_sentiment=0.0,
        ))

    print(f"Computed initial prices for {len(rows)} companies.")


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_initial_prices.py done.")


if __name__ == "__main__":
    main()
