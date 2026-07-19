"""Future Lab (Section 11.6) — audit_log accountability for promotion/fork/
delete actions. Every write here is a plain, synchronous insert; callers are
responsible for committing alongside the action being audited."""

from typing import Any, Optional

from sqlalchemy.orm import Session

from db.models import AuditLog

VALID_ACTIONS = frozenset({
    "promote_config", "promote_baseline", "fork_league", "delete_timeline", "create_timeline",
})


def record(
    db: Session,
    actor_user_id: Optional[int],
    action: str,
    timeline_id: Optional[int] = None,
    before_value: Optional[dict[str, Any]] = None,
    after_value: Optional[dict[str, Any]] = None,
) -> AuditLog:
    if action not in VALID_ACTIONS:
        raise ValueError(f"Unknown audit action '{action}'")
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        timeline_id=timeline_id,
        before_value=before_value,
        after_value=after_value,
    )
    db.add(entry)
    db.flush()
    return entry


def list_for_timeline(db: Session, timeline_id: Optional[int] = None) -> list[AuditLog]:
    query = db.query(AuditLog)
    if timeline_id is not None:
        query = query.filter_by(timeline_id=timeline_id)
    return query.order_by(AuditLog.created_at.desc()).all()
