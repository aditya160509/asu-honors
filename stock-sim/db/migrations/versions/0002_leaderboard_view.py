"""add leaderboard materialized view

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE MATERIALIZED VIEW leaderboard AS
        SELECT
          u.id AS user_id,
          u.display_name,
          p.id AS portfolio_id,
          p.timeline_id,
          p.cash_balance,
          COALESCE(SUM(h.quantity * COALESCE(c.current_price, 0)), 0) AS holdings_value,
          p.cash_balance + COALESCE(SUM(h.quantity * COALESCE(c.current_price, 0)), 0) AS total_value,
          RANK() OVER (
            PARTITION BY p.timeline_id
            ORDER BY p.cash_balance + COALESCE(SUM(h.quantity * COALESCE(c.current_price, 0)), 0) DESC
          ) AS rank
        FROM users u
        JOIN portfolios p ON p.user_id = u.id
        LEFT JOIN holdings h ON h.portfolio_id = p.id
        LEFT JOIN companies c ON c.id = h.company_id
        GROUP BY u.id, u.display_name, p.id, p.timeline_id, p.cash_balance
        ORDER BY p.timeline_id, rank;
    """)

    op.create_index("ix_leaderboard_timeline_rank", "leaderboard", ["timeline_id", "rank"])


def downgrade() -> None:
    op.drop_index("ix_leaderboard_timeline_rank", table_name="leaderboard")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS leaderboard CASCADE")
