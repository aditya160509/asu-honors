from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin

try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON as JSONType

# `leaderboard` (Section 7.8) is a materialized view over portfolios/holdings/
# price_history, not an ORM-mapped table. Define it via a raw SQL migration
# (CREATE MATERIALIZED VIEW ...) when the read-model work lands in a later phase.


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False)
    starting_cash: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        CheckConstraint("role in ('user', 'admin')", name="ck_users_role"),
    )


class Portfolio(Base, TimestampMixin):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    cash_balance: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "timeline_id", name="uq_portfolios_user_timeline"),
    )


class Holding(Base, TimestampMixin):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric, nullable=False)
    avg_cost_basis: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("portfolio_id", "company_id", name="uq_holdings_portfolio_company"),
        CheckConstraint("quantity >= 0", name="ck_holdings_quantity_nonnegative"),
    )


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    fees: Mapped[float] = mapped_column(Numeric, nullable=False)
    impact_applied: Mapped[float] = mapped_column(Numeric, nullable=False)
    realized_pnl: Mapped[float | None] = mapped_column(Numeric)

    __table_args__ = (
        CheckConstraint("side in ('buy', 'sell')", name="ck_transactions_side"),
        CheckConstraint("quantity >= 0", name="ck_transactions_quantity_nonnegative"),
    )


class Watchlist(Base, TimestampMixin):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_watchlists_user_company"),
    )


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(60), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
