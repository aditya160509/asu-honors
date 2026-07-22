from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow


class TimelineGroup(Base, TimestampMixin):
    """Parent record for a sensitivity sweep or Monte Carlo ensemble.

    Child Timelines share this group's id via Timeline.timeline_group_id so
    the whole set counts as one retention/quota unit (Section 11.8) and can
    be listed/aggregated together (GET /sim/timeline-groups/{id}).
    """

    __tablename__ = "timeline_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    primitive: Mapped[str] = mapped_column(String(30), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(200))

    __table_args__ = (
        CheckConstraint(
            "primitive in ('sensitivity_sweep', 'monte_carlo')",
            name="ck_timeline_groups_primitive",
        ),
    )


class Timeline(Base, TimestampMixin):
    __tablename__ = "timelines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_timeline_id: Mapped[Optional[int]] = mapped_column(ForeignKey("timelines.id", ondelete="SET NULL"))
    branch_point_sim_date: Mapped[Optional[date]] = mapped_column(Date)
    owner_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    rng_seed: Mapped[int] = mapped_column(Integer, nullable=False)
    is_live: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Future Lab lifecycle (Section 11) -- all nullable/defaulted so pre-existing
    # (manually created / seeded) timelines remain valid without a value.
    timeline_group_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("timeline_groups.id", ondelete="CASCADE")
    )
    primitive: Mapped[Optional[str]] = mapped_column(String(30))
    sweep_param: Mapped[Optional[str]] = mapped_column(String(80))
    sweep_value: Mapped[Optional[str]] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="ready", nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_touched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "primitive is null or primitive in "
            "('manual', 'structural_override', 'macro_shock', 'sensitivity_sweep', "
            "'monte_carlo', 'liquidity_scenario')",
            name="ck_timelines_primitive",
        ),
        CheckConstraint(
            "status in ('pending', 'running', 'ready', 'failed', 'archived')",
            name="ck_timelines_status",
        ),
        # timeline_groups.primitive only allows sweep/ensemble primitives
        # ('sensitivity_sweep', 'monte_carlo') -- a Timeline that belongs to
        # a group must itself carry one of those two, since nothing else
        # ties the two tables' primitive columns together (no FK-level
        # cross-table check is possible without a trigger). This narrows,
        # rather than fully closes, the drift risk between the two CHECKs.
        CheckConstraint(
            "timeline_group_id is null or primitive in ('sensitivity_sweep', 'monte_carlo')",
            name="ck_timelines_group_primitive_consistency",
        ),
        # Guards against a double-click/retry on the wizard's "Create branch"
        # button producing two indistinguishable branches at the same fork
        # point -- create_branch fully clones MoatSubscore/
        # FinancialQualitySubscore/CompanyFactorScore for each one (real DB
        # writes) and each gets separately fast-forwarded.
        UniqueConstraint(
            "parent_timeline_id", "branch_point_sim_date", "name",
            name="uq_timelines_parent_branch_date_name",
        ),
        Index("ix_timelines_parent_timeline_id", "parent_timeline_id"),
        Index("ix_timelines_timeline_group_id", "timeline_group_id"),
    )


class SimulationState(Base, TimestampMixin):
    __tablename__ = "simulation_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(
        ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    current_sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    tick_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_running: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Future: FK → config_snapshots.id when snapshot table is created
    config_snapshot_id: Mapped[Optional[int]] = mapped_column()
