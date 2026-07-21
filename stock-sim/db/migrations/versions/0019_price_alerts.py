"""price_alerts table -- user-set target prices, evaluated per advance

The `notifications` table already exists (0001_initial_schema.py /
0003_notification_type_rename.py) but has never had a writer -- this
migration adds the one genuinely new table the notifications feature needs:
a user's target-price watch per (company, timeline), checked once per
advance_simulation/extend_timeline call and turned into a Notification row
when crossed.

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "price_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_price", sa.Numeric(), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("direction in ('above', 'below')", name="ck_price_alerts_direction"),
        sa.CheckConstraint("target_price > 0", name="ck_price_alerts_target_positive"),
    )
    op.create_index(
        "ix_price_alerts_active_by_timeline", "price_alerts", ["timeline_id", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_price_alerts_active_by_timeline", table_name="price_alerts")
    op.drop_table("price_alerts")
