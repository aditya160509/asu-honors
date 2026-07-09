"""Order validation, execution, and transaction ledger management."""

import logging
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import InsufficientFundsError, InsufficientSharesError, NotFoundError
from apps.api.schemas import OrderRequest, OrderResponse
from db.models import Company, ConfigParameter, Holding, Portfolio, SimulationState, Transaction, User
from engine.liquidity import kyle_lambda_from_liquidity, kyle_lambda_impact

logger = logging.getLogger(__name__)

DEFAULT_FEE_RATE = 0.001
DEFAULT_LIQUIDITY_SCORE = 50.0


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


def _compute_impact(company: Company, quantity: int) -> tuple[Decimal, Decimal]:
    """Kyle's-lambda price impact in $/share. Returns (impact, lambda_val)."""
    liq_score = float(company.market_liquidity_score) if company.market_liquidity_score is not None else DEFAULT_LIQUIDITY_SCORE
    lambda_val = kyle_lambda_from_liquidity(liq_score)
    impact = kyle_lambda_impact(float(quantity), lambda_val)
    return Decimal(str(impact)), Decimal(str(lambda_val))


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
    portfolio.cash_balance = float(Decimal(str(portfolio.cash_balance)) - cost - fees)

    if holding is None:
        holding = Holding(
            portfolio_id=portfolio.id,
            company_id=company.id,
            quantity=quantity,
            avg_cost_basis=float(price),
        )
        db.add(holding)
    else:
        old_qty = Decimal(str(holding.quantity))
        old_cost = Decimal(str(holding.avg_cost_basis))
        new_qty = old_qty + Decimal(quantity)
        new_avg = (old_qty * old_cost + Decimal(quantity) * price) / new_qty
        holding.quantity = float(new_qty)
        holding.avg_cost_basis = float(new_avg)


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
    portfolio.cash_balance = float(Decimal(str(portfolio.cash_balance)) + proceeds - fees)

    remaining = Decimal(str(holding.quantity)) - Decimal(quantity)
    if remaining <= 0:
        db.delete(holding)
    else:
        holding.quantity = float(remaining)

    return realized_pnl


def place_order(db: Session, user: User, request: OrderRequest) -> OrderResponse:
    """Full order lifecycle: validate -> execute -> write -> return."""
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
    impact, _lambda_val = _compute_impact(company, request.quantity)
    # Cap impact so a sell can never clear at <= 0 and a buy's impact never
    # exceeds the current price; an unbounded impact would otherwise let the
    # order silently reset to the undiscounted price, defeating the impact
    # model entirely for large orders.
    impact = min(impact, current_price * Decimal("0.99"))
    execution_price = current_price + (impact if request.side == "buy" else -impact)

    fee_rate = _get_fee_rate(db)
    fees = (Decimal(request.quantity) * execution_price * Decimal(str(fee_rate))).quantize(Decimal("0.0001"))

    _validate_order(portfolio, holding, request.side, request.quantity, execution_price, fees)

    sim_date = _current_sim_date(db, timeline_id)
    realized_pnl: Optional[Decimal] = None

    if request.side == "buy":
        _execute_buy(db, portfolio, holding, company, request.quantity, execution_price, fees)
    else:
        realized_pnl = _execute_sell(db, portfolio, holding, request.quantity, execution_price, fees)

    txn = Transaction(
        portfolio_id=portfolio.id,
        company_id=company.id,
        sim_date=sim_date,
        side=request.side,
        quantity=request.quantity,
        price=execution_price,
        fees=fees,
        impact_applied=impact,
        realized_pnl=realized_pnl,
    )
    db.add(txn)
    db.flush()

    return OrderResponse(
        id=txn.id,
        portfolio_id=portfolio.id,
        company_id=company.id,
        sim_date=sim_date,
        side=request.side,
        quantity=request.quantity,
        price=execution_price,
        fees=fees,
        realized_pnl=realized_pnl,
    )
