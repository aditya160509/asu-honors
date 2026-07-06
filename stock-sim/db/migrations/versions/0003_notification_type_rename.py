"""rename notifications.type to notification_type

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("notifications", "type", new_column_name="notification_type")


def downgrade() -> None:
    op.alter_column("notifications", "notification_type", new_column_name="type")
