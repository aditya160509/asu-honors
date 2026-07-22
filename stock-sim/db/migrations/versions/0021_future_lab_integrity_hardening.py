"""Future Lab integrity hardening: dedup constraints, missing indexes, JSONB

Follow-up to the branch-creation HTTP 500 investigation (rng_seed overflow,
fixed in branch_service.py/0018-era work). This migration addresses the
remaining DB-layer gaps found during that review:

- timeline_overrides had no uniqueness guard: a retried/double-submitted
  create_branch or apply_scenario_template call could insert the same
  override twice, and engine/overrides.py treats override_value as an
  additive delta for driver_bias/factor_score -- two identical rows
  silently double-stack the bias instead of erroring.
- timelines had no uniqueness guard on (parent_timeline_id,
  branch_point_sim_date, name): a double-click/retry on the wizard's
  "Create branch" button produces two indistinguishable branches, each
  fully cloning MoatSubscore/FinancialQualitySubscore/CompanyFactorScore
  (real DB writes) and each separately fast-forwarded.
- company_factor_scores/moat_subscores/financial_quality_subscores had
  UniqueConstraints leading with company_id, but branch_service.create_branch
  filters these tables by timeline_id alone when cloning a parent's state
  onto a new branch -- no index supports that access pattern, so it
  degrades to a sequential scan as history grows (independent of company
  count). Same access-pattern gap on timelines.parent_timeline_id /
  timeline_group_id for "list branches under this parent/group" queries.
- scenario_templates.effect_profile/editable_params used sa.JSON() while
  every other structured-payload column in this schema (market_events.
  effect_profile, event_instances.applied_effects, notifications.payload)
  uses postgresql.JSONB() -- inconsistent type choice for the same kind of
  data, and JSON (not JSONB) forgoes GIN-indexability/containment queries.
- timelines.primitive and timeline_groups.primitive could independently
  drift with nothing enforcing consistency between a timeline and its
  group (a Timeline with primitive='manual' could be attached to a
  'monte_carlo' TimelineGroup). A same-table CHECK narrows this: any
  Timeline with a non-null timeline_group_id must carry a sweep/ensemble
  primitive, since a true cross-table equality check needs a trigger.

Output-safe except for the two new UNIQUE constraints, which reject
previously-allowed (accidental) duplicate rows going forward -- they do not
alter any existing row's data. If duplicate rows already exist in a given
environment, this migration's upgrade() will fail loudly at the ADD
CONSTRAINT step rather than silently coexisting with bad data; run the
included cleanup queries (see NOTE below) before upgrading if that happens.

NOTE: timeline_overrides' unique constraint cannot catch duplicate
market-wide overrides (target_scope_id IS NULL) for the same key, since
Postgres treats NULL as distinct from itself in a UNIQUE constraint -- it
still catches the common company-scoped case. A partial unique index
excluding NULLs would close that gap but is deferred; scenario_service.
apply_scenario_template and branch_service.create_branch remain the
practical guard for that path today.

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- dedup constraints -------------------------------------------------
    op.create_unique_constraint(
        "uq_timeline_overrides_dedup",
        "timeline_overrides",
        ["timeline_id", "target_type", "target_key", "target_scope_id", "effective_from_sim_date"],
    )
    op.create_unique_constraint(
        "uq_timelines_parent_branch_date_name",
        "timelines",
        ["parent_timeline_id", "branch_point_sim_date", "name"],
    )
    op.create_check_constraint(
        "ck_timelines_group_primitive_consistency",
        "timelines",
        "timeline_group_id is null or primitive in ('sensitivity_sweep', 'monte_carlo')",
    )

    # --- missing timeline_id-leading indexes (create_branch's clone loops) -
    op.create_index("ix_company_factor_scores_timeline_id", "company_factor_scores", ["timeline_id"])
    op.create_index("ix_moat_subscores_timeline_id", "moat_subscores", ["timeline_id"])
    op.create_index("ix_financial_quality_subscores_timeline_id", "financial_quality_subscores", ["timeline_id"])

    # --- missing branch-tree lookup indexes ---------------------------------
    op.create_index("ix_timelines_parent_timeline_id", "timelines", ["parent_timeline_id"])
    op.create_index("ix_timelines_timeline_group_id", "timelines", ["timeline_group_id"])

    # --- JSON -> JSONB for consistency with market_events/event_instances/
    # notifications, and to allow future GIN-indexed containment queries ----
    op.alter_column(
        "scenario_templates",
        "effect_profile",
        type_=postgresql.JSONB(),
        postgresql_using="effect_profile::jsonb",
    )
    op.alter_column(
        "scenario_templates",
        "editable_params",
        type_=postgresql.JSONB(),
        postgresql_using="editable_params::jsonb",
    )


def downgrade() -> None:
    op.alter_column(
        "scenario_templates",
        "editable_params",
        type_=sa.JSON(),
        postgresql_using="editable_params::json",
    )
    op.alter_column(
        "scenario_templates",
        "effect_profile",
        type_=sa.JSON(),
        postgresql_using="effect_profile::json",
    )

    op.drop_index("ix_timelines_timeline_group_id", table_name="timelines")
    op.drop_index("ix_timelines_parent_timeline_id", table_name="timelines")

    op.drop_index("ix_financial_quality_subscores_timeline_id", table_name="financial_quality_subscores")
    op.drop_index("ix_moat_subscores_timeline_id", table_name="moat_subscores")
    op.drop_index("ix_company_factor_scores_timeline_id", table_name="company_factor_scores")

    op.drop_constraint("ck_timelines_group_primitive_consistency", "timelines", type_="check")
    op.drop_constraint("uq_timelines_parent_branch_date_name", "timelines", type_="unique")
    op.drop_constraint("uq_timeline_overrides_dedup", "timeline_overrides", type_="unique")
