"""quarterly/undecayed base columns for factor fields event effects mutate in place

management_quality, growth_potential, fcf_quality (on company_factor_scores) and
individual MoatSubscore sub-factor scores are qualitative attributes nudged by
structural market events. Unlike moat_score/financial_quality (always re-derived
fresh from MoatSubscore/FinancialQualitySubscore each tick), these fields had no
uncorrupted "base" value to decay event effects back toward -- the event path
mutated the effective column in place, so any decay computation had nothing but
an already-mutated value to read, and effects on them never decayed and compounded
across ticks. These columns store the value as of the last quarterly refresh (or
seed, for MoatSubscore) untouched by event effects, so event deltas can be computed
against a stable base and actually decay instead of compounding forever.

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("company_factor_scores", sa.Column("management_quality_base", sa.Numeric(), nullable=True))
    op.add_column("company_factor_scores", sa.Column("growth_potential_base", sa.Numeric(), nullable=True))
    op.add_column("company_factor_scores", sa.Column("fcf_quality_base", sa.Numeric(), nullable=True))
    op.execute(
        "UPDATE company_factor_scores SET "
        "management_quality_base = management_quality, "
        "growth_potential_base = growth_potential, "
        "fcf_quality_base = fcf_quality"
    )

    op.add_column("moat_subscores", sa.Column("score_base", sa.Numeric(), nullable=True))
    op.execute("UPDATE moat_subscores SET score_base = score")


def downgrade() -> None:
    op.drop_column("moat_subscores", "score_base")
    op.drop_column("company_factor_scores", "fcf_quality_base")
    op.drop_column("company_factor_scores", "growth_potential_base")
    op.drop_column("company_factor_scores", "management_quality_base")
