"""Persist Future Lab progress and failure diagnostics."""

import sqlalchemy as sa
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("timelines", sa.Column("requested_ticks", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("timelines", sa.Column("completed_ticks", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("timelines", sa.Column("failure_error", sa.String(2000), nullable=True))
    op.add_column("timelines", sa.Column("recovery_action", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("timelines", "recovery_action")
    op.drop_column("timelines", "failure_error")
    op.drop_column("timelines", "completed_ticks")
    op.drop_column("timelines", "requested_ticks")
