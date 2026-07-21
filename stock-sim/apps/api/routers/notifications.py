"""Notifications -- in-app alerts for Future Lab branch status, price
alerts, and watchlist movers (see apps/api/services/notification_service.py).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user
from apps.api.database import get_db
from apps.api.schemas import (
    MarkAllReadResponse,
    NotificationResponse,
    PriceAlertCreateRequest,
    PriceAlertResponse,
)
from apps.api.services import notification_service
from db.models import Notification, PriceAlert, User

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Notification]:
    return notification_service.list_notifications(db, user.id, unread_only=unread_only, limit=limit)


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return {"unread_count": notification_service.count_unread(db, user.id)}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Notification:
    entry = notification_service.mark_read(db, notification_id, user.id)
    db.commit()
    return entry


@router.post("/read-all", response_model=MarkAllReadResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MarkAllReadResponse:
    marked = notification_service.mark_all_read(db, user.id)
    db.commit()
    return MarkAllReadResponse(marked_count=marked)


@router.post("/price-alerts", response_model=PriceAlertResponse, status_code=status.HTTP_201_CREATED)
def create_price_alert(
    request: PriceAlertCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PriceAlert:
    alert = notification_service.create_price_alert(
        db,
        user_id=user.id,
        company_id=request.company_id,
        timeline_id=request.timeline_id,
        target_price=request.target_price,
        direction=request.direction,
    )
    db.commit()
    return alert


@router.get("/price-alerts", response_model=list[PriceAlertResponse])
def list_price_alerts(
    timeline_id: Optional[int] = Query(default=None),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PriceAlert]:
    return notification_service.list_price_alerts(
        db, user.id, timeline_id=timeline_id, active_only=active_only,
    )


@router.delete("/price-alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    notification_service.delete_price_alert(db, alert_id, user.id)
    db.commit()
