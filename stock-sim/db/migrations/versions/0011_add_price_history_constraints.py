"""drop redundant index, add OHLC CHECK constraints to price_history

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop redundant index that duplicates the unique constraint's backing index
    op.drop_index("ix_price_history_company_timeline_date", table_name="price_history")

    # Add OHLC integrity CHECK constraints
    op.create_check_constraint("ck_price_history_high_low", "price_history", "high >= low")
    op.create_check_constraint(
        "ck_price_history_high_open_close", "price_history", "high >= open AND high >= close"
    )
    op.create_check_constraint(
        "ck_price_history_low_open_close", "price_history", "low <= open AND low <= close"
    )
    op.create_check_constraint("ck_price_history_volume", "price_history", "volume >= 0")


def downgrade() -> None:
    op.drop_constraint("ck_price_history_volume", "price_history", type_="check")
    op.drop_constraint("ck_price_history_low_open_close", "price_history", type_="check")
    op.drop_constraint("ck_price_history_high_open_close", "price_history", type_="check")
    op.drop_constraint("ck_price_history_high_low", "price_history", type_="check")
    op.create_index(
        "ix_price_history_company_timeline_date",
        "price_history",
        ["company_id", "timeline_id", "sim_date"],
    )
