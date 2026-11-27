"""Add trial_ends_at, access_until, billing_exempt and warning flags to workspace_plans.

Revision 0103, parent 0102. Backfills existing workspaces with a single fixed trial end
30 days after release (2026-12-27T00:00:00+00:00) and marks demo workspaces exempt.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0103"
down_revision: str | None = "0102"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Release date (2026-11-27) + 30 days for all pre-existing workspaces.
BACKFILL_TRIAL_ENDS_AT = "2026-12-27T00:00:00+00:00"


def upgrade() -> None:
    op.add_column(
        "workspace_plans",
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workspace_plans",
        sa.Column("access_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workspace_plans",
        sa.Column("billing_exempt", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "workspace_plans",
        sa.Column(
            "warned_trial_ending", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column(
        "workspace_plans",
        sa.Column(
            "warned_billing_paused", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Temporarily relax FORCE RLS so non-superuser migration roles can backfill all tenants.
        op.execute(sa.text("ALTER TABLE workspace_plans NO FORCE ROW LEVEL SECURITY"))
        op.execute(
            sa.text(
                f"UPDATE workspace_plans "
                f"SET trial_ends_at = '{BACKFILL_TRIAL_ENDS_AT}'::timestamptz "
                f"WHERE trial_ends_at IS NULL"
            )
        )
        op.execute(
            sa.text(
                "UPDATE workspace_plans wp "
                "SET billing_exempt = true "
                "FROM workspaces w "
                "WHERE wp.workspace_id = w.id AND w.is_demo = true"
            )
        )
        op.execute(
            sa.text(
                f"""
                INSERT INTO workspace_plans (
                    workspace_id,
                    plan,
                    monthly_quota,
                    quota_override,
                    status,
                    period_start,
                    period_end,
                    anchor_day,
                    period_id,
                    used,
                    warned_80,
                    warned_100,
                    warned_paused,
                    trial_ends_at,
                    access_until,
                    billing_exempt,
                    warned_trial_ending,
                    warned_billing_paused
                )
                SELECT
                    w.id,
                    'growth',
                    2500,
                    NULL,
                    'trial',
                    w.created_at,
                    w.created_at + interval '1 month',
                    EXTRACT(DAY FROM (w.created_at AT TIME ZONE 'UTC'))::int,
                    gen_random_uuid(),
                    0,
                    false,
                    false,
                    false,
                    '{BACKFILL_TRIAL_ENDS_AT}'::timestamptz,
                    NULL,
                    w.is_demo,
                    false,
                    false
                FROM workspaces w
                WHERE NOT EXISTS (
                    SELECT 1 FROM workspace_plans wp WHERE wp.workspace_id = w.id
                )
                """
            )
        )
        op.execute(sa.text("ALTER TABLE workspace_plans FORCE ROW LEVEL SECURITY"))

    op.alter_column("workspace_plans", "trial_ends_at", nullable=False)


def downgrade() -> None:
    op.drop_column("workspace_plans", "warned_billing_paused")
    op.drop_column("workspace_plans", "warned_trial_ending")
    op.drop_column("workspace_plans", "billing_exempt")
    op.drop_column("workspace_plans", "access_until")
    op.drop_column("workspace_plans", "trial_ends_at")
