"""backfill $100,000 portfolios for users missing one on the default timeline

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_TIMELINE_ID = 1
DEFAULT_STARTING_CASH = 100_000


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO portfolios (user_id, timeline_id, cash_balance, total_value, created_at, updated_at)
        SELECT u.id, {DEFAULT_TIMELINE_ID}, {DEFAULT_STARTING_CASH}, {DEFAULT_STARTING_CASH}, now(), now()
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM portfolios p
            WHERE p.user_id = u.id AND p.timeline_id = {DEFAULT_TIMELINE_ID}
        )
        """
    )


def downgrade() -> None:
    # No-op: cannot distinguish backfilled portfolios from ones a user has since traded in.
    pass
