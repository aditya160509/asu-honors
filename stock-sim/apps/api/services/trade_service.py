"""Order lifecycle (Phase 3 — Trading Desk), execution, and transaction ledger management."""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import ConflictError, InsufficientFundsError, InsufficientSharesError, NotFoundError
from apps.api.schemas import OrderRequest, OrderResponse, PortfolioAnalyticsResponse, SectorAllocation
from db.models import Company, ConfigParameter, Holding, Industry, Order, Portfolio, SimulationState, Transaction, User
logger = logging.getLogger(__name__)

DEFAULT_FEE_RATE = 0.001


def _get_fee_rate(db: Session) -> float:
    row = db.query(ConfigParameter).filter_by(key="trade_fee_rate", scope="global").first()
    if row is None:
        return DEFAULT_FEE_RATE
    try:
        return float(row.value)
    except ValueError:
        return DEFAULT_FEE_RATE


def _current_sim_date(db: Session, timeline_id: int) -> date:
    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        return date.today()
    return sim_state.current_sim_date


def _compute_execution_price(company: Company, side: str, quantity: int) -> tuple[Decimal, Decimal]:
    """Return (current_price, 0) — no market-impact adjustment."""
    return Decimal(str(company.current_price)), Decimal(0)


def _clamp_to_limit(side: str, execution_price: Decimal, limit_price: Decimal) -> Decimal:
    """A limit order never fills worse than its own limit, once crossed."""
    return min(execution_price, limit_price) if side == "buy" else max(execution_price, limit_price)


def _compute_fees(db: Session, quantity: int, execution_price: Decimal) -> Decimal:
    fee_rate = _get_fee_rate(db)
    return (Decimal(quantity) * execution_price * Decimal(str(fee_rate))).quantize(Decimal("0.0001"))


def _limit_crosses(side: str, limit_price: Optional[Decimal], current_price: Decimal) -> bool:
    if limit_price is None:
        return False
    limit_price = Decimal(str(limit_price))
    return current_price <= limit_price if side == "buy" else current_price >= limit_price


def _validate_order(
    portfolio: Portfolio,
    holding: Optional[Holding],
    side: str,
    quantity: int,
    execution_price: Decimal,
    fees: Decimal,
) -> None:
    if side == "buy":
        required_cash = Decimal(quantity) * execution_price + fees
        if Decimal(str(portfolio.cash_balance)) < required_cash:
            raise InsufficientFundsError("Insufficient cash for this order")
    else:
        owned = Decimal(str(holding.quantity)) if holding is not None else Decimal(0)
        if owned < Decimal(quantity):
            raise InsufficientSharesError("Not enough shares to sell")


def _compute_realized_pnl(avg_cost_basis: Decimal, sell_price: Decimal, quantity: int) -> Decimal:
    """Realized PnL is computed against the position's existing avg cost basis."""
    return (sell_price - avg_cost_basis) * Decimal(quantity)


def _execute_buy(
    db: Session,
    portfolio: Portfolio,
    holding: Optional[Holding],
    company: Company,
    quantity: int,
    price: Decimal,
    fees: Decimal,
) -> None:
    cost = Decimal(quantity) * price
    portfolio.cash_balance = Decimal(str(portfolio.cash_balance)) - cost - fees

    if holding is None:
        holding = Holding(
            portfolio_id=portfolio.id,
            company_id=company.id,
            quantity=quantity,
            avg_cost_basis=price,
        )
        db.add(holding)
    else:
        old_qty = Decimal(str(holding.quantity))
        old_cost = Decimal(str(holding.avg_cost_basis))
        new_qty = old_qty + Decimal(quantity)
        new_avg = (old_qty * old_cost + Decimal(quantity) * price) / new_qty
        holding.quantity = new_qty
        holding.avg_cost_basis = new_avg


def _execute_sell(
    db: Session,
    portfolio: Portfolio,
    holding: Holding,
    quantity: int,
    price: Decimal,
    fees: Decimal,
) -> Decimal:
    avg_cost = Decimal(str(holding.avg_cost_basis))
    realized_pnl = _compute_realized_pnl(avg_cost, price, quantity)

    proceeds = Decimal(quantity) * price
    portfolio.cash_balance = Decimal(str(portfolio.cash_balance)) + proceeds - fees

    remaining = Decimal(str(holding.quantity)) - Decimal(quantity)
    if remaining <= 0:
        db.delete(holding)
    else:
        holding.quantity = remaining

    return realized_pnl


def _fill_order(
    db: Session,
    order: Order,
    portfolio: Portfolio,
    holding: Optional[Holding],
    company: Company,
    execution_price: Decimal,
    fees: Decimal,
    impact: Decimal,
    sim_date: date,
) -> Optional[Decimal]:
    """Executes the cash/holding mutation + Transaction write for an order that
    is crossing right now (market, or a limit order whose price condition is
    met) — shared by immediate fills in place_order and later fills from
    check_and_fill_limit_orders."""
    realized_pnl: Optional[Decimal] = None
    quantity = int(order.quantity)
    if order.side == "buy":
        _execute_buy(db, portfolio, holding, company, quantity, execution_price, fees)
    else:
        realized_pnl = _execute_sell(db, portfolio, holding, quantity, execution_price, fees)

    txn = Transaction(
        portfolio_id=portfolio.id,
        company_id=company.id,
        order_id=order.id,
        sim_date=sim_date,
        side=order.side,
        quantity=quantity,
        price=execution_price,
        fees=fees,
        impact_applied=impact,
        realized_pnl=realized_pnl,
    )
    db.add(txn)

    order.status = "filled"
    order.filled_quantity = quantity
    order.avg_fill_price = execution_price
    order.fees = fees
    order.filled_at = datetime.now(timezone.utc)

    db.flush()
    return realized_pnl


def _order_to_response(order: Order, ticker: str, realized_pnl: Optional[Decimal] = None) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        portfolio_id=order.portfolio_id,
        company_id=order.company_id,
        ticker=ticker,
        sim_date=order.sim_date,
        side=order.side,
        order_type=order.order_type,
        status=order.status,
        quantity=int(order.quantity),
        filled_quantity=int(order.filled_quantity),
        limit_price=Decimal(str(order.limit_price)) if order.limit_price is not None else None,
        price=Decimal(str(order.avg_fill_price)) if order.avg_fill_price is not None else None,
        fees=Decimal(str(order.fees)) if order.fees is not None else None,
        realized_pnl=realized_pnl,
    )


def place_order(db: Session, user: User, request: OrderRequest) -> OrderResponse:
    """Full order lifecycle: validate -> create Order -> fill immediately if
    market (or a limit that already crosses) -> return. A non-crossing limit
    order is persisted 'open' and left untouched (no cash/holding change) until
    check_and_fill_limit_orders fills it or the user cancels it."""
    timeline_id = request.timeline_id
    company = db.query(Company).filter_by(ticker=request.ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{request.ticker}' not found")
    if company.current_price is None:
        raise NotFoundError(f"No price available for '{request.ticker}'")

    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        raise NotFoundError("Portfolio not found")

    holding = db.query(Holding).filter_by(portfolio_id=portfolio.id, company_id=company.id).first()
    current_price = Decimal(str(company.current_price))
    sim_date = _current_sim_date(db, timeline_id)

    order = Order(
        portfolio_id=portfolio.id,
        company_id=company.id,
        sim_date=sim_date,
        side=request.side,
        order_type=request.order_type,
        quantity=request.quantity,
        limit_price=request.limit_price,
        status="open",
        filled_quantity=0,
    )
    db.add(order)
    db.flush()  # assigns order.id before any Transaction can reference it

    crosses_now = request.order_type == "market" or _limit_crosses(request.side, request.limit_price, current_price)

    realized_pnl: Optional[Decimal] = None
    if crosses_now:
        execution_price, impact = _compute_execution_price(company, request.side, request.quantity)
        if request.order_type == "limit":
            execution_price = _clamp_to_limit(request.side, execution_price, Decimal(str(request.limit_price)))
        fees = _compute_fees(db, request.quantity, execution_price)
        _validate_order(portfolio, holding, request.side, request.quantity, execution_price, fees)
        realized_pnl = _fill_order(db, order, portfolio, holding, company, execution_price, fees, impact, sim_date)
    else:
        # Non-crossing limit order: pre-check buying power/shares against the
        # limit price itself (the worst case the user has committed to). Cash
        # is NOT reserved/escrowed for open orders in this v1 — a user could
        # place several limit orders that collectively exceed current cash;
        # check_and_fill_limit_orders re-validates at fill time and simply
        # leaves an order open (rather than erroring) if funds are no longer
        # sufficient by then.
        limit_price = Decimal(str(request.limit_price))
        fee_estimate = _compute_fees(db, request.quantity, limit_price)
        _validate_order(portfolio, holding, request.side, request.quantity, limit_price, fee_estimate)

    return _order_to_response(order, company.ticker, realized_pnl)


def cancel_order(db: Session, user: User, order_id: int) -> OrderResponse:
    order = (
        db.query(Order)
        .join(Portfolio, Portfolio.id == Order.portfolio_id)
        .filter(Order.id == order_id, Portfolio.user_id == user.id)
        .first()
    )
    if order is None:
        raise NotFoundError("Order not found")
    if order.status != "open":
        raise ConflictError(f"Order is already {order.status} — cannot cancel")

    order.status = "cancelled"
    order.cancelled_at = datetime.now(timezone.utc)
    db.flush()

    company = db.query(Company).filter_by(id=order.company_id).first()
    return _order_to_response(order, company.ticker if company else "")


def list_orders(
    db: Session, user: User, timeline_id: int, status: Optional[str] = None
) -> list[OrderResponse]:
    query = (
        db.query(Order)
        .join(Portfolio, Portfolio.id == Order.portfolio_id)
        .filter(Portfolio.user_id == user.id, Portfolio.timeline_id == timeline_id)
    )
    if status is not None:
        query = query.filter(Order.status == status)
    orders = query.order_by(Order.created_at.desc()).all()

    company_ids = {o.company_id for o in orders}
    companies = {c.id: c for c in db.query(Company).filter(Company.id.in_(company_ids)).all()} if company_ids else {}
    return [
        _order_to_response(o, companies[o.company_id].ticker if o.company_id in companies else "")
        for o in orders
    ]


def check_and_fill_limit_orders(db: Session, timeline_id: int) -> int:
    """Called once per advance_simulation call, against the end-of-advance
    price (not re-checked against every intermediate day of a multi-day
    advance — see Phase 3 plan notes). Fills any open limit order whose limit
    price has been crossed. Returns the number of orders filled."""
    open_orders = (
        db.query(Order)
        .join(Portfolio, Portfolio.id == Order.portfolio_id)
        .filter(Portfolio.timeline_id == timeline_id, Order.status == "open", Order.order_type == "limit")
        .all()
    )

    filled_count = 0
    sim_date = _current_sim_date(db, timeline_id)
    for order in open_orders:
        company = db.query(Company).filter_by(id=order.company_id).first()
        if company is None or company.current_price is None:
            continue
        current_price = Decimal(str(company.current_price))
        if not _limit_crosses(order.side, order.limit_price, current_price):
            continue

        portfolio = db.query(Portfolio).filter_by(id=order.portfolio_id).first()
        holding = db.query(Holding).filter_by(portfolio_id=portfolio.id, company_id=company.id).first()
        execution_price, impact = _compute_execution_price(company, order.side, int(order.quantity))
        execution_price = _clamp_to_limit(order.side, execution_price, Decimal(str(order.limit_price)))
        fees = _compute_fees(db, int(order.quantity), execution_price)

        try:
            _validate_order(portfolio, holding, order.side, int(order.quantity), execution_price, fees)
        except (InsufficientFundsError, InsufficientSharesError):
            # Portfolio state changed since the order was placed — leave it
            # open rather than silently cancelling; the user can cancel
            # manually if they no longer want it.
            continue

        _fill_order(db, order, portfolio, holding, company, execution_price, fees, impact, sim_date)
        filled_count += 1

    return filled_count


def get_portfolio_analytics(db: Session, user: User, timeline_id: int) -> PortfolioAnalyticsResponse:
    """Compute portfolio analytics: return, PnL, sector allocation, win rate."""
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        raise NotFoundError("Portfolio not found")

    cash = Decimal(str(portfolio.cash_balance))
    holdings = db.query(Holding).filter_by(portfolio_id=portfolio.id).all()
    industries = {ind.id: ind.name for ind in db.query(Industry).all()}

    ana_company_ids = {h.company_id for h in holdings}
    ana_companies = {
        c.id: c for c in db.query(Company).filter(Company.id.in_(ana_company_ids)).all()
    } if ana_company_ids else {}
    holdings_value = Decimal(0)
    unrealized_pnl = Decimal(0)
    sector_values: dict[str, Decimal] = {}
    for h in holdings:
        company = ana_companies.get(h.company_id)
        if company is None or company.current_price is None:
            continue
        price = Decimal(str(company.current_price))
        qty = Decimal(str(h.quantity))
        cost = Decimal(str(h.avg_cost_basis))
        mv = qty * price
        holdings_value += mv
        unrealized_pnl += (price - cost) * qty
        sector = industries.get(company.industry_id, "Unknown")
        sector_values[sector] = sector_values.get(sector, Decimal(0)) + mv

    total_value = cash + holdings_value

    user_start = Decimal(str(user.starting_cash)) if user.starting_cash else Decimal(1)
    total_return_pct = float((total_value - user_start) / user_start * 100) if user_start > 0 else 0.0

    realized_pnl = Decimal(0)
    total_closed = 0
    winning_closed = 0
    txn_rows = (
        db.query(Transaction)
        .filter_by(portfolio_id=portfolio.id)
        .all()
    )
    for t in txn_rows:
        if t.realized_pnl is not None:
            rp = Decimal(str(t.realized_pnl))
            realized_pnl += rp
            total_closed += 1
            if rp > 0:
                winning_closed += 1

    win_rate = float(winning_closed / total_closed * 100) if total_closed > 0 else None
    cash_pct = float(cash / total_value * 100) if total_value > 0 else 0.0

    total_for_pct = max(holdings_value, Decimal(1))
    allocation = [
        SectorAllocation(sector=s, value=v, pct=float(v / total_for_pct * 100))
        for s, v in sorted(sector_values.items(), key=lambda x: x[1], reverse=True)
    ]

    return PortfolioAnalyticsResponse(
        total_value=total_value,
        cash_balance=cash,
        total_return_pct=total_return_pct,
        unrealized_pnl=unrealized_pnl,
        realized_pnl=realized_pnl,
        num_positions=len(holdings),
        win_rate=win_rate,
        allocation_by_sector=allocation,
        cash_allocation_pct=cash_pct,
    )
