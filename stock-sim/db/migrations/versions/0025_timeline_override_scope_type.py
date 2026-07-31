"""Distinguish company and industry-scoped scenario overrides."""
import sqlalchemy as sa
from alembic import op
revision="0025"; down_revision="0024"; branch_labels=None; depends_on=None
def upgrade():
    op.add_column("timeline_overrides", sa.Column("target_scope_type", sa.String(20), nullable=True))
    op.create_check_constraint("ck_timeline_overrides_scope_type","timeline_overrides","target_scope_type is null or target_scope_type in ('company', 'industry')")
    op.execute("UPDATE timeline_overrides SET target_scope_type='company' WHERE target_scope_id IS NOT NULL")
def downgrade():
    op.drop_constraint("ck_timeline_overrides_scope_type","timeline_overrides",type_="check")
    op.drop_column("timeline_overrides","target_scope_type")
