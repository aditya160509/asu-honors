from datetime import date
from typing import Optional

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin

try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON as JSONType


class MarketEvent(Base, TimestampMixin):
    __tablename__ = "market_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)
    severity_range: Mapped[str] = mapped_column(String(20), nullable=False)
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False)
    effect_profile: Mapped[dict] = mapped_column(JSONType, nullable=False)
    duration_days: Mapped[int] = mapped_column(nullable=False)
    decay_rate: Mapped[float] = mapped_column(Numeric, nullable=False)
    probability_weight: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        CheckConstraint("scope in ('company', 'industry', 'market')", name="ck_market_events_scope"),
    )


class EventInstance(Base, TimestampMixin):
    __tablename__ = "event_instances"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("market_events.id", ondelete="RESTRICT"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    scope_ref: Mapped[int] = mapped_column(nullable=False)
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    resolved_severity: Mapped[float] = mapped_column(Numeric, nullable=False)
    applied_effects: Mapped[dict] = mapped_column(JSONType, nullable=False)
    expires_on: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        CheckConstraint("scope_type in ('company', 'industry', 'market')", name="ck_event_instances_scope_type"),
    )


class NewsTemplate(Base, TimestampMixin):
    __tablename__ = "news_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    template_text: Mapped[str] = mapped_column(String, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False)
    severity_band: Mapped[str] = mapped_column(String(20), nullable=False)
    linked_event_category: Mapped[str] = mapped_column(String(60), nullable=False)
    linked_driver: Mapped[str] = mapped_column(String(40), nullable=False)


class NewsFeed(Base, TimestampMixin):
    __tablename__ = "news_feed"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    company_id: Mapped[Optional[int]] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    industry_id: Mapped[Optional[int]] = mapped_column(ForeignKey("industries.id", ondelete="CASCADE"))
    headline: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False)
    severity: Mapped[float] = mapped_column(Numeric, nullable=False)
    source_event_instance_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("event_instances.id", ondelete="SET NULL")
    )

    __table_args__ = (
        CheckConstraint(
            "company_id is not null or industry_id is not null",
            name="ck_news_feed_target_exists"
        ),
    )
