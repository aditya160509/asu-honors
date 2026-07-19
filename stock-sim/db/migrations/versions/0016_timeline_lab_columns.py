"""add Future Lab lifecycle columns to timelines

Adds the columns Future Lab's branch/sweep/ensemble lifecycle needs on top
of the existing parent_timeline_id/branch_point_sim_date/rng_seed/is_live
columns: which timeline_group a branch belongs to (for sweeps/ensembles),
which scenario primitive created it, sweep parameter/value bookkeeping,
async job status, pin/expiry for retention (Section 11.8), and
last_touched_at for the Future Lab home screen.

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "timeline_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("primitive", sa.String(30), nullable=False),
        sa.Column("label", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "primitive in ('sensitivity_sweep', 'monte_carlo')",
            name="ck_timeline_groups_primitive",
        ),
    )

    op.add_column(
        "timelines",
        sa.Column("timeline_group_id", sa.Integer(), sa.ForeignKey("timeline_groups.id", ondelete="CASCADE"), nullable=True),
    )
    op.add_column("timelines", sa.Column("primitive", sa.String(30), nullable=True))
    op.add_column("timelines", sa.Column("sweep_param", sa.String(80), nullable=True))
    op.add_column("timelines", sa.Column("sweep_value", sa.String(80), nullable=True))
    op.add_column(
        "timelines",
        sa.Column("status", sa.String(20), nullable=False, server_default="ready"),
    )
    op.add_column("timelines", sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("timelines", sa.Column("last_touched_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("timelines", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))

    op.create_check_constraint(
        "ck_timelines_primitive",
        "timelines",
        "primitive is null or primitive in "
        "('manual', 'structural_override', 'macro_shock', 'sensitivity_sweep', 'monte_carlo', 'liquidity_scenario')",
    )
    op.create_check_constraint(
        "ck_timelines_status",
        "timelines",
        "status in ('pending', 'running', 'ready', 'failed', 'archived')",
    )

    op.execute("UPDATE timelines SET status = 'ready'")


def downgrade() -> None:
    op.drop_constraint("ck_timelines_status", "timelines", type_="check")
    op.drop_constraint("ck_timelines_primitive", "timelines", type_="check")
    op.drop_column("timelines", "expires_at")
    op.drop_column("timelines", "last_touched_at")
    op.drop_column("timelines", "pinned")
    op.drop_column("timelines", "status")
    op.drop_column("timelines", "sweep_value")
    op.drop_column("timelines", "sweep_param")
    op.drop_column("timelines", "primitive")
    op.drop_column("timelines", "timeline_group_id")
    op.drop_table("timeline_groups")
