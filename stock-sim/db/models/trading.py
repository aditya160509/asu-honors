from datetime import date, datetime
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
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
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("role in ('user', 'admin')", name="ck_users_role"),
    )


class Portfolio(Base, TimestampMixin):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    cash_balance: Mapped[float] = mapped_column(Numeric, nullable=False)
    total_value: Mapped[float] = mapped_column(Numeric, default=0.0)

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
    realized_pnl: Mapped[Optional[float]] = mapped_column(Numeric)

    __table_args__ = (
        CheckConstraint("side in ('buy', 'sell')", name="ck_transactions_side"),
        CheckConstraint("quantity >= 0", name="ck_transactions_quantity_nonnegative"),
    )


class WatchlistGroup(Base, TimestampMixin):
    """A named watchlist. Every user gets a 'Default' group on first use; the
    legacy flat /watchlist endpoints operate on that default group."""

    __tablename__ = "watchlist_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_watchlist_groups_user_name"),
    )


class Watchlist(Base, TimestampMixin):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("watchlist_groups.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("group_id", "company_id", name="uq_watchlists_group_company"),
    )


class Goal(Base, TimestampMixin):
    """v1 goal type: reach a target portfolio value by a target date. Progress is
    computed at read time; achieved_at is set once and never cleared so an
    achievement survives later portfolio dips."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    target_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    achieved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("target_value > 0", name="ck_goals_target_value_positive"),
    )


class Dividend(Base, TimestampMixin):
    """Company-level dividend schedule (reference data, not user-specific).
    A user's receipts are derived at read time: shares held at ex_date x amount_per_share."""

    __tablename__ = "dividends"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    declared_date: Mapped[date] = mapped_column(Date, nullable=False)
    ex_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_per_share: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "timeline_id", "ex_date", name="uq_dividends_company_timeline_exdate"),
        CheckConstraint("amount_per_share > 0", name="ck_dividends_amount_positive"),
    )


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(60), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
