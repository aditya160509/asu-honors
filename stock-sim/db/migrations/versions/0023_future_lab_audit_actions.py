"""Allow audit actions introduced by the completed Future Lab workflow."""

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_audit_log_action", "audit_log", type_="check")
    op.create_check_constraint(
        "ck_audit_log_action",
        "audit_log",
        "action in ('promote_config', 'promote_baseline', 'fork_league', "
        "'delete_timeline', 'create_timeline', 'rename_timeline', 'create_timeline_group')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_audit_log_action", "audit_log", type_="check")
    op.create_check_constraint(
        "ck_audit_log_action",
        "audit_log",
        "action in ('promote_config', 'promote_baseline', 'fork_league', "
        "'delete_timeline', 'create_timeline')",
    )
