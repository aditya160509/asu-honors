"""composite index on event_instances(timeline_id, expires_on)

_load_active_events and _apply_event_factor_effects filter EventInstance by
timeline_id and expires_on every tick with no supporting index, forcing a
sequential scan. See stock-sim/SPEED.md #1. Output-safe: indexes never
change query results, only speed.

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_event_instances_timeline_expires",
        "event_instances",
        ["timeline_id", "expires_on"],
    )


def downgrade() -> None:
    op.drop_index("ix_event_instances_timeline_expires", table_name="event_instances")
