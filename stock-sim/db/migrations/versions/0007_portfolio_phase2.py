"""portfolio phase 2: watchlist groups, goals, dividends

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Named watchlists -------------------------------------------------
    op.create_table(
        "watchlist_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_watchlist_groups_user_name"),
    )
    op.create_index("ix_watchlist_groups_user_id", "watchlist_groups", ["user_id"])

    op.add_column("watchlists", sa.Column("group_id", sa.Integer(), nullable=True))
    op.add_column("watchlists", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))

    # Migrate every user's existing flat watchlist rows into a "Default" group,
    # preserving insertion order as sort_order.
    op.execute(
        """
        INSERT INTO watchlist_groups (user_id, name, sort_order, created_at, updated_at)
        SELECT DISTINCT user_id, 'Default', 0, now(), now() FROM watchlists
        """
    )
    op.execute(
        """
        UPDATE watchlists w
        SET group_id = g.id,
            sort_order = ranked.rn - 1
        FROM watchlist_groups g,
             (SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id) AS rn FROM watchlists) ranked
        WHERE g.user_id = w.user_id AND g.name = 'Default' AND ranked.id = w.id
        """
    )

    op.alter_column("watchlists", "group_id", nullable=False)
    op.create_foreign_key(
        "fk_watchlists_group_id", "watchlists", "watchlist_groups", ["group_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_constraint("uq_watchlists_user_company", "watchlists", type_="unique")
    op.create_unique_constraint("uq_watchlists_group_company", "watchlists", ["group_id", "company_id"])

    # --- Goals ------------------------------------------------------------
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("target_value", sa.Numeric(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("achieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("target_value > 0", name="ck_goals_target_value_positive"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])

    # --- Dividends ----------------------------------------------------------
    op.create_table(
        "dividends",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timeline_id", sa.Integer(), sa.ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("declared_date", sa.Date(), nullable=False),
        sa.Column("ex_date", sa.Date(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount_per_share", sa.Numeric(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("company_id", "timeline_id", "ex_date", name="uq_dividends_company_timeline_exdate"),
        sa.CheckConstraint("amount_per_share > 0", name="ck_dividends_amount_positive"),
    )
    op.create_index("ix_dividends_timeline_exdate", "dividends", ["timeline_id", "ex_date"])


def downgrade() -> None:
    op.drop_table("dividends")
    op.drop_table("goals")
    op.drop_constraint("uq_watchlists_group_company", "watchlists", type_="unique")
    op.create_unique_constraint("uq_watchlists_user_company", "watchlists", ["user_id", "company_id"])
    op.drop_constraint("fk_watchlists_group_id", "watchlists", type_="foreignkey")
    op.drop_column("watchlists", "sort_order")
    op.drop_column("watchlists", "group_id")
    op.drop_table("watchlist_groups")
