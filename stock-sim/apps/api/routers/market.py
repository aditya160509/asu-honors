"""Market data read-only endpoints."""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from apps.api.config import settings
from apps.api.database import get_db
from apps.api.response_cache import response_cache
from apps.api.schemas import (
    CompanyDetail,
    CompanyDividendsResponse,
    CycleStateResponse,
    DriverBreakdown,
    DriverHistoryItem,
    FinancialStatementResponse,
    MarketGridResponse,
    MarketNewsBulletinResponse,
    MarketOrderBookResponse,
    MarketRegimeResponse,
    MarketSessionResponse,
    PriceHistoryItem,
    ValuationResponse,
)
from apps.api.services import dividend_service, market_service, realism_service
from apps.api.services.pdf_service import generate_financial_report_pdf
from db.models import BalanceSheet, CashFlowStatement, Company, IncomeStatement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Market Data"])


@router.get("/market/session", response_model=MarketSessionResponse)
def get_market_session(
    timeline_id: int = Query(default=settings.default_timeline_id),
    sim_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
) -> MarketSessionResponse:
    return realism_service.get_session_state(db, timeline_id, sim_date)


@router.get("/market/regime", response_model=MarketRegimeResponse)
def get_market_regime(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
) -> MarketRegimeResponse:
    return realism_service.get_latest_regime(db, timeline_id)


@router.get("/market/order-book/{ticker}", response_model=MarketOrderBookResponse)
def get_order_book(
    ticker: str,
    timeline_id: int = Query(default=settings.default_timeline_id),
    sim_date: Optional[date] = Query(default=None),
    tick_index: int = Query(default=0, ge=0, le=390),
    db: Session = Depends(get_db),
) -> MarketOrderBookResponse:
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
    row = realism_service.get_order_book_snapshot(db, timeline_id, company.id, sim_date, tick_index)
    return MarketOrderBookResponse(
        timeline_id=row.timeline_id,
        company_id=row.company_id,
        ticker=company.ticker,
        sim_date=row.sim_date,
        tick_index=row.tick_index,
        tick_at=row.tick_at,
        phase=row.phase,
        mid_price=row.mid_price,
        bid_price=row.bid_price,
        ask_price=row.ask_price,
        spread_bps=float(row.spread_bps),
        bid_size=int(row.bid_size),
        ask_size=int(row.ask_size),
        volume=int(row.volume),
        order_imbalance=float(row.order_imbalance),
        slippage_bps=float(row.slippage_bps),
        regime=row.regime,
        is_halted=row.is_halted,
        halt_reason=row.halt_reason,
        depth=row.depth,
    )


@router.get("/companies/{ticker}/micro-ticks")
def get_company_micro_ticks(
    ticker: str,
    timeline_id: int = Query(default=settings.default_timeline_id),
    sim_date: Optional[date] = Query(default=None),
    limit: int = Query(default=390, ge=1, le=390),
    db: Session = Depends(get_db),
) -> list[dict]:
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
    rows = realism_service.list_micro_ticks(db, timeline_id, company.id, sim_date, limit)
    return [
        {
            "timeline_id": row.timeline_id,
            "company_id": row.company_id,
            "ticker": company.ticker,
            "sim_date": row.sim_date,
            "tick_index": row.tick_index,
            "tick_at": row.tick_at,
            "phase": row.phase,
            "mid_price": float(row.mid_price),
            "bid_price": float(row.bid_price),
            "ask_price": float(row.ask_price),
            "spread_bps": float(row.spread_bps),
            "bid_size": int(row.bid_size),
            "ask_size": int(row.ask_size),
            "volume": int(row.volume),
            "order_imbalance": float(row.order_imbalance),
            "slippage_bps": float(row.slippage_bps),
            "regime": row.regime,
            "is_halted": row.is_halted,
            "halt_reason": row.halt_reason,
            "depth": row.depth,
        }
        for row in rows
    ]


@router.get("/market/news/bulletins", response_model=list[MarketNewsBulletinResponse])
def get_market_news_bulletins(
    timeline_id: int = Query(default=settings.default_timeline_id),
    sim_date: Optional[date] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list:
    return realism_service.list_market_news(db, timeline_id, sim_date, limit)


@router.get("/market", response_model=MarketGridResponse)
def get_market(
    timeline_id: int = Query(default=settings.default_timeline_id),
    as_of_date: Optional[date] = Query(default=None, description="Return the grid as it stood on this sim date instead of live/latest."),
    db: Session = Depends(get_db),
) -> MarketGridResponse:
    ttl = 300.0 if as_of_date is not None else 3.0
    return response_cache.get_or_create(
        ("market", timeline_id, as_of_date),
        ttl,
        lambda: market_service.get_market_grid(db, timeline_id, as_of_date=as_of_date),
    )


@router.get("/market/cycle", response_model=CycleStateResponse)
def get_cycle(timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)) -> CycleStateResponse:
    return response_cache.get_or_create(
        ("cycle", timeline_id), 3.0, lambda: market_service.get_cycle_state(db, timeline_id)
    )


@router.get("/companies/{ticker}", response_model=CompanyDetail)
def get_company(ticker: str, timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)) -> CompanyDetail:
    return market_service.get_company_detail(db, ticker, timeline_id)


@router.get("/companies/{ticker}/history", response_model=list[PriceHistoryItem])
def get_company_history(
    ticker: str,
    timeline_id: int = Query(default=settings.default_timeline_id, alias="timeline"),
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> list[PriceHistoryItem]:
    return market_service.get_price_history(db, ticker, timeline_id, from_date, to_date)


@router.get("/companies/{ticker}/drivers", response_model=list[DriverBreakdown])
def get_company_drivers(
    ticker: str,
    timeline_id: int = Query(default=settings.default_timeline_id),
    sim_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[DriverBreakdown]:
    return market_service.get_driver_breakdowns(db, ticker, timeline_id, sim_date)


@router.get("/companies/{ticker}/drivers/history", response_model=list[DriverHistoryItem])
def get_company_driver_history(
    ticker: str,
    limit: int = Query(default=252, ge=1, le=1000),
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
) -> list[DriverHistoryItem]:
    return market_service.get_driver_history(db, ticker, timeline_id, limit)


@router.get("/companies/{ticker}/financials", response_model=FinancialStatementResponse)
def get_company_financials(
    ticker: str,
    period: Optional[str] = Query(default=None),
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
) -> FinancialStatementResponse:
    return market_service.get_financials(db, ticker, period, timeline_id)


@router.get("/companies/{ticker}/financials/history", response_model=list[FinancialStatementResponse])
def get_company_financials_history(
    ticker: str,
    limit: int = Query(default=8, ge=1, le=40),
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
) -> list[FinancialStatementResponse]:
    return market_service.get_financials_history(db, ticker, limit, timeline_id)


@router.get("/companies/{ticker}/valuation", response_model=ValuationResponse)
def get_company_valuation(
    ticker: str, timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)
) -> ValuationResponse:
    return market_service.get_valuation(db, ticker, timeline_id)


@router.get("/companies/{ticker}/dividends", response_model=CompanyDividendsResponse)
def get_company_dividends(
    ticker: str, timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)
) -> CompanyDividendsResponse:
    return dividend_service.get_company_dividends(db, ticker, timeline_id)


@router.get("/companies/{ticker}/report/{fiscal_period}/pdf")
def download_financial_report_pdf(
    ticker: str,
    fiscal_period: str,
    db: Session = Depends(get_db),
) -> Response:
    company = db.query(Company).options(joinedload(Company.industry)).filter(Company.ticker == ticker.upper()).first()
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")

    income = (
        db.query(IncomeStatement)
        .filter(IncomeStatement.company_id == company.id, IncomeStatement.fiscal_period == fiscal_period)
        .first()
    )
    balance = (
        db.query(BalanceSheet)
        .filter(BalanceSheet.company_id == company.id, BalanceSheet.fiscal_period == fiscal_period)
        .first()
    )
    cashflow = (
        db.query(CashFlowStatement)
        .filter(CashFlowStatement.company_id == company.id, CashFlowStatement.fiscal_period == fiscal_period)
        .first()
    )

    if not income and not balance and not cashflow:
        raise HTTPException(status_code=404, detail=f"No financial data for {ticker} / {fiscal_period}")

    pdf_bytes = generate_financial_report_pdf(company, income, balance, cashflow, fiscal_period)
    filename = f"{ticker}_{fiscal_period}_report.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
