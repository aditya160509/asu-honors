from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow


class ScenarioTemplate(Base, TimestampMixin):
    __tablename__ = "scenario_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    effect_profile: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    default_duration_days: Mapped[Optional[int]] = mapped_column(Integer)
    editable_params: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)

    __table_args__ = (
        CheckConstraint(
            "category in ('macro', 'sector', 'company', 'liquidity')",
            name="ck_scenario_templates_category",
        ),
    )


class TimelineOverride(Base, TimestampMixin):
    __tablename__ = "timeline_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_key: Mapped[str] = mapped_column(String(80), nullable=False)
    target_scope_id: Mapped[Optional[int]] = mapped_column(Integer)
    override_value: Mapped[str] = mapped_column(String, nullable=False)
    effective_from_sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to_sim_date: Mapped[Optional[date]] = mapped_column(Date)

    __table_args__ = (
        CheckConstraint(
            "target_type in ('factor_score', 'config', 'event', 'cycle_transition', 'driver_bias')",
            name="ck_timeline_overrides_target_type",
        ),
    )


class IndustryCrossEffect(Base, TimestampMixin):
    __tablename__ = "industry_cross_effects"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_industry_id: Mapped[int] = mapped_column(
        ForeignKey("industries.id", ondelete="CASCADE"), nullable=False
    )
    affected_industry_id: Mapped[int] = mapped_column(
        ForeignKey("industries.id", ondelete="CASCADE"), nullable=False
    )
    sensitivity: Mapped[float] = mapped_column(Numeric, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String)

    __table_args__ = (
        UniqueConstraint("source_industry_id", "affected_industry_id", name="uq_industry_cross_effects_pair"),
        CheckConstraint("sensitivity >= 0 and sensitivity <= 1", name="ck_industry_cross_effects_sensitivity"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    timeline_id: Mapped[Optional[int]] = mapped_column(ForeignKey("timelines.id", ondelete="SET NULL"))
    before_value: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    after_value: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "action in ('promote_config', 'promote_baseline', 'fork_league', 'delete_timeline', 'create_timeline')",
            name="ck_audit_log_action",
        ),
    )
