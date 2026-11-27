"""Hosted subscription billing tables, RLS policies and SECURITY DEFINER resolvers.

Revision 0104, parent 0103 (ADR-029).
Creates:
- billing_accounts (tenant Category C, FORCE RLS)
- billing_checkouts (tenant Category C, FORCE RLS)
- billing_webhook_events (global Category A ingress ledger, PII-scrubbed)
- resolve_billing_workspace(subscription_id, ref) SECURITY DEFINER
- discover_billing_deadlines(now, warn_horizon, limit) SECURITY DEFINER
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0104"
down_revision: str | None = "0103"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _active_schema_sql() -> str:
    bind = op.get_bind()
    schema = bind.execute(sa.text("SELECT current_schema()")).scalar_one() or "public"
    return '"' + str(schema).replace('"', '""') + '"'


def upgrade() -> None:
    op.create_table(
        "billing_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("dodo_customer_id", sa.Text(), nullable=True),
        sa.Column("dodo_subscription_id", sa.Text(), nullable=True),
        sa.Column("product_key", sa.Text(), nullable=True),
        sa.Column("provider_status", sa.Text(), nullable=True),
        sa.Column(
            "cancel_at_period_end",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("past_due_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_event_ts", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("conflict_subscription_id", sa.Text(), nullable=True),
        sa.Column(
            "founder_eligible",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "is_simulated",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_billing_accounts_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_accounts")),
        sa.UniqueConstraint("workspace_id", name=op.f("uq_billing_accounts_workspace_id")),
        sa.UniqueConstraint(
            "workspace_id", "id", name=op.f("uq_billing_accounts_workspace_id_id")
        ),
        sa.UniqueConstraint(
            "dodo_subscription_id", name=op.f("uq_billing_accounts_dodo_subscription_id")
        ),
    )
    op.create_index(
        op.f("ix_billing_accounts_workspace_id"), "billing_accounts", ["workspace_id"]
    )

    op.create_table(
        "billing_checkouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("ref", sa.Text(), nullable=False),
        sa.Column("product_key", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "is_simulated",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_billing_checkouts_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_billing_checkouts_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_checkouts")),
        sa.UniqueConstraint("ref", name=op.f("uq_billing_checkouts_ref")),
        sa.UniqueConstraint(
            "workspace_id", "id", name=op.f("uq_billing_checkouts_workspace_id_id")
        ),
    )
    op.create_index(
        op.f("ix_billing_checkouts_workspace_id"), "billing_checkouts", ["workspace_id"]
    )

    op.create_table(
        "billing_webhook_events",
        sa.Column("webhook_id", sa.Text(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=True),
        sa.Column("subscription_id", sa.Text(), nullable=True),
        sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_simulated",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'ignored', 'unmatched', 'applied')",
            name=op.f("ck_billing_webhook_events_status"),
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_billing_webhook_events_workspace_id_workspaces"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("webhook_id", name=op.f("pk_billing_webhook_events")),
    )
    op.create_index(
        "ix_billing_webhook_events_received_at", "billing_webhook_events", ["received_at"]
    )
    op.create_index(
        op.f("ix_billing_webhook_events_workspace_id"),
        "billing_webhook_events",
        ["workspace_id"],
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        q_schema = _active_schema_sql()
        for tbl in ("billing_accounts", "billing_checkouts"):
            op.execute(sa.text(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY"))
            op.execute(
                sa.text(
                    f"""
                    CREATE POLICY tenant_isolation_policy ON {tbl} FOR ALL
                    USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
                    WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
                    """
                )
            )
        for tbl in ("billing_accounts", "billing_checkouts", "billing_webhook_events"):
            for role in ("pivoris_app", "pivoris_worker", "pivoris_migrator"):
                op.execute(
                    sa.text(
                        f"""
                        DO $$ BEGIN
                            IF to_regrole('{role}') IS NOT NULL THEN
                                GRANT SELECT, INSERT, UPDATE, DELETE ON {tbl} TO {role};
                            END IF;
                        END $$;
                        """
                    )
                )

        # Narrow pre-context workspace resolver (INV-01): subscription_id first, then pivoris_ref.
        # NEVER resolves by customer_id.
        op.execute(
            sa.text(
                f"""
                CREATE OR REPLACE FUNCTION resolve_billing_workspace(
                    p_subscription_id text,
                    p_ref text
                )
                RETURNS TABLE (
                    workspace_id uuid,
                    matched_by text,
                    is_simulated boolean
                )
                LANGUAGE sql
                SECURITY DEFINER
                SET search_path = {q_schema}, pg_temp
                STABLE
                AS $$
                    SELECT sub.workspace_id, sub.matched_by, sub.is_simulated
                    FROM (
                        SELECT
                            ba.workspace_id,
                            'subscription_id'::text AS matched_by,
                            ba.is_simulated,
                            1 AS priority
                        FROM billing_accounts ba
                        WHERE p_subscription_id IS NOT NULL
                          AND p_subscription_id <> ''
                          AND ba.dodo_subscription_id = p_subscription_id
                        UNION ALL
                        SELECT
                            bc.workspace_id,
                            'pivoris_ref'::text AS matched_by,
                            bc.is_simulated,
                            2 AS priority
                        FROM billing_checkouts bc
                        WHERE p_ref IS NOT NULL
                          AND p_ref <> ''
                          AND bc.ref = p_ref
                    ) sub
                    ORDER BY sub.priority
                    LIMIT 1;
                $$;

                GRANT EXECUTE ON FUNCTION resolve_billing_workspace(text, text) TO PUBLIC;
                """
            )
        )

        op.execute(
            sa.text(
                f"""
                CREATE OR REPLACE FUNCTION discover_billing_deadlines(
                    p_now timestamptz,
                    p_warn_horizon timestamptz,
                    p_limit int DEFAULT 100
                )
                RETURNS TABLE (
                    workspace_id uuid
                )
                LANGUAGE sql
                SECURITY DEFINER
                SET search_path = {q_schema}, pg_temp
                STABLE
                AS $$
                    SELECT wp.workspace_id
                    FROM workspace_plans wp
                    JOIN workspaces w ON w.id = wp.workspace_id
                    WHERE w.status = 'active'
                      AND NOT w.is_demo
                      AND NOT wp.billing_exempt
                      AND (
                          (
                              wp.status = 'trial'
                              AND NOT wp.warned_trial_ending
                              AND wp.trial_ends_at > p_now
                              AND wp.trial_ends_at <= p_warn_horizon
                          )
                          OR (
                              wp.status = 'trial'
                              AND NOT wp.warned_billing_paused
                              AND wp.trial_ends_at <= p_now
                          )
                          OR (
                              wp.status <> 'trial'
                              AND wp.access_until IS NOT NULL
                              AND NOT wp.warned_billing_paused
                              AND wp.access_until <= p_now
                          )
                      )
                    ORDER BY wp.trial_ends_at, wp.workspace_id
                    LIMIT p_limit;
                $$;

                GRANT EXECUTE ON FUNCTION discover_billing_deadlines(timestamptz, timestamptz, int) TO PUBLIC;
                """
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text("DROP FUNCTION IF EXISTS discover_billing_deadlines(timestamptz, timestamptz, int)")
        )
        op.execute(sa.text("DROP FUNCTION IF EXISTS resolve_billing_workspace(text, text)"))
    op.drop_index(
        op.f("ix_billing_webhook_events_workspace_id"), table_name="billing_webhook_events"
    )
    op.drop_index(
        "ix_billing_webhook_events_received_at", table_name="billing_webhook_events"
    )
    op.drop_table("billing_webhook_events")
    op.drop_index(op.f("ix_billing_checkouts_workspace_id"), table_name="billing_checkouts")
    op.drop_table("billing_checkouts")
    op.drop_index(op.f("ix_billing_accounts_workspace_id"), table_name="billing_accounts")
    op.drop_table("billing_accounts")
