"""Persist deterministic market-realism state, events, and replay evidence."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "simulation_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("preset", sa.String(30), nullable=False, server_default="realistic"),
        sa.Column("timezone_name", sa.String(80), nullable=False, server_default="America/New_York"),
        sa.Column("micro_ticks_per_session", sa.Integer(), nullable=False, server_default="78"),
        sa.Column("seed", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("preset in ('educational', 'realistic', 'institutional', 'crisis')", name="ck_simulation_profiles_preset"),
        sa.CheckConstraint("micro_ticks_per_session > 0", name="ck_simulation_profiles_tick_count"),
    )

    op.create_table(
        "timeline_company_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shares_outstanding", sa.BigInteger(), nullable=False),
        sa.Column("is_listed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fundamental_state", sa.JSON(), nullable=False),
        sa.Column("last_action_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", "company_id", name="uq_timeline_company_state_identity"),
    )
    op.create_index("ix_timeline_company_state_timeline", "timeline_company_states", ["timeline_id", "company_id"])

    op.create_table(
        "market_session_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("phase", sa.String(20), nullable=False, server_default="closed"),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("session_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("session_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_tick", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_ticks", sa.Integer(), nullable=False, server_default="78"),
        sa.Column("opening_auction_price", sa.Numeric(), nullable=True),
        sa.Column("closing_auction_price", sa.Numeric(), nullable=True),
        sa.Column("halt_reason", sa.String(30), nullable=True),
        sa.Column("halt_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("volatility_pause_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", "sim_date", name="uq_market_session_timeline_date"),
        sa.CheckConstraint("phase in ('closed', 'pre_market', 'open_auction', 'open', 'close_auction', 'after_hours')", name="ck_market_session_phase"),
        sa.CheckConstraint("status in ('scheduled', 'open', 'halted', 'closed')", name="ck_market_session_status"),
    )
    op.create_index("ix_market_session_timeline_date", "market_session_states", ["timeline_id", "sim_date"])

    op.create_table(
        "market_micro_ticks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("tick_index", sa.Integer(), nullable=False),
        sa.Column("tick_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("phase", sa.String(20), nullable=False),
        sa.Column("mid_price", sa.Numeric(), nullable=False),
        sa.Column("bid_price", sa.Numeric(), nullable=False),
        sa.Column("ask_price", sa.Numeric(), nullable=False),
        sa.Column("spread_bps", sa.Numeric(), nullable=False),
        sa.Column("bid_size", sa.BigInteger(), nullable=False),
        sa.Column("ask_size", sa.BigInteger(), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("order_imbalance", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("slippage_bps", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("regime", sa.String(30), nullable=False, server_default="sideways"),
        sa.Column("is_halted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("halt_reason", sa.String(30), nullable=True),
        sa.Column("deterministic_seed", sa.BigInteger(), nullable=False),
        sa.Column("depth", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", "company_id", "sim_date", "tick_index", name="uq_market_micro_ticks_identity"),
        sa.CheckConstraint("phase in ('closed', 'pre_market', 'open_auction', 'open', 'close_auction', 'after_hours')", name="ck_micro_tick_phase"),
        sa.CheckConstraint("regime in ('bull', 'bear', 'sideways', 'high_volatility', 'crisis')", name="ck_micro_tick_regime"),
    )
    op.create_index("ix_micro_ticks_timeline_date", "market_micro_ticks", ["timeline_id", "sim_date", "tick_index"])
    op.create_index("ix_micro_ticks_company_date", "market_micro_ticks", ["company_id", "timeline_id", "sim_date"])

    op.create_table(
        "market_regime_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("regime", sa.String(30), nullable=False),
        sa.Column("realized_volatility", sa.Numeric(), nullable=False),
        sa.Column("market_return", sa.Numeric(), nullable=False),
        sa.Column("breadth", sa.Numeric(), nullable=False),
        sa.Column("liquidity_index", sa.Numeric(), nullable=False),
        sa.Column("drawdown", sa.Numeric(), nullable=False),
        sa.Column("sector_leadership", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", "sim_date", name="uq_market_regime_timeline_date"),
        sa.CheckConstraint("regime in ('bull', 'bear', 'sideways', 'high_volatility', 'crisis')", name="ck_market_regime_value"),
    )
    op.create_index("ix_market_regime_timeline_date", "market_regime_states", ["timeline_id", "sim_date"])

    op.create_table(
        "institutional_flows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("tick_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("institutional_flow", sa.Numeric(), nullable=False),
        sa.Column("insider_flow", sa.Numeric(), nullable=False),
        sa.Column("retail_flow", sa.Numeric(), nullable=False),
        sa.Column("net_flow", sa.Numeric(), nullable=False),
        sa.Column("insider_signal", sa.String(20), nullable=False, server_default="neutral"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", "company_id", "sim_date", "tick_index", name="uq_institutional_flows_identity"),
        sa.CheckConstraint("insider_signal in ('accumulation', 'distribution', 'neutral')", name="ck_institutional_flow_signal"),
    )
    op.create_index("ix_institutional_flows_timeline_date", "institutional_flows", ["timeline_id", "sim_date"])

    op.create_table(
        "economic_calendar_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consensus_value", sa.Numeric(), nullable=True),
        sa.Column("actual_value", sa.Numeric(), nullable=True),
        sa.Column("importance", sa.Numeric(), nullable=False, server_default="1"),
        sa.Column("surprise", sa.Numeric(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("source", sa.String(80), nullable=False, server_default="simulation"),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("event_type in ('interest_rate', 'inflation', 'employment', 'gdp')", name="ck_economic_event_type"),
        sa.CheckConstraint("status in ('scheduled', 'released', 'applied', 'cancelled')", name="ck_economic_event_status"),
    )
    op.create_index("ix_economic_calendar_timeline_date", "economic_calendar_events", ["timeline_id", "scheduled_date"])

    op.create_table(
        "market_news_bulletins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("headline", sa.String(300), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("sentiment", sa.String(20), nullable=False),
        sa.Column("severity", sa.Numeric(), nullable=False),
        sa.Column("source", sa.String(80), nullable=False, server_default="simulation"),
        sa.Column("source_event_id", sa.Integer(), sa.ForeignKey("economic_calendar_events.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_market_news_bulletins_timeline_date", "market_news_bulletins", ["timeline_id", "sim_date"])

    op.create_table(
        "corporate_actions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_type", sa.String(30), nullable=False),
        sa.Column("announced_date", sa.Date(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("ratio", sa.Numeric(), nullable=False, server_default="1"),
        sa.Column("cash_per_share", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("settlement_price", sa.Numeric(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("source", sa.String(80), nullable=False, server_default="simulation"),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("action_type in ('dividend', 'split', 'buyback', 'merger', 'ipo', 'delisting')", name="ck_corporate_action_type"),
        sa.CheckConstraint("status in ('scheduled', 'applied', 'cancelled')", name="ck_corporate_action_status"),
    )
    op.create_index("ix_corporate_actions_timeline_date", "corporate_actions", ["timeline_id", "effective_date"])
    op.create_index("ix_corporate_actions_company_date", "corporate_actions", ["company_id", "effective_date"])

    op.create_table(
        "replay_ledger",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("tick_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("deterministic_seed", sa.BigInteger(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", "sim_date", "tick_index", "sequence", name="uq_replay_ledger_sequence"),
    )
    op.create_index("ix_replay_ledger_timeline_date", "replay_ledger", ["timeline_id", "sim_date", "tick_index"])
    op.create_index("ix_replay_ledger_fingerprint", "replay_ledger", ["fingerprint"])


def downgrade() -> None:
    op.drop_index("ix_replay_ledger_fingerprint", table_name="replay_ledger")
    op.drop_index("ix_replay_ledger_timeline_date", table_name="replay_ledger")
    op.drop_table("replay_ledger")
    op.drop_index("ix_corporate_actions_company_date", table_name="corporate_actions")
    op.drop_index("ix_corporate_actions_timeline_date", table_name="corporate_actions")
    op.drop_table("corporate_actions")
    op.drop_index("ix_market_news_bulletins_timeline_date", table_name="market_news_bulletins")
    op.drop_table("market_news_bulletins")
    op.drop_index("ix_economic_calendar_timeline_date", table_name="economic_calendar_events")
    op.drop_table("economic_calendar_events")
    op.drop_index("ix_institutional_flows_timeline_date", table_name="institutional_flows")
    op.drop_table("institutional_flows")
    op.drop_index("ix_market_regime_timeline_date", table_name="market_regime_states")
    op.drop_table("market_regime_states")
    op.drop_index("ix_micro_ticks_company_date", table_name="market_micro_ticks")
    op.drop_index("ix_micro_ticks_timeline_date", table_name="market_micro_ticks")
    op.drop_table("market_micro_ticks")
    op.drop_index("ix_market_session_timeline_date", table_name="market_session_states")
    op.drop_table("market_session_states")
    op.drop_index("ix_timeline_company_state_timeline", table_name="timeline_company_states")
    op.drop_table("timeline_company_states")
    op.drop_table("simulation_profiles")
