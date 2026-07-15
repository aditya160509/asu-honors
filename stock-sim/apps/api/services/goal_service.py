"""Goals v1: one goal type — reach a target portfolio value by a target date.

Progress is computed server-side at read time so it is always current;
achieved_at is written the first time progress crosses 100% and never cleared.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from apps.api.schemas import GoalCreateRequest, GoalResponse, GoalUpdateRequest
from db.models import Company, Goal, Holding, Portfolio, User

logger = logging.getLogger(__name__)


def _current_total_value(db: Session, user: User, timeline_id: int) -> Decimal:
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        return Decimal(0)
    total = Decimal(str(portfolio.cash_balance))
    holdings = db.query(Holding).filter_by(portfolio_id=portfolio.id).all()
    company_ids = {h.company_id for h in holdings}
    companies = (
        {c.id: c for c in db.query(Company).filter(Company.id.in_(company_ids)).all()}
        if company_ids
        else {}
    )
    for h in holdings:
        company = companies.get(h.company_id)
        if company is None or company.current_price is None:
            continue
        total += Decimal(str(h.quantity)) * Decimal(str(company.current_price))
    return total


def _to_response(goal: Goal, current_value: Decimal) -> GoalResponse:
    target = Decimal(str(goal.target_value))
    progress = float(current_value / target * 100) if target > 0 else 0.0
    return GoalResponse(
        id=goal.id,
        label=goal.label,
        target_value=target,
        target_date=goal.target_date,
        achieved_at=goal.achieved_at,
        created_at=goal.created_at,
        current_value=current_value,
        progress_pct=min(progress, 100.0) if goal.achieved_at is not None else progress,
    )


def _mark_achievement(db: Session, goal: Goal, current_value: Decimal) -> None:
    if goal.achieved_at is None and current_value >= Decimal(str(goal.target_value)):
        goal.achieved_at = datetime.now(timezone.utc)
        db.add(goal)


def list_goals(db: Session, user: User, timeline_id: int) -> list[GoalResponse]:
    goals = db.query(Goal).filter_by(user_id=user.id).order_by(Goal.target_date.asc()).all()
    current_value = _current_total_value(db, user, timeline_id)
    dirty = False
    for goal in goals:
        before = goal.achieved_at
        _mark_achievement(db, goal, current_value)
        dirty = dirty or (before is None and goal.achieved_at is not None)
    if dirty:
        db.commit()
    return [_to_response(g, current_value) for g in goals]


def create_goal(db: Session, user: User, timeline_id: int, body: GoalCreateRequest) -> GoalResponse:
    goal = Goal(
        user_id=user.id,
        label=body.label.strip(),
        target_value=float(body.target_value),
        target_date=body.target_date,
    )
    db.add(goal)
    current_value = _current_total_value(db, user, timeline_id)
    db.flush()
    _mark_achievement(db, goal, current_value)
    db.commit()
    return _to_response(goal, current_value)


def _get_owned_goal(db: Session, user: User, goal_id: int) -> Goal:
    goal = db.query(Goal).filter_by(id=goal_id, user_id=user.id).first()
    if goal is None:
        raise NotFoundError("Goal not found")
    return goal


def update_goal(
    db: Session, user: User, timeline_id: int, goal_id: int, body: GoalUpdateRequest
) -> GoalResponse:
    goal = _get_owned_goal(db, user, goal_id)
    if body.label is not None:
        goal.label = body.label.strip()
    if body.target_value is not None:
        goal.target_value = float(body.target_value)
        # A raised target un-achieves nothing (achievement is permanent), but a
        # target change means the achievement check should re-run below.
    if body.target_date is not None:
        goal.target_date = body.target_date
    current_value = _current_total_value(db, user, timeline_id)
    _mark_achievement(db, goal, current_value)
    db.commit()
    return _to_response(goal, current_value)


def delete_goal(db: Session, user: User, goal_id: int) -> None:
    goal = _get_owned_goal(db, user, goal_id)
    db.delete(goal)
    db.commit()
