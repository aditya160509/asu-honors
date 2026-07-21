"""Notifications (Section 12/23) -- the `notifications` table has existed
since 0001_initial_schema.py but never had a writer (the frontend's
RecentActivity bell fell back to a client-only session activity log with an
explicit "there is no notifications backend" comment). This module is that
writer, covering three trigger sources:

- Future Lab branch ready/failed (hooked into branch_service.extend_timeline's
  callers -- see notify_branch_ready/notify_branch_failed).
- Price alerts: a user-set target price per (company, timeline), evaluated
  once per advance_simulation/extend_timeline call -- see
  evaluate_price_alerts.
- Watchlist movers: a company on a user's watchlist moving past a day-over-day
  % threshold, evaluated on the same cadence -- see evaluate_watchlist_movers.

Both evaluators run "once per advance, not every intermediate tick of a
multi-day advance," the same cadence trade_service.check_and_fill_limit_orders
already established for checking against the end-of-advance price only.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.ws_manager import publish_user_event
from db.models import Company, Notification, PriceAlert, SimulationState, Timeline, Watchlist
from db.timeline_resolver import get_latest_price, get_latest_two_closes

VALID_NOTIFICATION_TYPES = frozenset({
    "branch_ready", "branch_failed", "price_alert", "watchlist_mover",
})
VALID_DIRECTIONS = frozenset({"above", "below"})

# Day-over-day move (as a fraction, e.g. 0.05 == 5%) that triggers a watchlist
# mover notification. Not yet exposed as a per-user/per-config setting -- a
# single fixed threshold is enough for v1; see ConfigParameter (Section 7.2)
# if this needs to become tunable later.
WATCHLIST_MOVE_THRESHOLD_PCT = Decimal("0.05")


def _current_sim_date(db: Session, timeline_id: int) -> date:
    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    return sim_state.current_sim_date if sim_state is not None else date.today()


def create_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    payload: dict[str, Any],
    sim_date: date,
) -> Notification:
    if notification_type not in VALID_NOTIFICATION_TYPES:
        raise ValueError(f"Unknown notification_type '{notification_type}'")
    entry = Notification(
        user_id=user_id,
        notification_type=notification_type,
        payload=payload,
        sim_date=sim_date,
    )
    db.add(entry)
    db.flush()
    # Best-effort live push (apps/api/routers/ws.py) fired at flush time, not
    # after the caller's eventual commit -- fine for the two branch-status
    # call sites (notify_branch_ready/notify_branch_failed), which always
    # commit shortly after in the same request. Evaluate_price_alerts/
    # evaluate_watchlist_movers run inside extend_timeline's try block, so a
    # (very unlikely) failure partway through either loop could push a
    # notification whose row then gets rolled back by the caller's except
    # handler -- an acceptable gap for a latency optimization whose source of
    # truth is still polling, not a correctness-critical path.
    publish_user_event(user_id, "notification", {"id": entry.id, "notification_type": notification_type})
    return entry


def list_notifications(
    db: Session, user_id: int, unread_only: bool = False, limit: int = 50
) -> list[Notification]:
    query = db.query(Notification).filter_by(user_id=user_id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


def count_unread(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter_by(user_id=user_id)
        .filter(Notification.read_at.is_(None))
        .count()
    )


def mark_read(db: Session, notification_id: int, user_id: int) -> Notification:
    entry = db.query(Notification).filter_by(id=notification_id, user_id=user_id).first()
    if entry is None:
        raise NotFoundError(f"Notification {notification_id} not found")
    if entry.read_at is None:
        entry.read_at = datetime.now(timezone.utc)
        db.flush()
    return entry


def mark_all_read(db: Session, user_id: int) -> int:
    unread = (
        db.query(Notification)
        .filter_by(user_id=user_id)
        .filter(Notification.read_at.is_(None))
        .all()
    )
    now = datetime.now(timezone.utc)
    for entry in unread:
        entry.read_at = now
    db.flush()
    return len(unread)


def notify_branch_ready(db: Session, timeline: Timeline) -> Optional[Notification]:
    """Called by every path that flips a timeline to status='ready' after a
    fast-forward (the sync /extend router, and tasks.run_fast_forward_job's
    success path). No-op if the branch has no owner (shouldn't happen for a
    user-created branch, but the live/seed timeline has owner_user_id=None)."""
    if timeline.owner_user_id is None:
        return None
    return create_notification(
        db,
        user_id=timeline.owner_user_id,
        notification_type="branch_ready",
        payload={"timeline_id": timeline.id, "timeline_name": timeline.name},
        sim_date=_current_sim_date(db, timeline.id),
    )


def notify_branch_failed(db: Session, timeline: Timeline, error: str) -> Optional[Notification]:
    """Called by every path that flips a timeline to status='failed' -- the
    sync /extend router's except-block, tasks.run_fast_forward_job's except-
    block, and create_timeline's no-Celery-worker-available branch."""
    if timeline.owner_user_id is None:
        return None
    return create_notification(
        db,
        user_id=timeline.owner_user_id,
        notification_type="branch_failed",
        payload={"timeline_id": timeline.id, "timeline_name": timeline.name, "error": error},
        sim_date=_current_sim_date(db, timeline.id),
    )


def create_price_alert(
    db: Session, user_id: int, company_id: int, timeline_id: int, target_price: Decimal, direction: str,
) -> PriceAlert:
    if direction not in VALID_DIRECTIONS:
        raise ConflictError(f"direction must be 'above' or 'below', got '{direction}'")
    if target_price <= 0:
        raise ConflictError("target_price must be > 0")
    company = db.query(Company).filter_by(id=company_id).first()
    if company is None:
        raise NotFoundError(f"Company {company_id} not found")
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")

    alert = PriceAlert(
        user_id=user_id, company_id=company_id, timeline_id=timeline_id,
        target_price=target_price, direction=direction,
    )
    db.add(alert)
    db.flush()
    return alert


def list_price_alerts(
    db: Session, user_id: int, timeline_id: Optional[int] = None, active_only: bool = True,
) -> list[PriceAlert]:
    query = db.query(PriceAlert).filter_by(user_id=user_id)
    if timeline_id is not None:
        query = query.filter_by(timeline_id=timeline_id)
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(PriceAlert.created_at.desc()).all()


def delete_price_alert(db: Session, alert_id: int, user_id: int) -> None:
    alert = db.query(PriceAlert).filter_by(id=alert_id, user_id=user_id).first()
    if alert is None:
        raise NotFoundError(f"Price alert {alert_id} not found")
    db.delete(alert)
    db.flush()


def evaluate_price_alerts(db: Session, timeline_id: int) -> list[Notification]:
    """Check every active PriceAlert on this timeline against the current
    (end-of-advance) price. One-shot: an alert that fires deactivates itself
    (is_active=False, triggered_at set) rather than re-firing every
    subsequent tick the price stays past the target."""
    sim_date = _current_sim_date(db, timeline_id)
    alerts = db.query(PriceAlert).filter_by(timeline_id=timeline_id, is_active=True).all()
    created: list[Notification] = []
    for alert in alerts:
        current_price = get_latest_price(db, alert.company_id, timeline_id)
        if current_price is None:
            continue
        target = Decimal(str(alert.target_price))
        crossed = (
            (alert.direction == "above" and current_price >= target)
            or (alert.direction == "below" and current_price <= target)
        )
        if not crossed:
            continue

        company = db.query(Company).filter_by(id=alert.company_id).first()
        alert.is_active = False
        alert.triggered_at = datetime.now(timezone.utc)
        notification = create_notification(
            db,
            user_id=alert.user_id,
            notification_type="price_alert",
            payload={
                "company_id": alert.company_id,
                "ticker": company.ticker if company is not None else None,
                "timeline_id": timeline_id,
                "target_price": str(target),
                "direction": alert.direction,
                "current_price": str(current_price),
            },
            sim_date=sim_date,
        )
        created.append(notification)
    return created


def evaluate_watchlist_movers(
    db: Session, timeline_id: int, threshold_pct: Decimal = WATCHLIST_MOVE_THRESHOLD_PCT,
) -> list[Notification]:
    """Check every distinct (user, company) pair on a watchlist against this
    timeline's day-over-day close. Fires at most once per advance call per
    pair -- there's no separate "already notified today" guard because this
    only ever runs once per advance (see module docstring), so a single day's
    move can only be evaluated once regardless of how many days the caller
    advanced by."""
    sim_date = _current_sim_date(db, timeline_id)
    pairs = (
        db.query(Watchlist.user_id, Watchlist.company_id)
        .distinct()
        .all()
    )
    created: list[Notification] = []
    for user_id, company_id in pairs:
        latest, prior = get_latest_two_closes(db, company_id, timeline_id)
        if latest is None or prior is None or prior == 0:
            continue
        pct_change = (latest - prior) / prior
        if abs(pct_change) < threshold_pct:
            continue

        company = db.query(Company).filter_by(id=company_id).first()
        notification = create_notification(
            db,
            user_id=user_id,
            notification_type="watchlist_mover",
            payload={
                "company_id": company_id,
                "ticker": company.ticker if company is not None else None,
                "timeline_id": timeline_id,
                "prior_close": str(prior),
                "latest_close": str(latest),
                "pct_change": str(pct_change),
            },
            sim_date=sim_date,
        )
        created.append(notification)
    return created
