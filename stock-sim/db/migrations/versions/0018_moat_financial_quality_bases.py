"""base columns for moat_score/financial_quality on company_factor_scores

Closes a gap left by 0012_factor_score_bases.py: moat_score and
financial_quality were assumed to always be re-derivable fresh from
MoatSubscore/FinancialQualitySubscore each tick, so they got no *_base
column of their own. That assumption breaks for a company with no subscore
rows yet (a legacy row, or a not-yet-fully-seeded company) -- both the
event-effect path (engine.orchestrator._apply_factor_effects_to_company) and
the Future Lab factor_score override path
(_apply_timeline_factor_score_overrides) fall back to reading the field's
current (possibly already-mutated) value in that case, silently compounding
across ticks exactly like the bug these _base columns exist to prevent for
the other three fields.

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("company_factor_scores", sa.Column("moat_score_base", sa.Numeric(), nullable=True))
    op.add_column("company_factor_scores", sa.Column("financial_quality_base", sa.Numeric(), nullable=True))
    op.execute(
        "UPDATE company_factor_scores SET "
        "moat_score_base = moat_score, "
        "financial_quality_base = financial_quality"
    )


def downgrade() -> None:
    op.drop_column("company_factor_scores", "financial_quality_base")
    op.drop_column("company_factor_scores", "moat_score_base")
