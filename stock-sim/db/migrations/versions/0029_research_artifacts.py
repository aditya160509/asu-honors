"""Persist notebooks, notebook blocks, and chart annotations."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "research_notebooks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=800), nullable=True),
        sa.Column("query_json", sa.JSON(), nullable=False),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "title", name="uq_research_notebooks_user_title"),
    )
    op.create_index("ix_research_notebooks_user_updated", "research_notebooks", ["user_id", "updated_at"])

    op.create_table(
        "research_notebook_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("notebook_id", sa.Integer(), sa.ForeignKey("research_notebooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("block_type", sa.String(length=30), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("provenance_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_research_notebook_blocks_order", "research_notebook_blocks", ["notebook_id", "position"])

    op.create_table(
        "chart_annotations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(length=16), nullable=False),
        sa.Column("timeline_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("timeframe", sa.String(length=20), nullable=False, server_default="1D"),
        sa.Column("tool", sa.String(length=30), nullable=False),
        sa.Column("anchors_json", sa.JSON(), nullable=False),
        sa.Column("style_json", sa.JSON(), nullable=False),
        sa.Column("evidence_json", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chart_annotations_user_symbol", "chart_annotations", ["user_id", "ticker", "timeline_id"])


def downgrade() -> None:
    op.drop_index("ix_chart_annotations_user_symbol", table_name="chart_annotations")
    op.drop_table("chart_annotations")
    op.drop_index("ix_research_notebook_blocks_order", table_name="research_notebook_blocks")
    op.drop_table("research_notebook_blocks")
    op.drop_index("ix_research_notebooks_user_updated", table_name="research_notebooks")
    op.drop_table("research_notebooks")
