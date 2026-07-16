"""trading desk: orders table + transaction.order_id link

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sim_date", sa.Date(), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("order_type", sa.String(10), nullable=False, server_default="market"),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("limit_price", sa.Numeric(), nullable=True),
        sa.Column("status", sa.String(12), nullable=False, server_default="open"),
        sa.Column("filled_quantity", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("avg_fill_price", sa.Numeric(), nullable=True),
        sa.Column("fees", sa.Numeric(), nullable=True),
        sa.Column("filled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("side in ('buy', 'sell')", name="ck_orders_side"),
        sa.CheckConstraint("order_type in ('market', 'limit')", name="ck_orders_type"),
        sa.CheckConstraint("status in ('open', 'filled', 'cancelled')", name="ck_orders_status"),
        sa.CheckConstraint("quantity > 0", name="ck_orders_quantity_positive"),
    )
    op.create_index("ix_orders_portfolio_status", "orders", ["portfolio_id", "status"])

    op.add_column("transactions", sa.Column("order_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_order_id", "transactions", "orders", ["order_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_order_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "order_id")
    op.drop_table("orders")
