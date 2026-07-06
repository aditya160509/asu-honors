"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "industries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String()),
        sa.Column("baseline_pe", sa.Numeric(), nullable=False),
        sa.Column("pe_min", sa.Numeric(), nullable=False),
        sa.Column("pe_max", sa.Numeric(), nullable=False),
        sa.Column("base_volatility", sa.Numeric(), nullable=False),
        sa.Column("cycle_sensitivity", sa.Numeric(), nullable=False),
        sa.Column("sector_beta_default", sa.Numeric(), nullable=False),
        sa.Column("subfactor_set", sa.String(20), nullable=False, server_default="standard"),
        *_timestamps(),
        sa.CheckConstraint("pe_min <= pe_max", name="ck_industries_pe_bounds"),
        sa.CheckConstraint("subfactor_set in ('standard', 'financials')", name="ck_industries_subfactor_set"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("starting_cash", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("role in ('user', 'admin')", name="ck_users_role"),
    )

    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(16), nullable=False),
        sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("logo_url", sa.String()),
        sa.Column("description", sa.String()),
        sa.Column("shares_outstanding", sa.BigInteger(), nullable=False),
        sa.Column("free_float_pct", sa.Numeric(), nullable=False),
        sa.Column("beta_market", sa.Numeric(), nullable=False),
        sa.Column("beta_sector", sa.Numeric(), nullable=False),
        sa.Column("current_price", sa.Numeric()),
        sa.Column("intrinsic_value", sa.Numeric()),
        sa.Column("intrinsic_score", sa.Numeric()),
        sa.Column("fair_pe", sa.Numeric()),
        sa.Column("market_cap", sa.Numeric()),
        sa.Column("volatility", sa.Numeric()),
        sa.Column("market_liquidity_score", sa.Numeric()),
        *_timestamps(),
        sa.UniqueConstraint("ticker", name="uq_companies_ticker"),
        sa.CheckConstraint("free_float_pct >= 0 and free_float_pct <= 1", name="ck_companies_free_float_pct"),
        sa.CheckConstraint(
            "intrinsic_score is null or (intrinsic_score >= 0 and intrinsic_score <= 100)",
            name="ck_companies_intrinsic_score_range",
        ),
    )

    op.create_table(
        "factor_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("factor_type", sa.String(20), nullable=False),
        sa.Column("pillar", sa.String(40)),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("formula_ref", sa.String(80), nullable=False),
        sa.Column("default_weight", sa.Numeric()),
        sa.Column("value_range", sa.String(20)),
        *_timestamps(),
        sa.UniqueConstraint("key", name="uq_factor_definitions_key"),
        sa.CheckConstraint(
            "factor_type in ('intrinsic_top', 'moat_sub', 'fq_sub', 'price_driver')",
            name="ck_factor_definitions_factor_type",
        ),
        sa.CheckConstraint(
            "direction in ('higher_better', 'lower_better', 'mid_band')",
            name="ck_factor_definitions_direction",
        ),
    )

    op.create_table(
        "industry_pillar_weights",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pillar", sa.String(40), nullable=False),
        sa.Column("weight", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("industry_id", "pillar", name="uq_industry_pillar_weights_industry_pillar"),
        sa.CheckConstraint("weight >= 0 and weight <= 1", name="ck_industry_pillar_weights_weight_range"),
    )

    op.create_table(
        "industry_factor_weights",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("factor_key", sa.String(80), nullable=False),
        sa.Column("weight", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("industry_id", "factor_key", name="uq_industry_factor_weights_industry_factor"),
        sa.CheckConstraint("weight >= 0 and weight <= 1", name="ck_industry_factor_weights_weight_range"),
    )

    op.create_table(
        "config_parameters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False, server_default="global"),
        sa.Column("scope_id", sa.Integer()),
        sa.Column("description", sa.String()),
        *_timestamps(),
        sa.UniqueConstraint("key", "scope", "scope_id", name="uq_config_parameters_key_scope"),
        sa.CheckConstraint("scope in ('global', 'industry', 'company')", name="ck_config_parameters_scope"),
    )

    op.create_table(
        "company_factor_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_period", sa.String(10), nullable=False),
        sa.Column("management_quality", sa.Numeric(), nullable=False),
        sa.Column("moat_score", sa.Numeric(), nullable=False),
        sa.Column("financial_quality", sa.Numeric(), nullable=False),
        sa.Column("fcf_quality", sa.Numeric(), nullable=False),
        sa.Column("growth_potential", sa.Numeric(), nullable=False),
        sa.Column("intrinsic_score", sa.Numeric(), nullable=False),
        sa.Column("fair_pe", sa.Numeric(), nullable=False),
        sa.Column("intrinsic_value", sa.Numeric(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "fiscal_period", name="uq_company_factor_scores_company_period"),
        sa.CheckConstraint("management_quality >= 0 and management_quality <= 100", name="ck_cfs_management_quality_range"),
        sa.CheckConstraint("moat_score >= 0 and moat_score <= 100", name="ck_cfs_moat_score_range"),
        sa.CheckConstraint("financial_quality >= 0 and financial_quality <= 100", name="ck_cfs_financial_quality_range"),
        sa.CheckConstraint("fcf_quality >= 0 and fcf_quality <= 100", name="ck_cfs_fcf_quality_range"),
        sa.CheckConstraint("growth_potential >= 0 and growth_potential <= 100", name="ck_cfs_growth_potential_range"),
        sa.CheckConstraint("intrinsic_score >= 0 and intrinsic_score <= 100", name="ck_cfs_intrinsic_score_range"),
    )

    op.create_table(
        "moat_subscores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subfactor_key", sa.String(80), nullable=False),
        sa.Column("score", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "subfactor_key", name="uq_moat_subscores_company_subfactor"),
        sa.CheckConstraint("score >= 0 and score <= 100", name="ck_moat_subscores_score_range"),
    )

    op.create_table(
        "financial_quality_subscores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_period", sa.String(10), nullable=False),
        sa.Column("subfactor_key", sa.String(80), nullable=False),
        sa.Column("raw_metric_value", sa.Numeric(), nullable=False),
        sa.Column("peer_percentile", sa.Numeric(), nullable=False),
        sa.Column("subscore", sa.Numeric(), nullable=False),
        sa.Column("applied_weight", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint(
            "company_id", "fiscal_period", "subfactor_key", name="uq_fq_subscores_company_period_subfactor"
        ),
        sa.CheckConstraint("peer_percentile >= 0 and peer_percentile <= 100", name="ck_fq_subscores_percentile_range"),
        sa.CheckConstraint("subscore >= 0 and subscore <= 100", name="ck_fq_subscores_subscore_range"),
        sa.CheckConstraint("applied_weight >= 0 and applied_weight <= 1", name="ck_fq_subscores_weight_range"),
    )

    op.create_table(
        "income_statements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_period", sa.String(10), nullable=False),
        sa.Column("revenue", sa.Numeric(), nullable=False),
        sa.Column("cogs", sa.Numeric(), nullable=False),
        sa.Column("gross_profit", sa.Numeric(), nullable=False),
        sa.Column("operating_expenses", sa.Numeric(), nullable=False),
        sa.Column("ebitda", sa.Numeric(), nullable=False),
        sa.Column("depreciation_amortization", sa.Numeric(), nullable=False),
        sa.Column("ebit", sa.Numeric(), nullable=False),
        sa.Column("interest_expense", sa.Numeric(), nullable=False),
        sa.Column("pretax_income", sa.Numeric(), nullable=False),
        sa.Column("tax", sa.Numeric(), nullable=False),
        sa.Column("net_profit", sa.Numeric(), nullable=False),
        sa.Column("eps", sa.Numeric(), nullable=False),
        sa.Column("shares_diluted", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "fiscal_period", name="uq_income_statements_company_period"),
    )

    op.create_table(
        "balance_sheets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_period", sa.String(10), nullable=False),
        sa.Column("cash_and_equivalents", sa.Numeric(), nullable=False),
        sa.Column("receivables", sa.Numeric(), nullable=False),
        sa.Column("inventory", sa.Numeric(), nullable=False),
        sa.Column("current_assets", sa.Numeric(), nullable=False),
        sa.Column("ppe", sa.Numeric(), nullable=False),
        sa.Column("intangibles", sa.Numeric(), nullable=False),
        sa.Column("total_assets", sa.Numeric(), nullable=False),
        sa.Column("payables", sa.Numeric(), nullable=False),
        sa.Column("short_term_debt", sa.Numeric(), nullable=False),
        sa.Column("current_liabilities", sa.Numeric(), nullable=False),
        sa.Column("long_term_debt", sa.Numeric(), nullable=False),
        sa.Column("total_debt", sa.Numeric(), nullable=False),
        sa.Column("total_liabilities", sa.Numeric(), nullable=False),
        sa.Column("shareholders_equity", sa.Numeric(), nullable=False),
        sa.Column("invested_capital", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "fiscal_period", name="uq_balance_sheets_company_period"),
    )

    op.create_table(
        "cash_flow_statements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_period", sa.String(10), nullable=False),
        sa.Column("operating_cash_flow", sa.Numeric(), nullable=False),
        sa.Column("capex", sa.Numeric(), nullable=False),
        sa.Column("free_cash_flow", sa.Numeric(), nullable=False),
        sa.Column("investing_cash_flow", sa.Numeric(), nullable=False),
        sa.Column("financing_cash_flow", sa.Numeric(), nullable=False),
        sa.Column("dividends_paid", sa.Numeric(), nullable=False),
        sa.Column("buybacks", sa.Numeric(), nullable=False),
        sa.Column("net_change_in_cash", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "fiscal_period", name="uq_cash_flow_statements_company_period"),
    )

    op.create_table(
        "consensus_estimates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_period", sa.String(10), nullable=False),
        sa.Column("consensus_eps", sa.Numeric(), nullable=False),
        sa.Column("consensus_revenue", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "fiscal_period", name="uq_consensus_estimates_company_period"),
    )

    op.create_table(
        "timelines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("parent_timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="SET NULL")),
        sa.Column("branch_point_sim_date", sa.Date()),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rng_seed", sa.Integer(), nullable=False),
        sa.Column("is_live", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
    )

    op.create_table(
        "simulation_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_sim_date", sa.Date(), nullable=False),
        sa.Column("tick_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_running", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("config_snapshot_id", sa.Integer()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("timeline_id", name="uq_simulation_state_timeline"),
    )

    op.create_table(
        "price_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(), nullable=False),
        sa.Column("high", sa.Numeric(), nullable=False),
        sa.Column("low", sa.Numeric(), nullable=False),
        sa.Column("close", sa.Numeric(), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=False),
        sa.Column("intrinsic_value", sa.Numeric(), nullable=False),
        sa.Column("order_imbalance", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("company_id", "timeline_id", "sim_date", name="uq_price_history_company_timeline_date"),
    )
    op.create_index(
        "ix_price_history_timeline_date", "price_history", ["timeline_id", "sim_date"]
    )

    op.create_table(
        "price_driver_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("driver_key", sa.String(40), nullable=False),
        sa.Column("value", sa.Numeric(), nullable=False),
        sa.Column("weight", sa.Numeric(), nullable=False),
        sa.Column("contribution", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint(
            "company_id", "timeline_id", "sim_date", "driver_key",
            name="uq_price_driver_scores_company_timeline_date_driver",
        ),
    )

    op.create_table(
        "economic_cycle_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("cycle_phase", sa.String(20), nullable=False),
        sa.Column("market_factor_return", sa.Numeric(), nullable=False),
        sa.Column("gdp_growth", sa.Numeric(), nullable=False),
        sa.Column("interest_rate", sa.Numeric(), nullable=False),
        sa.Column("market_sentiment", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("timeline_id", "sim_date", name="uq_economic_cycle_states_timeline_date"),
        sa.CheckConstraint(
            "cycle_phase in ('expansion', 'peak', 'contraction', 'trough')",
            name="ck_economic_cycle_states_phase",
        ),
    )

    op.create_table(
        "market_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("severity_range", sa.String(20), nullable=False),
        sa.Column("sentiment", sa.String(20), nullable=False),
        sa.Column("effect_profile", postgresql.JSONB(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("decay_rate", sa.Numeric(), nullable=False),
        sa.Column("probability_weight", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("scope in ('company', 'industry', 'market')", name="ck_market_events_scope"),
    )

    op.create_table(
        "event_instances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("market_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_ref", sa.Integer(), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("resolved_severity", sa.Numeric(), nullable=False),
        sa.Column("applied_effects", postgresql.JSONB(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=False),
        *_timestamps(),
    )

    op.create_table(
        "news_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("template_text", sa.String(), nullable=False),
        sa.Column("sentiment", sa.String(20), nullable=False),
        sa.Column("severity_band", sa.String(20), nullable=False),
        sa.Column("linked_event_category", sa.String(60), nullable=False),
        sa.Column("linked_driver", sa.String(40), nullable=False),
        *_timestamps(),
    )

    op.create_table(
        "news_feed",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE")),
        sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id", ondelete="CASCADE")),
        sa.Column("headline", sa.String(300), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("sentiment", sa.String(20), nullable=False),
        sa.Column("severity", sa.Numeric(), nullable=False),
        sa.Column(
            "source_event_instance_id", sa.Integer(), sa.ForeignKey("event_instances.id", ondelete="SET NULL")
        ),
        *_timestamps(),
    )

    op.create_table(
        "portfolios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cash_balance", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("user_id", "timeline_id", name="uq_portfolios_user_timeline"),
    )

    op.create_table(
        "holdings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("avg_cost_basis", sa.Numeric(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("portfolio_id", "company_id", name="uq_holdings_portfolio_company"),
        sa.CheckConstraint("quantity >= 0", name="ck_holdings_quantity_nonnegative"),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("price", sa.Numeric(), nullable=False),
        sa.Column("fees", sa.Numeric(), nullable=False),
        sa.Column("impact_applied", sa.Numeric(), nullable=False),
        sa.Column("realized_pnl", sa.Numeric()),
        *_timestamps(),
        sa.CheckConstraint("side in ('buy', 'sell')", name="ck_transactions_side"),
        sa.CheckConstraint("quantity >= 0", name="ck_transactions_quantity_nonnegative"),
    )

    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("user_id", "company_id", name="uq_watchlists_user_company"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        *_timestamps(),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("watchlists")
    op.drop_table("transactions")
    op.drop_table("holdings")
    op.drop_table("portfolios")
    op.drop_table("news_feed")
    op.drop_table("news_templates")
    op.drop_table("event_instances")
    op.drop_table("market_events")
    op.drop_table("economic_cycle_states")
    op.drop_table("price_driver_scores")
    op.drop_index("ix_price_history_timeline_date", table_name="price_history")
    op.drop_table("price_history")
    op.drop_table("simulation_state")
    op.drop_table("timelines")
    op.drop_table("consensus_estimates")
    op.drop_table("cash_flow_statements")
    op.drop_table("balance_sheets")
    op.drop_table("income_statements")
    op.drop_table("financial_quality_subscores")
    op.drop_table("moat_subscores")
    op.drop_table("company_factor_scores")
    op.drop_table("config_parameters")
    op.drop_table("industry_factor_weights")
    op.drop_table("industry_pillar_weights")
    op.drop_table("factor_definitions")
    op.drop_table("companies")
    op.drop_table("users")
    op.drop_table("industries")
