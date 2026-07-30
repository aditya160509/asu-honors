"""add trend_context/segment_guidance/qa_transcript/applied_deltas to con_calls

Extends ConCall (db/models/concalls.py) for the comprehensive/dynamic con-calls
feature: trend_context carries a self-chaining multi-quarter streak summary
forward from each call to the next (see engine/concalls.py::_chain_streak),
segment_guidance/qa_transcript hold the new segment-guidance and analyst-Q&A
sections (kept as separate columns rather than nested inside `statements`
since that field is typed dict[str, str] end-to-end), and applied_deltas
records what factor-score/news/financials effects a given call actually
caused (engine.orchestrator._generate_concalls_for_quarter), for auditability
and so a re-generated call is never double-applied.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()

    op.add_column("con_calls", sa.Column("trend_context", json_type, nullable=False, server_default="{}"))
    op.add_column("con_calls", sa.Column("segment_guidance", json_type, nullable=False, server_default="{}"))
    op.add_column("con_calls", sa.Column("qa_transcript", json_type, nullable=False, server_default="[]"))
    op.add_column("con_calls", sa.Column("applied_deltas", json_type, nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("con_calls", "applied_deltas")
    op.drop_column("con_calls", "qa_transcript")
    op.drop_column("con_calls", "segment_guidance")
    op.drop_column("con_calls", "trend_context")
