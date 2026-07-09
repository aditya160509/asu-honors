"""Leaderboard endpoint."""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from apps.api.database import get_db
from apps.api.schemas import LeaderboardEntry
from db.models import Company, Holding, Portfolio, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/leaderboard", tags=["Leaderboard"])


@router.get("/", response_model=list[LeaderboardEntry])
def get_leaderboard(
    timeline_id: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[LeaderboardEntry]:
    portfolios = db.query(Portfolio).filter_by(timeline_id=timeline_id).all()
    price_cache: dict[int, Decimal] = {}

    def _price(company_id: int) -> Decimal:
        if company_id not in price_cache:
            company = db.query(Company).filter_by(id=company_id).first()
            price_cache[company_id] = Decimal(str(company.current_price)) if company and company.current_price else Decimal(0)
        return price_cache[company_id]

    rows = []
    for pf in portfolios:
        user = db.query(User).filter_by(id=pf.user_id).first()
        if user is None:
            continue
        holdings = db.query(Holding).filter_by(portfolio_id=pf.id).all()
        holdings_value = sum((Decimal(str(h.quantity)) * _price(h.company_id) for h in holdings), Decimal(0))
        total_value = Decimal(str(pf.cash_balance)) + holdings_value
        starting_cash = Decimal(str(user.starting_cash)) if user.starting_cash else Decimal(1)
        return_pct = float((total_value - starting_cash) / starting_cash * 100) if starting_cash else 0.0
        rows.append((user.display_name, total_value, return_pct))

    rows.sort(key=lambda r: r[1], reverse=True)
    rows = rows[:limit]

    return [
        LeaderboardEntry(rank=i + 1, display_name=name, total_value=value, return_pct=pct)
        for i, (name, value, pct) in enumerate(rows)
    ]
