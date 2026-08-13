"""Durable artifacts owned by the Market Explorer screener workspace."""

from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin

try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON as JSONType


class SavedScreen(Base, TimestampMixin):
    """A versioned, reproducible screener query owned by one user.

    The query is intentionally stored as JSON instead of being decomposed into
    one column per metric.  The metric registry is the compatibility boundary:
    old screens can be interpreted after the registry grows, while the
    calculation version and fingerprint make changes visible to the user.
    """

    __tablename__ = "saved_screens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    query_json: Mapped[dict] = mapped_column(JSONType, nullable=False)
    columns_json: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    sort_json: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    view_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="table")
    timeline_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    as_of_date: Mapped[Optional[date]] = mapped_column(Date)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_saved_screens_user_name"),
        Index("ix_saved_screens_user_updated", "user_id", "updated_at"),
    )
