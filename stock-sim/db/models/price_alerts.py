from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin


class PriceAlert(Base, TimestampMixin):
    """A user-set target price for one company on one timeline. Evaluated
    once per advance_simulation/extend_timeline call (see
    notification_service.evaluate_price_alerts), same "once per advance, not
    every intermediate tick of a multi-day advance" cadence as
    trade_service.check_and_fill_limit_orders. One-shot: deactivates itself
    (is_active=False, triggered_at set) the first time it fires rather than
    re-firing every tick the price stays past the target."""

    __tablename__ = "price_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    target_price: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("direction in ('above', 'below')", name="ck_price_alerts_direction"),
        CheckConstraint("target_price > 0", name="ck_price_alerts_target_positive"),
    )
