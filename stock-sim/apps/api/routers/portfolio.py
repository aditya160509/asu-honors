"""Phase 2 portfolio endpoints: history, dividends, goals, named watchlists."""

import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.schemas import (
    GoalCreateRequest,
    GoalResponse,
    GoalUpdateRequest,
    PortfolioDividendsResponse,
    PortfolioHistoryResponse,
    WatchlistAddRequest,
    WatchlistGroupCreateRequest,
    WatchlistGroupRenameRequest,
    WatchlistGroupResponse,
    WatchlistReorderRequest,
)
from apps.api.services import dividend_service, goal_service, portfolio_service, watchlist_service
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Portfolio Phase 2"])

VALID_RANGES = {"1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"}


@router.get("/portfolio/history", response_model=PortfolioHistoryResponse)
def get_portfolio_history(
    range: str = Query(default="1M"),
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioHistoryResponse:
    range_key = range.upper() if range.upper() in VALID_RANGES else "1M"
    return portfolio_service.get_portfolio_history(db, user, timeline_id, range_key)


@router.get("/portfolio/dividends", response_model=PortfolioDividendsResponse)
def get_portfolio_dividends(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioDividendsResponse:
    return dividend_service.get_portfolio_dividends(db, user, timeline_id)


# --------------------------------------------------------------------------
# Goals
# --------------------------------------------------------------------------


@router.get("/goals", response_model=list[GoalResponse])
def list_goals(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[GoalResponse]:
    return goal_service.list_goals(db, user, timeline_id)


@router.post("/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    body: GoalCreateRequest,
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GoalResponse:
    return goal_service.create_goal(db, user, timeline_id, body)


@router.patch("/goals/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    body: GoalUpdateRequest,
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GoalResponse:
    return goal_service.update_goal(db, user, timeline_id, goal_id, body)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    goal_service.delete_goal(db, user, goal_id)
    return None


# --------------------------------------------------------------------------
# Named watchlists
# --------------------------------------------------------------------------


@router.get("/watchlists", response_model=list[WatchlistGroupResponse])
def list_watchlists(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WatchlistGroupResponse]:
    return watchlist_service.list_groups(db, user)


@router.post("/watchlists", response_model=WatchlistGroupResponse, status_code=status.HTTP_201_CREATED)
def create_watchlist_group(
    body: WatchlistGroupCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchlistGroupResponse:
    return watchlist_service.create_group(db, user, body.name)


@router.patch("/watchlists/{group_id}", response_model=WatchlistGroupResponse)
def rename_watchlist_group(
    group_id: int,
    body: WatchlistGroupRenameRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchlistGroupResponse:
    return watchlist_service.rename_group(db, user, group_id, body.name)


@router.delete("/watchlists/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watchlist_group(
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    watchlist_service.delete_group(db, user, group_id)
    return None


@router.post(
    "/watchlists/{group_id}/items",
    response_model=WatchlistGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_watchlist_item(
    group_id: int,
    body: WatchlistAddRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchlistGroupResponse:
    return watchlist_service.add_item(db, user, group_id, body.company_id)


@router.delete("/watchlists/{group_id}/items/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watchlist_item(
    group_id: int,
    company_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    watchlist_service.remove_item(db, user, group_id, company_id)
    return None


@router.put("/watchlists/{group_id}/order", response_model=WatchlistGroupResponse)
def reorder_watchlist_items(
    group_id: int,
    body: WatchlistReorderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchlistGroupResponse:
    return watchlist_service.reorder_items(db, user, group_id, body.company_ids)
