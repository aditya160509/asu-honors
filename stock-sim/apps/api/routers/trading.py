"""Portfolio, orders, watchlist — all require JWT auth."""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user
from apps.api.database import get_db
from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.schemas import (
    HoldingResponse,
    OrderRequest,
    OrderResponse,
    PortfolioResponse,
    TransactionItem,
    WatchlistItem,
)
from apps.api.services.trade_service import place_order
from db.models import Company, Holding, Portfolio, Transaction, User, Watchlist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Trading & Portfolio"])


def _build_holding_response(holding: Holding, company: Company) -> HoldingResponse:
    current_price = Decimal(str(company.current_price)) if company.current_price is not None else Decimal(0)
    quantity = Decimal(str(holding.quantity))
    avg_cost = Decimal(str(holding.avg_cost_basis))
    market_value = quantity * current_price
    unrealized_pnl = (current_price - avg_cost) * quantity
    # Guard against near-zero (not just exactly-zero) cost basis producing an
    # absurd percentage from rounding-drifted avg_cost_basis.
    unrealized_pnl_pct = (
        float((current_price - avg_cost) / avg_cost * 100) if avg_cost > Decimal("0.01") else 0.0
    )
    return HoldingResponse(
        ticker=company.ticker,
        company_name=company.name,
        quantity=int(quantity),
        avg_cost_basis=avg_cost,
        current_price=current_price,
        market_value=market_value,
        unrealized_pnl=unrealized_pnl,
        unrealized_pnl_pct=unrealized_pnl_pct,
    )


@router.get("/portfolio", response_model=PortfolioResponse)
def get_portfolio(
    timeline_id: int = 1,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioResponse:
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        raise NotFoundError("Portfolio not found")

    holdings = db.query(Holding).filter_by(portfolio_id=portfolio.id).all()
    holding_responses = []
    holdings_value = Decimal(0)
    for h in holdings:
        company = db.query(Company).filter_by(id=h.company_id).first()
        if company is None:
            continue
        hr = _build_holding_response(h, company)
        holding_responses.append(hr)
        holdings_value += hr.market_value

    cash = Decimal(str(portfolio.cash_balance))
    total_value = cash + holdings_value

    day_change_pct = None
    if total_value > 0 and hasattr(portfolio, "total_value") and portfolio.total_value is not None:
        prev_total = Decimal(str(portfolio.total_value))
        day_change_pct = float((total_value - prev_total) / prev_total * 100) if prev_total > 0 else None

    return PortfolioResponse(
        id=portfolio.id,
        cash_balance=cash,
        total_value=total_value,
        holdings=holding_responses,
        day_change_pct=day_change_pct,
    )


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    request: OrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrderResponse:
    result = place_order(db, user, request)
    db.commit()
    return result


@router.get("/transactions", response_model=list[TransactionItem])
def get_transactions(
    timeline_id: int = 1,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TransactionItem]:
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        return []

    rows = (
        db.query(Transaction)
        .filter_by(portfolio_id=portfolio.id)
        .order_by(Transaction.sim_date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = []
    for r in rows:
        company = db.query(Company).filter_by(id=r.company_id).first()
        items.append(
            TransactionItem(
                id=r.id,
                sim_date=r.sim_date,
                ticker=company.ticker if company else "",
                side=r.side,
                quantity=int(r.quantity),
                price=r.price,
                realized_pnl=r.realized_pnl,
            )
        )
    return items


@router.get("/watchlist", response_model=list[WatchlistItem])
def get_watchlist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WatchlistItem]:
    rows = db.query(Watchlist).filter_by(user_id=user.id).all()
    items = []
    for r in rows:
        company = db.query(Company).filter_by(id=r.company_id).first()
        if company is None:
            continue
        items.append(WatchlistItem(company_id=company.id, ticker=company.ticker, name=company.name))
    return items


@router.post("/watchlist", response_model=WatchlistItem, status_code=status.HTTP_201_CREATED)
def add_watchlist(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchlistItem:
    company_id = body.get("company_id")
    company = db.query(Company).filter_by(id=company_id).first()
    if company is None:
        raise NotFoundError("Company not found")

    existing = db.query(Watchlist).filter_by(user_id=user.id, company_id=company_id).first()
    if existing is not None:
        raise ConflictError("Company already in watchlist")

    row = Watchlist(user_id=user.id, company_id=company_id)
    db.add(row)
    db.commit()
    return WatchlistItem(company_id=company.id, ticker=company.ticker, name=company.name)


@router.delete("/watchlist/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watchlist(
    company_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    row = db.query(Watchlist).filter_by(user_id=user.id, company_id=company_id).first()
    if row is not None:
        db.delete(row)
        db.commit()
    return None
