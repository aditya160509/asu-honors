"""Market data read-only endpoints."""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from apps.api.config import settings
from apps.api.database import get_db
from apps.api.schemas import (
    CompanyDetail,
    CycleStateResponse,
    DriverBreakdown,
    FinancialStatementResponse,
    MarketGridResponse,
    PriceHistoryItem,
    ValuationResponse,
)
from apps.api.services import market_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Market Data"])


@router.get("/market", response_model=MarketGridResponse)
def get_market(timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)) -> MarketGridResponse:
    return market_service.get_market_grid(db, timeline_id)


@router.get("/market/cycle", response_model=CycleStateResponse)
def get_cycle(timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)) -> CycleStateResponse:
    return market_service.get_cycle_state(db, timeline_id)


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


@router.get("/companies/{ticker}/financials", response_model=FinancialStatementResponse)
def get_company_financials(
    ticker: str,
    period: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> FinancialStatementResponse:
    return market_service.get_financials(db, ticker, period)


@router.get("/companies/{ticker}/valuation", response_model=ValuationResponse)
def get_company_valuation(
    ticker: str, timeline_id: int = Query(default=settings.default_timeline_id), db: Session = Depends(get_db)
) -> ValuationResponse:
    return market_service.get_valuation(db, ticker, timeline_id)
