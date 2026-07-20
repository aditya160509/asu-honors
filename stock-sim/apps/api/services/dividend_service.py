"""User dividend receipts derived at read time from the company-level schedule.

A receipt = shares held at ex_date x amount_per_share. Shares-at-date is
reconstructed by walking the transaction ledger (YAGNI: no materialized
dividend_receipts table until computing on the fly is actually a problem).
Receipts are display-only — the sim engine does not credit dividends to cash.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from apps.api.schemas import (
    CompanyDividendItem,
    CompanyDividendsResponse,
    DividendReceipt,
    PortfolioDividendsResponse,
    UpcomingDividend,
)
from db.models import Company, Dividend, Holding, Portfolio, SimulationState, Transaction, User

logger = logging.getLogger(__name__)


def _current_sim_date(db: Session, timeline_id: int) -> date:
    state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    return state.current_sim_date if state is not None else date.today()


def _shares_held_at(txns: list[Transaction], company_id: int, on: date) -> float:
    qty = 0.0
    for t in txns:
        if t.company_id != company_id or t.sim_date > on:
            continue
        qty += float(t.quantity) if t.side == "buy" else -float(t.quantity)
    return qty


def get_portfolio_dividends(db: Session, user: User, timeline_id: int) -> PortfolioDividendsResponse:
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        return PortfolioDividendsResponse(
            received=[], upcoming=[], total_received=Decimal(0), trailing_12m_received=Decimal(0)
        )

    current = _current_sim_date(db, timeline_id)

    txns = (
        db.query(Transaction)
        .filter_by(portfolio_id=portfolio.id)
        .order_by(Transaction.sim_date.asc(), Transaction.id.asc())
        .all()
    )
    traded_company_ids = {t.company_id for t in txns}
    held_now = {
        h.company_id: float(h.quantity)
        for h in db.query(Holding).filter_by(portfolio_id=portfolio.id).all()
    }
    relevant_ids = traded_company_ids | set(held_now)
    if not relevant_ids:
        return PortfolioDividendsResponse(
            received=[], upcoming=[], total_received=Decimal(0), trailing_12m_received=Decimal(0)
        )

    dividends = (
        db.query(Dividend)
        .filter(Dividend.timeline_id == timeline_id, Dividend.company_id.in_(relevant_ids))
        .order_by(Dividend.ex_date.asc())
        .all()
    )
    companies = {
        c.id: c for c in db.query(Company).filter(Company.id.in_(relevant_ids)).all()
    }

    received: list[DividendReceipt] = []
    upcoming: list[UpcomingDividend] = []
    total_received = Decimal(0)
    trailing_12m = Decimal(0)
    twelve_months_ago = current - timedelta(days=365)

    for div in dividends:
        company = companies.get(div.company_id)
        if company is None:
            continue
        amount = Decimal(str(div.amount_per_share))

        if div.ex_date <= current:
            shares = _shares_held_at(txns, div.company_id, div.ex_date)
            if shares <= 0:
                continue
            total = (amount * Decimal(str(shares))).quantize(Decimal("0.01"))
            received.append(
                DividendReceipt(
                    ticker=company.ticker,
                    company_name=company.name,
                    declared_date=div.declared_date,
                    ex_date=div.ex_date,
                    payment_date=div.payment_date,
                    amount_per_share=amount,
                    shares_held=int(shares),
                    total_amount=total,
                )
            )
            total_received += total
            if div.ex_date >= twelve_months_ago:
                trailing_12m += total
        else:
            # Only declared-but-not-yet-paid dividends for currently held shares.
            shares = held_now.get(div.company_id, 0.0)
            if shares <= 0 or div.declared_date > current:
                continue
            upcoming.append(
                UpcomingDividend(
                    ticker=company.ticker,
                    company_name=company.name,
                    declared_date=div.declared_date,
                    ex_date=div.ex_date,
                    payment_date=div.payment_date,
                    amount_per_share=amount,
                    shares_held=int(shares),
                    estimated_total=(amount * Decimal(str(shares))).quantize(Decimal("0.01")),
                )
            )

    received.sort(key=lambda r: r.ex_date, reverse=True)
    upcoming.sort(key=lambda u: u.ex_date)
    return PortfolioDividendsResponse(
        received=received,
        upcoming=upcoming,
        total_received=total_received,
        trailing_12m_received=trailing_12m,
    )


def get_company_dividends(db: Session, ticker: str, timeline_id: int) -> CompanyDividendsResponse:
    """Company-level dividend schedule + trailing-12m yield -- independent of any user's holdings
    (dividend_service's other function is portfolio-scoped and can't answer "what does this
    company pay" on its own)."""
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")

    current = _current_sim_date(db, timeline_id)
    twelve_months_ago = current - timedelta(days=365)

    divs = (
        db.query(Dividend)
        .filter(Dividend.company_id == company.id, Dividend.timeline_id == timeline_id, Dividend.ex_date <= current)
        .order_by(Dividend.ex_date.desc())
        .all()
    )

    history = [
        CompanyDividendItem(
            declared_date=d.declared_date,
            ex_date=d.ex_date,
            payment_date=d.payment_date,
            amount_per_share=Decimal(str(d.amount_per_share)),
        )
        for d in divs
    ]

    trailing_sum = sum(
        float(d.amount_per_share) for d in divs if d.ex_date >= twelve_months_ago
    )
    price = float(company.current_price) if company.current_price else None
    yield_pct = (trailing_sum / price * 100.0) if price and price > 0 and trailing_sum > 0 else None

    return CompanyDividendsResponse(history=history, trailing_12m_yield_pct=yield_pct)
