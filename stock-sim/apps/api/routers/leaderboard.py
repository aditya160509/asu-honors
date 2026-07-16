"""Leaderboard endpoint."""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from apps.api.config import settings
from apps.api.database import get_db
from apps.api.schemas import LeaderboardEntry
from db.models import Company, Holding, Portfolio, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/leaderboard", tags=["Leaderboard"])


@router.get("", response_model=list[LeaderboardEntry])
def get_leaderboard(
    timeline_id: int = Query(default=settings.default_timeline_id),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[LeaderboardEntry]:
    holdings_subq = (
        db.query(
            Holding.portfolio_id.label("pf_id"),
            func.sum(Holding.quantity * Company.current_price).label("holdings_value"),
        )
        .join(Company, Holding.company_id == Company.id)
        .group_by(Holding.portfolio_id)
        .subquery()
    )

    rows = (
        db.query(
            User.display_name,
            Portfolio.cash_balance,
            holdings_subq.c.holdings_value,
            User.starting_cash,
        )
        .select_from(Portfolio)
        .join(User, Portfolio.user_id == User.id)
        .outerjoin(holdings_subq, holdings_subq.c.pf_id == Portfolio.id)
        .filter(Portfolio.timeline_id == timeline_id)
        .order_by(
            (Portfolio.cash_balance + func.coalesce(holdings_subq.c.holdings_value, 0)).desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    leaderboard = []
    for name, cash, hval, start_cash in rows:
        cash_dec = Decimal(str(cash)) if cash is not None else Decimal(0)
        hval_dec = Decimal(str(hval)) if hval is not None else Decimal(0)
        total_value = cash_dec + hval_dec
        starting_cash = Decimal(str(start_cash)) if start_cash else Decimal(1)
        return_pct = float((total_value - starting_cash) / starting_cash * 100) if starting_cash else 0.0
        leaderboard.append((name, total_value, return_pct))

    return [
        LeaderboardEntry(rank=offset + i + 1, display_name=name, total_value=value, return_pct=pct)
        for i, (name, value, pct) in enumerate(leaderboard)
    ]
