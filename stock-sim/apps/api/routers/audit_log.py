"""Future Lab (Section 11.6) — audit_log accountability endpoint."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from apps.api.auth import require_admin
from apps.api.database import get_db
from apps.api.schemas import AuditLogEntryResponse
from apps.api.services import audit_service
from db.models import AuditLog, User

router = APIRouter(prefix="/api/v1", tags=["Future Lab"])


@router.get("/audit-log", response_model=list[AuditLogEntryResponse])
def get_audit_log(
    timeline_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[AuditLog]:
    return audit_service.list_for_timeline(db, timeline_id)
