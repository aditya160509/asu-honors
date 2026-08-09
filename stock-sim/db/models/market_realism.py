"""Persistence models for market-realism state and replay evidence."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin

try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType
except ImportError:  # pragma: no cover - SQLite test fallback
    from sqlalchemy import JSON as JSONType


class SimulationProfile(Base, TimestampMixin):
    """Immutable-by-version realism configuration for one timeline."""

    __tablename__ = "simulation_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False, unique=True)
    preset: Mapped[str] = mapped_column(String(30), nullable=False, default="realistic")
    timezone_name: Mapped[str] = mapped_column(String(80), nullable=False, default="America/New_York")
    micro_ticks_per_session: Mapped[int] = mapped_column(Integer, nullable=False, default=78)
    seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    parameters: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint(
            "preset in ('educational', 'realistic', 'institutional', 'crisis')",
            name="ck_simulation_profiles_preset",
        ),
        CheckConstraint("micro_ticks_per_session > 0", name="ck_simulation_profiles_tick_count"),
    )


class TimelineCompanyState(Base, TimestampMixin):
    """Timeline-local listing, share-count, and evolving-fundamental state."""

    __tablename__ = "timeline_company_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    shares_outstanding: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_listed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fundamental_state: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    last_action_date: Mapped[Optional[date]] = mapped_column(Date)

    __table_args__ = (
        UniqueConstraint("timeline_id", "company_id", name="uq_timeline_company_state_identity"),
        Index("ix_timeline_company_state_timeline", "timeline_id", "company_id"),
    )


class MarketSessionState(Base, TimestampMixin):
    """One regular session state row per timeline and simulation date."""

    __tablename__ = "market_session_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default="closed")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    session_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    session_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_tick: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_ticks: Mapped[int] = mapped_column(Integer, nullable=False, default=78)
    opening_auction_price: Mapped[Optional[float]] = mapped_column(Numeric)
    closing_auction_price: Mapped[Optional[float]] = mapped_column(Numeric)
    halt_reason: Mapped[Optional[str]] = mapped_column(String(30))
    halt_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    volatility_pause_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("timeline_id", "sim_date", name="uq_market_session_timeline_date"),
        CheckConstraint(
            "phase in ('closed', 'pre_market', 'open_auction', 'open', 'close_auction', 'after_hours')",
            name="ck_market_session_phase",
        ),
        CheckConstraint("status in ('scheduled', 'open', 'halted', 'closed')", name="ck_market_session_status"),
        Index("ix_market_session_timeline_date", "timeline_id", "sim_date"),
    )


class MarketMicroTick(Base, TimestampMixin):
    """Append-only quote and micro-tick observation."""

    __tablename__ = "market_micro_ticks"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    tick_index: Mapped[int] = mapped_column(Integer, nullable=False)
    tick_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    phase: Mapped[str] = mapped_column(String(20), nullable=False)
    mid_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    bid_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    ask_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    spread_bps: Mapped[float] = mapped_column(Numeric, nullable=False)
    bid_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ask_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    order_imbalance: Mapped[float] = mapped_column(Numeric, nullable=False, default=0.0)
    slippage_bps: Mapped[float] = mapped_column(Numeric, nullable=False, default=0.0)
    regime: Mapped[str] = mapped_column(String(30), nullable=False, default="sideways")
    is_halted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    halt_reason: Mapped[Optional[str]] = mapped_column(String(30))
    deterministic_seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    depth: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint(
            "timeline_id", "company_id", "sim_date", "tick_index",
            name="uq_market_micro_ticks_identity",
        ),
        CheckConstraint("phase in ('closed', 'pre_market', 'open_auction', 'open', 'close_auction', 'after_hours')", name="ck_micro_tick_phase"),
        CheckConstraint("regime in ('bull', 'bear', 'sideways', 'high_volatility', 'crisis')", name="ck_micro_tick_regime"),
        Index("ix_micro_ticks_timeline_date", "timeline_id", "sim_date", "tick_index"),
        Index("ix_micro_ticks_company_date", "company_id", "timeline_id", "sim_date"),
    )


class MarketRegimeState(Base, TimestampMixin):
    """Daily regime classification and the features that explain it."""

    __tablename__ = "market_regime_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    regime: Mapped[str] = mapped_column(String(30), nullable=False)
    realized_volatility: Mapped[float] = mapped_column(Numeric, nullable=False)
    market_return: Mapped[float] = mapped_column(Numeric, nullable=False)
    breadth: Mapped[float] = mapped_column(Numeric, nullable=False)
    liquidity_index: Mapped[float] = mapped_column(Numeric, nullable=False)
    drawdown: Mapped[float] = mapped_column(Numeric, nullable=False)
    sector_leadership: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("timeline_id", "sim_date", name="uq_market_regime_timeline_date"),
        CheckConstraint("regime in ('bull', 'bear', 'sideways', 'high_volatility', 'crisis')", name="ck_market_regime_value"),
        Index("ix_market_regime_timeline_date", "timeline_id", "sim_date"),
    )


class InstitutionalFlow(Base, TimestampMixin):
    """Deterministic flow observation used by pricing and explainability."""

    __tablename__ = "institutional_flows"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    tick_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    institutional_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    insider_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    retail_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    net_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    insider_signal: Mapped[str] = mapped_column(String(20), nullable=False, default="neutral")

    __table_args__ = (
        UniqueConstraint(
            "timeline_id", "company_id", "sim_date", "tick_index",
            name="uq_institutional_flows_identity",
        ),
        CheckConstraint("insider_signal in ('accumulation', 'distribution', 'neutral')", name="ck_institutional_flow_signal"),
        Index("ix_institutional_flows_timeline_date", "timeline_id", "sim_date"),
    )


class EconomicCalendarEvent(Base, TimestampMixin):
    """Scheduled macro release with consensus, actual, and surprise values."""

    __tablename__ = "economic_calendar_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    consensus_value: Mapped[Optional[float]] = mapped_column(Numeric)
    actual_value: Mapped[Optional[float]] = mapped_column(Numeric)
    importance: Mapped[float] = mapped_column(Numeric, nullable=False, default=1.0)
    surprise: Mapped[Optional[float]] = mapped_column(Numeric)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="simulation")
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (
        CheckConstraint("event_type in ('interest_rate', 'inflation', 'employment', 'gdp')", name="ck_economic_event_type"),
        CheckConstraint("status in ('scheduled', 'released', 'applied', 'cancelled')", name="ck_economic_event_status"),
        Index("ix_economic_calendar_timeline_date", "timeline_id", "scheduled_date"),
    )


class MarketNewsBulletin(Base, TimestampMixin):
    """Timeline-level news for macro, liquidity, and market-wide shocks."""

    __tablename__ = "market_news_bulletins"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    headline: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False)
    severity: Mapped[float] = mapped_column(Numeric, nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="simulation")
    source_event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("economic_calendar_events.id", ondelete="SET NULL"))
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (
        Index("ix_market_news_bulletins_timeline_date", "timeline_id", "sim_date"),
    )


class CorporateAction(Base, TimestampMixin):
    """Scheduled dividend, split, buyback, merger, IPO, or delisting."""

    __tablename__ = "corporate_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    target_company_id: Mapped[Optional[int]] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"))
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    announced_date: Mapped[date] = mapped_column(Date, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    ratio: Mapped[float] = mapped_column(Numeric, nullable=False, default=1.0)
    cash_per_share: Mapped[float] = mapped_column(Numeric, nullable=False, default=0.0)
    settlement_price: Mapped[Optional[float]] = mapped_column(Numeric)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="simulation")
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (
        CheckConstraint("action_type in ('dividend', 'split', 'buyback', 'merger', 'ipo', 'delisting')", name="ck_corporate_action_type"),
        CheckConstraint("status in ('scheduled', 'applied', 'cancelled')", name="ck_corporate_action_status"),
        Index("ix_corporate_actions_timeline_date", "timeline_id", "effective_date"),
        Index("ix_corporate_actions_company_date", "company_id", "effective_date"),
    )


class ReplayLedger(Base, TimestampMixin):
    """Canonical record of generated decisions and their RNG namespace."""

    __tablename__ = "replay_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    sim_date: Mapped[date] = mapped_column(Date, nullable=False)
    tick_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(30))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    deterministic_seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("timeline_id", "sim_date", "tick_index", "sequence", name="uq_replay_ledger_sequence"),
        Index("ix_replay_ledger_timeline_date", "timeline_id", "sim_date", "tick_index"),
        Index("ix_replay_ledger_fingerprint", "fingerprint"),
    )
