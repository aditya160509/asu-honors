from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow


class Timeline(Base, TimestampMixin):
    __tablename__ = "timelines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_timeline_id: Mapped[int | None] = mapped_column(ForeignKey("timelines.id", ondelete="SET NULL"))
    branch_point_sim_date: Mapped[date | None] = mapped_column(Date)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    rng_seed: Mapped[int] = mapped_column(Integer, nullable=False)
    is_live: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SimulationState(Base, TimestampMixin):
    __tablename__ = "simulation_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(
        ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    current_sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    tick_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_running: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    config_snapshot_id: Mapped[int | None] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
