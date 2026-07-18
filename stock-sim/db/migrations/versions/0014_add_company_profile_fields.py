"""add company profile fields -- employee_count, founded_year, headquarters, ceo, usp

Adds structured "About" fields to the Company model (db/models/reference.py) so
the company detail page can render realistic profile facts (headcount, HQ,
founding year, CEO name, unique-selling-point) instead of only a single
free-text description paragraph.

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("usp", sa.String(), nullable=True))
    op.add_column("companies", sa.Column("employee_count", sa.BigInteger(), nullable=True))
    op.add_column("companies", sa.Column("founded_year", sa.Integer(), nullable=True))
    op.add_column("companies", sa.Column("headquarters", sa.String(length=120), nullable=True))
    op.add_column("companies", sa.Column("ceo", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "ceo")
    op.drop_column("companies", "headquarters")
    op.drop_column("companies", "founded_year")
    op.drop_column("companies", "employee_count")
    op.drop_column("companies", "usp")
