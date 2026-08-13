"""Persist versioned Market Explorer screener queries."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_screens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("query_json", sa.JSON(), nullable=False),
        sa.Column("columns_json", sa.JSON(), nullable=False),
        sa.Column("sort_json", sa.JSON(), nullable=False),
        sa.Column("view_mode", sa.String(length=20), nullable=False, server_default="table"),
        sa.Column("timeline_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("as_of_date", sa.Date(), nullable=True),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_saved_screens_user_name"),
    )
    op.create_index("ix_saved_screens_user_updated", "saved_screens", ["user_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_saved_screens_user_updated", table_name="saved_screens")
    op.drop_table("saved_screens")
