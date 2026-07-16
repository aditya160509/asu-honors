"""Read-only business logic for market data endpoints."""

from datetime import date
from typing import Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from apps.api.schemas import (
    CompanyDetail,
    CompanyGridItem,
    CycleStateResponse,
    DriverBreakdown,
    FinancialStatementResponse,
    MarketGridResponse,
    PriceHistoryItem,
    ValuationResponse,
)
from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
    EconomicCycleState,
    IncomeStatement,
    Industry,
    PriceDriverScore,
    PriceHistory,
    SimulationState,
)


def _prev_closes_by_company(
    db: Session, timeline_id: int, sim_date: date,
) -> dict[int, float]:
    """One company's most recent close strictly before sim_date, batched for all companies."""
    latest_subq = (
        db.query(
            PriceHistory.company_id,
            func.max(PriceHistory.sim_date).label("max_date"),
        )
        .filter(PriceHistory.timeline_id == timeline_id, PriceHistory.sim_date < sim_date)
        .group_by(PriceHistory.company_id)
        .subquery()
    )
    rows = (
        db.query(PriceHistory)
        .join(
            latest_subq,
            and_(
                PriceHistory.company_id == latest_subq.c.company_id,
                PriceHistory.sim_date == latest_subq.c.max_date,
            ),
        )
        .all()
    )
    return {r.company_id: float(r.close) for r in rows}


def _price_52w_stats(
    db: Session, timeline_id: int, sim_date: date,
) -> dict[int, dict]:
    """Batch-compute avg_volume_20d, high_52w, low_52w for all companies.

    52 weeks ≈ 252 trading days; 20-day average volume uses the most recent 20
    sim dates up to and including *sim_date*.
    """
    from datetime import timedelta

    cutoff_20d = sim_date - timedelta(days=30)   # generous window → filtered by actual rows
    cutoff_52w = sim_date - timedelta(days=370)  # generous window → filtered by actual rows

    rows = (
        db.query(
            PriceHistory.company_id,
            func.avg(PriceHistory.volume).filter(PriceHistory.sim_date > cutoff_20d).label("avg_vol"),
            func.max(PriceHistory.close).label("high_52w"),
            func.min(PriceHistory.close).label("low_52w"),
        )
        .filter(
            PriceHistory.timeline_id == timeline_id,
            PriceHistory.sim_date <= sim_date,
            PriceHistory.sim_date > cutoff_52w,
        )
        .group_by(PriceHistory.company_id)
        .all()
    )
    return {
        r.company_id: {
            "avg_volume_20d": int(round(float(r.avg_vol))) if r.avg_vol is not None else None,
            "high_52w": float(r.high_52w) if r.high_52w is not None else None,
            "low_52w": float(r.low_52w) if r.low_52w is not None else None,
        }
        for r in rows
    }


def _last_two_closes_by_company(
    db: Session, timeline_id: int,
) -> dict[int, tuple[float, float]]:
    """Get the two most recent close prices for each company: (latest, previous).

    Returns a dict mapping company_id -> (latest_close, prev_close).
    If only one row exists, prev_close is None.
    """
    from sqlalchemy import func, literal_column

    # Get the two most recent rows per company using a window function
    subq = (
        db.query(
            PriceHistory.company_id,
            PriceHistory.close,
            PriceHistory.sim_date,
            func.row_number().over(
                partition_by=PriceHistory.company_id,
                order_by=PriceHistory.sim_date.desc(),
            ).label("rn"),
        )
        .filter(PriceHistory.timeline_id == timeline_id)
        .subquery()
    )
    rows = db.query(subq).filter(subq.c.rn <= 2).all()

    result: dict[int, dict[int, float]] = {}
    for r in rows:
        cid = r.company_id
        if cid not in result:
            result[cid] = {}
        result[cid][r.rn] = float(r.close)

    return {
        cid: (dates[1], dates.get(2))
        for cid, dates in result.items()
        if 1 in dates
    }


def get_market_grid(db: Session, timeline_id: int) -> MarketGridResponse:
    """Build the market grid: all companies with latest prices and day change."""
    companies = db.query(Company).order_by(Company.ticker).all()
    industries = {ind.id: ind for ind in db.query(Industry).all()}
    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    latest_cycle = (
        db.query(EconomicCycleState)
        .filter_by(timeline_id=timeline_id)
        .order_by(EconomicCycleState.sim_date.desc())
        .first()
    )
    sim_date = sim_state.current_sim_date if sim_state else date.today()
    cycle_phase = latest_cycle.cycle_phase if latest_cycle else "expansion"
    last_two = _last_two_closes_by_company(db, timeline_id)
    price_stats = _price_52w_stats(db, timeline_id, sim_date)

    items: list[CompanyGridItem] = []
    for company in companies:
        industry = industries.get(company.industry_id)
        closes = last_two.get(company.id)
        current_price = closes[0] if closes else (float(company.current_price) if company.current_price else 0)
        prev_close = closes[1] if closes and closes[1] is not None else None
        day_change_pct = None
        if prev_close is not None and prev_close > 0:
            day_change_pct = (current_price - prev_close) / prev_close * 100.0
        stats = price_stats.get(company.id, {})
        items.append(
            CompanyGridItem(
                id=company.id,
                ticker=company.ticker,
                name=company.name,
                industry_name=industry.name if industry else "",
                current_price=current_price,
                prev_close=prev_close,
                day_change_pct=day_change_pct,
                intrinsic_value=company.intrinsic_value,
                market_cap=company.market_cap,
                volatility=company.volatility,
                avg_volume_20d=stats.get("avg_volume_20d"),
                high_52w=stats.get("high_52w"),
                low_52w=stats.get("low_52w"),
            )
        )

    return MarketGridResponse(companies=items, sim_date=sim_date, cycle_phase=cycle_phase)


def get_company_detail(db: Session, ticker: str, timeline_id: int) -> CompanyDetail:
    """Build a full company profile with latest driver breakdowns."""
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")
    industry = db.query(Industry).filter_by(id=company.industry_id).first()

    latest_driver_date = (
        db.query(PriceDriverScore.sim_date)
        .filter_by(company_id=company.id, timeline_id=timeline_id)
        .order_by(PriceDriverScore.sim_date.desc())
        .first()
    )
    breakdowns: list[DriverBreakdown] = []
    if latest_driver_date:
        rows = (
            db.query(PriceDriverScore)
            .filter_by(company_id=company.id, timeline_id=timeline_id, sim_date=latest_driver_date[0])
            .all()
        )
        breakdowns = [
            DriverBreakdown(
                driver_key=r.driver_key,
                value=float(r.value),
                weight=float(r.weight),
                contribution=float(r.contribution),
            )
            for r in rows
        ]

    pe_ratio = None
    if company.current_price and company.fair_pe:
        latest_inc = (
            db.query(IncomeStatement)
            .filter_by(company_id=company.id)
            .order_by(IncomeStatement.fiscal_period.desc())
            .first()
        )
        if latest_inc and float(latest_inc.eps) != 0:
            pe_ratio = float(company.current_price) / float(latest_inc.eps)

    return CompanyDetail(
        id=company.id,
        ticker=company.ticker,
        name=company.name,
        industry_name=industry.name if industry else "",
        description=company.description,
        logo_url=company.logo_url,
        shares_outstanding=company.shares_outstanding,
        free_float_pct=float(company.free_float_pct),
        latest_price=company.current_price,
        latest_iv=company.intrinsic_value,
        pe_ratio=pe_ratio,
        market_cap=company.market_cap,
        driver_breakdowns=breakdowns,
    )


def get_price_history(
    db: Session,
    ticker: str,
    timeline_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[PriceHistoryItem]:
    """Query price_history rows for a company, optionally bounded by date range."""
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")

    query = db.query(PriceHistory).filter_by(company_id=company.id, timeline_id=timeline_id)
    if from_date is not None:
        query = query.filter(PriceHistory.sim_date >= from_date)
    if to_date is not None:
        query = query.filter(PriceHistory.sim_date <= to_date)
    rows = query.order_by(PriceHistory.sim_date.asc()).all()

    return [
        PriceHistoryItem(
            sim_date=r.sim_date,
            open=r.open,
            high=r.high,
            low=r.low,
            close=r.close,
            volume=r.volume,
            intrinsic_value=r.intrinsic_value,
        )
        for r in rows
    ]


def get_driver_breakdowns(
    db: Session,
    ticker: str,
    timeline_id: int,
    sim_date: Optional[date] = None,
) -> list[DriverBreakdown]:
    """Get driver scores for a company on a given (or most recent) sim_date."""
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")

    target_date = sim_date
    if target_date is None:
        latest = (
            db.query(PriceDriverScore.sim_date)
            .filter_by(company_id=company.id, timeline_id=timeline_id)
            .order_by(PriceDriverScore.sim_date.desc())
            .first()
        )
        if latest is None:
            return []
        target_date = latest[0]

    rows = (
        db.query(PriceDriverScore)
        .filter_by(company_id=company.id, timeline_id=timeline_id, sim_date=target_date)
        .all()
    )
    return [
        DriverBreakdown(
            driver_key=r.driver_key,
            value=float(r.value),
            weight=float(r.weight),
            contribution=float(r.contribution),
        )
        for r in rows
    ]


def get_financials(db: Session, ticker: str, period: Optional[str] = None) -> FinancialStatementResponse:
    """Get income/balance/cashflow statements for the latest (or specified) fiscal period."""
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")

    inc_query = db.query(IncomeStatement).filter_by(company_id=company.id)
    if period:
        inc_query = inc_query.filter_by(fiscal_period=period)
    else:
        inc_query = inc_query.order_by(IncomeStatement.fiscal_period.desc())
    inc = inc_query.first()
    if inc is None:
        raise NotFoundError(f"No financial statements found for '{ticker}'")

    fiscal_period = inc.fiscal_period
    bal = db.query(BalanceSheet).filter_by(company_id=company.id, fiscal_period=fiscal_period).first()
    cf = db.query(CashFlowStatement).filter_by(company_id=company.id, fiscal_period=fiscal_period).first()

    def _row_to_dict(row) -> Optional[dict]:
        if row is None:
            return None
        return {
            c.name: float(getattr(row, c.name)) if isinstance(getattr(row, c.name), (int, float)) else getattr(row, c.name)
            for c in row.__table__.columns
            if c.name not in ("id", "company_id", "created_at", "updated_at")
        }

    return FinancialStatementResponse(
        fiscal_period=fiscal_period,
        income_statement=_row_to_dict(inc),
        balance_sheet=_row_to_dict(bal),
        cash_flow_statement=_row_to_dict(cf),
    )


def get_valuation(db: Session, ticker: str, timeline_id: int) -> ValuationResponse:
    """Get the latest CompanyFactorScore for a company."""
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")

    cfs = (
        db.query(CompanyFactorScore)
        .filter_by(company_id=company.id)
        .order_by(CompanyFactorScore.fiscal_period.desc())
        .first()
    )
    if cfs is None:
        raise NotFoundError(f"No valuation data found for '{ticker}'")

    return ValuationResponse(
        intrinsic_value=cfs.intrinsic_value,
        fair_pe=cfs.fair_pe,
        intrinsic_score=float(cfs.intrinsic_score),
        management_quality=float(cfs.management_quality),
        moat_score=float(cfs.moat_score),
        financial_quality=float(cfs.financial_quality),
        fcf_quality=float(cfs.fcf_quality),
        growth_potential=float(cfs.growth_potential),
    )


def get_cycle_state(db: Session, timeline_id: int) -> CycleStateResponse:
    """Get the latest EconomicCycleState row for a timeline."""
    cycle = (
        db.query(EconomicCycleState)
        .filter_by(timeline_id=timeline_id)
        .order_by(EconomicCycleState.sim_date.desc())
        .first()
    )
    if cycle is None:
        raise NotFoundError("No cycle state found for this timeline")

    return CycleStateResponse(
        sim_date=cycle.sim_date,
        cycle_phase=cycle.cycle_phase,
        market_factor_return=float(cycle.market_factor_return),
        gdp_growth=float(cycle.gdp_growth),
        interest_rate=float(cycle.interest_rate),
        market_sentiment=float(cycle.market_sentiment),
    )
