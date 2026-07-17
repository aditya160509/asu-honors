"""add news_type columns to market_events and news_feed

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("market_events", sa.Column("news_type", sa.String(20), nullable=False, server_default="both"))
    op.create_check_constraint("ck_market_events_news_type", "market_events", "news_type in ('structural', 'price', 'both')")
    op.add_column("news_feed", sa.Column("news_type", sa.String(20), nullable=False, server_default="both"))
    op.create_check_constraint("ck_news_feed_news_type", "news_feed", "news_type in ('structural', 'price', 'both')")


def downgrade() -> None:
    op.drop_constraint("ck_news_feed_news_type", "news_feed", type_="check")
    op.drop_column("news_feed", "news_type")
    op.drop_constraint("ck_market_events_news_type", "market_events", type_="check")
    op.drop_column("market_events", "news_type")
