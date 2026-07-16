"""Portfolio, orders, watchlist — all require JWT auth."""

import logging
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.dependencies import get_user_portfolio
from apps.api.exceptions import NotFoundError
from apps.api.schemas import (
    HoldingResponse,
    OrderRequest,
    OrderResponse,
    PortfolioAnalyticsResponse,
    PortfolioResponse,
    TransactionItem,
    WatchlistAddRequest,
    WatchlistItem,
)
from apps.api.services import watchlist_service
from apps.api.services.portfolio_service import compute_risk_metrics, get_portfolio_history
from apps.api.services.trade_service import cancel_order, get_portfolio_analytics, list_orders, place_order
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


@router.get("/portfolio/analytics", response_model=PortfolioAnalyticsResponse)
def get_portfolio_analytics_endpoint(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioAnalyticsResponse:
    analytics = get_portfolio_analytics(db, user, timeline_id)
    # Risk metrics ride on the same reconstructed history series Performance uses.
    metrics = compute_risk_metrics(get_portfolio_history(db, user, timeline_id, "MAX"))
    return analytics.model_copy(update=metrics)


@router.get("/portfolio", response_model=PortfolioResponse)
def get_portfolio(
    portfolio: Portfolio = Depends(get_user_portfolio),
    db: Session = Depends(get_db),
) -> PortfolioResponse:
    holdings = db.query(Holding).filter_by(portfolio_id=portfolio.id).all()
    company_ids = {h.company_id for h in holdings}
    companies_map = {
        c.id: c for c in db.query(Company).filter(Company.id.in_(company_ids)).all()
    } if company_ids else {}
    holding_responses = []
    holdings_value = Decimal(0)
    for h in holdings:
        company = companies_map.get(h.company_id)
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


@router.get("/orders", response_model=list[OrderResponse])
def get_orders(
    timeline_id: int = Query(default=settings.default_timeline_id),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(open|filled|cancelled)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[OrderResponse]:
    """Open orders / filled orders / order history are all this endpoint with a
    different `status` filter — not four separate endpoints."""
    return list_orders(db, user, timeline_id, status_filter)


@router.delete("/orders/{order_id}", response_model=OrderResponse)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrderResponse:
    result = cancel_order(db, user, order_id)
    db.commit()
    return result


@router.get("/transactions", response_model=list[TransactionItem])
def get_transactions(
    timeline_id: int = Query(default=settings.default_timeline_id),
    limit: int = 50,
    offset: int = 0,
    ticker: str | None = Query(default=None),
    side: str | None = Query(default=None, pattern="^(buy|sell)$"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TransactionItem]:
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        return []

    query = db.query(Transaction).filter_by(portfolio_id=portfolio.id)
    if ticker:
        company = db.query(Company).filter_by(ticker=ticker.upper()).first()
        if company is None:
            return []
        query = query.filter(Transaction.company_id == company.id)
    if side:
        query = query.filter(Transaction.side == side)
    if date_from is not None:
        query = query.filter(Transaction.sim_date >= date_from)
    if date_to is not None:
        query = query.filter(Transaction.sim_date <= date_to)

    rows = (
        query
        .order_by(Transaction.sim_date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    txn_company_ids = {r.company_id for r in rows}
    txn_companies = {
        c.id: c for c in db.query(Company).filter(Company.id.in_(txn_company_ids)).all()
    } if txn_company_ids else {}
    items = []
    for r in rows:
        company = txn_companies.get(r.company_id)
        items.append(
            TransactionItem(
                id=r.id,
                sim_date=r.sim_date,
                ticker=company.ticker if company else "",
                side=r.side,
                quantity=int(r.quantity),
                price=r.price,
                fees=r.fees,
                realized_pnl=r.realized_pnl,
            )
        )
    return items


@router.get("/watchlist", response_model=list[WatchlistItem])
def get_watchlist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WatchlistItem]:
    # Legacy flat endpoint — reads the user's default watchlist group so the
    # Dashboard dock and the new named-lists page stay consistent.
    group = watchlist_service.get_or_create_default_group(db, user)
    rows = (
        db.query(Watchlist)
        .filter_by(group_id=group.id)
        .order_by(Watchlist.sort_order.asc(), Watchlist.id.asc())
        .all()
    )
    wl_company_ids = {r.company_id for r in rows}
    wl_companies = {
        c.id: c for c in db.query(Company).filter(Company.id.in_(wl_company_ids)).all()
    } if wl_company_ids else {}
    items = []
    for r in rows:
        company = wl_companies.get(r.company_id)
        if company is None:
            continue
        items.append(WatchlistItem(company_id=company.id, ticker=company.ticker, name=company.name))
    return items


@router.post("/watchlist", response_model=WatchlistItem, status_code=status.HTTP_201_CREATED)
def add_watchlist(
    body: WatchlistAddRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchlistItem:
    """Legacy flat endpoint — adds to the user's default watchlist group."""
    company = db.query(Company).filter_by(id=body.company_id).first()
    if company is None:
        raise NotFoundError("Company not found")

    group = watchlist_service.get_or_create_default_group(db, user)
    watchlist_service.add_item(db, user, group.id, body.company_id)
    return WatchlistItem(company_id=company.id, ticker=company.ticker, name=company.name)


@router.delete("/watchlist/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watchlist(
    company_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Legacy flat endpoint — removes from the user's default watchlist group."""
    group = watchlist_service.get_or_create_default_group(db, user)
    watchlist_service.remove_item(db, user, group.id, company_id)
    return None
