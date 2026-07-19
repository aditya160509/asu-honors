"""scope fundamentals/factor-score tables to timeline_id

company_factor_scores, moat_subscores, financial_quality_subscores,
income_statements, balance_sheets, cash_flow_statements, and
consensus_estimates were previously keyed only by (company_id,
fiscal_period[, subfactor_key]), globally shared across every Timeline.
Future Lab branches fast-forward independently and will routinely cross
the same quarter boundary as their parent/siblings, colliding on these
unique constraints and silently overwriting each other's fundamentals.
This migration adds timeline_id to all seven tables, backfills existing
rows to the live timeline, widens the unique constraints to include it,
and then makes the column required.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES_PERIOD = [
    ("company_factor_scores", "uq_company_factor_scores_company_period", ["company_id", "fiscal_period"]),
    ("income_statements", "uq_income_statements_company_period", ["company_id", "fiscal_period"]),
    ("balance_sheets", "uq_balance_sheets_company_period", ["company_id", "fiscal_period"]),
    ("cash_flow_statements", "uq_cash_flow_statements_company_period", ["company_id", "fiscal_period"]),
    ("consensus_estimates", "uq_consensus_estimates_company_period", ["company_id", "fiscal_period"]),
]
_TABLE_MOAT = ("moat_subscores", "uq_moat_subscores_company_subfactor", ["company_id", "subfactor_key"])
_TABLE_FQ = (
    "financial_quality_subscores",
    "uq_fq_subscores_company_period_subfactor",
    ["company_id", "fiscal_period", "subfactor_key"],
)

_ALL_TABLES = _TABLES_PERIOD + [_TABLE_MOAT, _TABLE_FQ]


def upgrade() -> None:
    for table_name, old_uq_name, cols in _ALL_TABLES:
        op.add_column(table_name, sa.Column("timeline_id", sa.Integer(), nullable=True))

    op.execute(
        "UPDATE company_factor_scores SET timeline_id = (SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )
    op.execute(
        "UPDATE moat_subscores SET timeline_id = (SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )
    op.execute(
        "UPDATE financial_quality_subscores SET timeline_id = "
        "(SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )
    op.execute(
        "UPDATE income_statements SET timeline_id = (SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )
    op.execute(
        "UPDATE balance_sheets SET timeline_id = (SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )
    op.execute(
        "UPDATE cash_flow_statements SET timeline_id = (SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )
    op.execute(
        "UPDATE consensus_estimates SET timeline_id = (SELECT id FROM timelines WHERE is_live = true LIMIT 1)"
    )

    for table_name, old_uq_name, cols in _ALL_TABLES:
        op.drop_constraint(old_uq_name, table_name, type_="unique")
        op.create_foreign_key(
            f"fk_{table_name}_timeline_id",
            table_name,
            "timelines",
            ["timeline_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.alter_column(table_name, "timeline_id", nullable=False)
        op.create_unique_constraint(old_uq_name, table_name, cols + ["timeline_id"])


def downgrade() -> None:
    for table_name, uq_name, cols in _ALL_TABLES:
        op.drop_constraint(uq_name, table_name, type_="unique")
        op.create_unique_constraint(uq_name, table_name, cols)
        op.drop_constraint(f"fk_{table_name}_timeline_id", table_name, type_="foreignkey")
        op.drop_column(table_name, "timeline_id")
