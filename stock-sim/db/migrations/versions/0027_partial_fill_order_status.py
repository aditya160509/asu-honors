"""Allow orders to remain live after consuming only part of the book."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.drop_constraint("ck_orders_status", type_="check")
        batch.create_check_constraint(
            "ck_orders_status",
            "status in ('open', 'partially_filled', 'filled', 'cancelled')",
        )


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.drop_constraint("ck_orders_status", type_="check")
        batch.create_check_constraint(
            "ck_orders_status",
            "status in ('open', 'filled', 'cancelled')",
        )
