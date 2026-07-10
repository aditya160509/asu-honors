"""Shared FastAPI dependencies beyond get_db / get_current_user."""

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.exceptions import NotFoundError
from db.models import Portfolio, User


def get_user_portfolio(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Portfolio:
    """Load the current user's Portfolio for the given timeline, or 404."""
    portfolio = (
        db.query(Portfolio)
        .filter_by(user_id=user.id, timeline_id=timeline_id)
        .first()
    )
    if portfolio is None:
        raise NotFoundError("Portfolio not found")
    return portfolio
