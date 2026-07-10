"""drop unused industry pe columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.drop_constraint("ck_industries_pe_bounds", "industries", type_="check")
    op.drop_column("industries", "baseline_pe")
    op.drop_column("industries", "pe_min")
    op.drop_column("industries", "pe_max")

def downgrade() -> None:
    op.add_column("industries", sa.Column("baseline_pe", sa.Numeric(), nullable=False, server_default="15.0"))
    op.add_column("industries", sa.Column("pe_min", sa.Numeric(), nullable=False, server_default="8.0"))
    op.add_column("industries", sa.Column("pe_max", sa.Numeric(), nullable=False, server_default="25.0"))
    op.create_check_constraint("ck_industries_pe_bounds", "industries", "pe_min <= pe_max")
