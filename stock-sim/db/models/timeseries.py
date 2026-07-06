from datetime import date

from sqlalchemy import BigInteger, CheckConstraint, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin


class PriceHistory(Base, TimestampMixin):
    """Section 7.5. In production this becomes a TimescaleDB hypertable
    partitioned on sim_date; a plain Postgres table + index stands in for now."""

    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[float] = mapped_column(Numeric, nullable=False)
    high: Mapped[float] = mapped_column(Numeric, nullable=False)
    low: Mapped[float] = mapped_column(Numeric, nullable=False)
    close: Mapped[float] = mapped_column(Numeric, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False)
    intrinsic_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    order_imbalance: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "company_id", "timeline_id", "sim_date", name="uq_price_history_company_timeline_date"
        ),
    )


class PriceDriverScore(Base, TimestampMixin):
    __tablename__ = "price_driver_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    driver_key: Mapped[str] = mapped_column(String(40), nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    weight: Mapped[float] = mapped_column(Numeric, nullable=False)
    contribution: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "timeline_id",
            "sim_date",
            "driver_key",
            name="uq_price_driver_scores_company_timeline_date_driver",
        ),
    )


class EconomicCycleState(Base, TimestampMixin):
    __tablename__ = "economic_cycle_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    cycle_phase: Mapped[str] = mapped_column(String(20), nullable=False)
    market_factor_return: Mapped[float] = mapped_column(Numeric, nullable=False)
    gdp_growth: Mapped[float] = mapped_column(Numeric, nullable=False)
    interest_rate: Mapped[float] = mapped_column(Numeric, nullable=False)
    market_sentiment: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("timeline_id", "sim_date", name="uq_economic_cycle_states_timeline_date"),
        CheckConstraint(
            "cycle_phase in ('expansion', 'peak', 'contraction', 'trough')",
            name="ck_economic_cycle_states_phase",
        ),
    )
