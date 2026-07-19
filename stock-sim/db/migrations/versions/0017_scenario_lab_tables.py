"""scenario_templates, timeline_overrides, industry_cross_effects, audit_log

Core Future Lab tables (Section 11 of the spec):
- scenario_templates: the named, admin-editable scenario library (11.4).
- timeline_overrides: queryable/diffable per-branch overrides (11.2/11.5).
  target_type is deliberately restricted to factor_score/config/event/
  cycle_transition/driver_bias -- there is no bare "driver" pin type,
  since the 7 tick-loop drivers are recomputed every tick from live
  inputs (see engine/overrides.py::apply_driver_bias for how a driver
  override is actually realized, as an additive bias rather than a pin).
- industry_cross_effects: cross-sector shock propagation (11.10), e.g.
  a Commodity Spike in Energy rippling into Automobiles' input costs.
- audit_log: records promotion/fork/delete actions (11.6).

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scenario_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("effect_profile", sa.JSON(), nullable=False),
        sa.Column("default_duration_days", sa.Integer(), nullable=True),
        sa.Column("editable_params", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "category in ('macro', 'sector', 'company', 'liquidity')",
            name="ck_scenario_templates_category",
        ),
    )

    op.create_table(
        "timeline_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_key", sa.String(80), nullable=False),
        sa.Column("target_scope_id", sa.Integer(), nullable=True),
        sa.Column("override_value", sa.String(), nullable=False),
        sa.Column("effective_from_sim_date", sa.Date(), nullable=False),
        sa.Column("effective_to_sim_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "target_type in ('factor_score', 'config', 'event', 'cycle_transition', 'driver_bias')",
            name="ck_timeline_overrides_target_type",
        ),
    )
    op.create_index(
        "ix_timeline_overrides_timeline_effective",
        "timeline_overrides",
        ["timeline_id", "effective_from_sim_date"],
    )

    op.create_table(
        "industry_cross_effects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_industry_id", sa.Integer(), sa.ForeignKey("industries.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "affected_industry_id", sa.Integer(), sa.ForeignKey("industries.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("sensitivity", sa.Numeric(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "source_industry_id", "affected_industry_id", name="uq_industry_cross_effects_pair"
        ),
        sa.CheckConstraint("sensitivity >= 0 and sensitivity <= 1", name="ck_industry_cross_effects_sensitivity"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("before_value", sa.JSON(), nullable=True),
        sa.Column("after_value", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "action in ('promote_config', 'promote_baseline', 'fork_league', 'delete_timeline', 'create_timeline')",
            name="ck_audit_log_action",
        ),
    )
    op.create_index("ix_audit_log_timeline_id", "audit_log", ["timeline_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_timeline_id", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("industry_cross_effects")
    op.drop_index("ix_timeline_overrides_timeline_effective", table_name="timeline_overrides")
    op.drop_table("timeline_overrides")
    op.drop_table("scenario_templates")
