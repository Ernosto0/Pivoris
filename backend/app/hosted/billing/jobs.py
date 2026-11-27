"""Background jobs and periodic schedules for hosted subscription billing (ADR-029).

Imported by ``app.handlers.load_handlers`` so external channel texts and job handlers are always
registered at startup.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.orm import Session

import app.hosted.billing.texts  # noqa: F401  (registers external channel notification copy)
from app.core.clock import Clock
from app.core.config import get_settings
from app.core.context import ActorRef, WorkspaceContext
from app.core.db import clear_tenant_context, set_tenant_context
from app.core.logging import get_logger
from app.hosted.billing.models import BillingAccount, BillingWebhookEvent
from app.hosted.billing.registry import get_billing_provider
from app.hosted.billing.service import apply_subscription_snapshot, snapshot_from_webhook_payload
from app.hosted.billing.webhooks import BillingApplyEventPayload
from app.identity.models import Workspace
from app.jobs.queue import enqueue
from app.jobs.registry import JobContext, job_handler
from app.jobs.scheduler import register_periodic
from app.notifications.service import notify_permission_holders
from app.plans import service as plans_service

log = get_logger(__name__)

TRIAL_WARN_HORIZON = timedelta(days=3)


class BillingDeadlinePayload(BaseModel):
    workspace_id: uuid.UUID


class BillingReconcilePayload(BaseModel):
    pass


@job_handler("billing_apply_event", BillingApplyEventPayload, max_attempts=3)
def handle_billing_apply_event(job: JobContext) -> None:
    payload = job.payload
    if not isinstance(payload, BillingApplyEventPayload) or job.workspace_id is None:
        return
    settings = get_settings()
    with job.session_factory() as session:
        set_tenant_context(session, job.workspace_id)
        event = session.get(BillingWebhookEvent, payload.webhook_id, with_for_update=True)
        if event is None or event.status == "applied":
            return
        snapshot = snapshot_from_webhook_payload(event.payload or {}, event.event_timestamp)
        if snapshot is not None:
            apply_subscription_snapshot(
                session,
                job.clock,
                settings,
                job.workspace_id,
                snapshot,
                is_simulated=bool(event.is_simulated),
            )
        event.status = "applied"
        event.processed_at = job.clock.now()
        session.commit()


@job_handler("billing_check_deadline", BillingDeadlinePayload, max_attempts=3)
def handle_billing_check_deadline(job: JobContext) -> None:
    payload = job.payload
    if not isinstance(payload, BillingDeadlinePayload):
        return
    ws_id = job.workspace_id or payload.workspace_id
    settings = get_settings()
    if not settings.billing_enabled:
        return

    with job.session_factory() as session:
        set_tenant_context(session, ws_id)
        workspace = session.get(Workspace, ws_id)
        if workspace is None or workspace.status != "active" or workspace.is_demo:
            return
        row = plans_service.get_plan(session, job.clock, ws_id)
        if row.billing_exempt:
            session.commit()
            return

        now = job.clock.now()
        ctx = WorkspaceContext(
            workspace_id=workspace.id,
            actor=ActorRef.system("billing_deadline"),
            role=None,
            timezone=workspace.timezone,
            locale=workspace.default_locale,
            is_demo=workspace.is_demo,
        )

        # 1. 3-day trial ending warning
        if (
            row.status == "trial"
            and not row.warned_trial_ending
            and now < row.trial_ends_at <= now + TRIAL_WARN_HORIZON
        ):
            notify_permission_holders(
                session,
                job.clock,
                ctx,
                permission="system_health.view",
                type="billing.trial_ending",
                severity="attention",
                params={"trial_ends_at": row.trial_ends_at.isoformat()},
                dedup_key=f"billing.trial_ending:{ws_id}:{row.trial_ends_at.isoformat()}",
                is_simulated=settings.billing_provider == "fake",
            )
            row.warned_trial_ending = True

        # 2. Trial or access_until passed -> billing.paused
        if (
            plans_service.billing_block_reason(row, now, billing_on=True, is_demo=workspace.is_demo)
            == "BILLING_INACTIVE"
            and not row.warned_billing_paused
        ):
            episode_dt = row.access_until if row.status != "trial" else row.trial_ends_at
            episode = (episode_dt or now).isoformat()
            notify_permission_holders(
                session,
                job.clock,
                ctx,
                permission="system_health.view",
                type="billing.paused",
                severity="critical",
                params={"reason": "BILLING_INACTIVE"},
                dedup_key=f"billing.paused:{ws_id}:{episode}",
                is_simulated=settings.billing_provider == "fake",
            )
            row.warned_billing_paused = True

        session.commit()


@job_handler("billing_reconcile", BillingReconcilePayload, max_attempts=2, timeout=180)
def handle_billing_reconcile(job: JobContext) -> None:
    """Daily read-only subscription reconciliation outside DB transactions (ADR-029)."""
    settings = get_settings()
    if not settings.billing_enabled:
        return
    provider = get_billing_provider(settings)

    targets: list[tuple[uuid.UUID, str, bool]] = []
    with job.session_factory() as session:
        ws_ids = list(
            session.scalars(select(Workspace.id).where(Workspace.status == "active")).all()
        )
        for ws_id in ws_ids:
            set_tenant_context(session, ws_id)
            acct = session.scalars(
                select(BillingAccount).where(
                    BillingAccount.workspace_id == ws_id,
                    BillingAccount.dodo_subscription_id.is_not(None),
                    BillingAccount.provider_status.not_in(("expired",)),
                )
            ).one_or_none()
            if acct is not None and acct.dodo_subscription_id:
                targets.append((ws_id, acct.dodo_subscription_id, bool(acct.is_simulated)))
        clear_tenant_context(session)
        session.commit()

    # Fetch each subscription outside any open DB transaction.
    for ws_id, sub_id, is_sim in targets:
        try:
            snapshot = provider.get_subscription(sub_id)
        except Exception:
            log.warning(
                "billing_reconcile_fetch_failed",
                workspace_id=str(ws_id),
                subscription_id=sub_id,
            )
            continue
        with job.session_factory() as session:
            set_tenant_context(session, ws_id)
            apply_subscription_snapshot(
                session,
                job.clock,
                settings,
                ws_id,
                snapshot,
                is_simulated=is_sim or provider.is_simulated,
            )
            session.commit()


@register_periodic
def enqueue_billing_deadlines(session: Session, clock: Clock) -> int:
    if not get_settings().billing_enabled:
        return 0
    now = clock.now()
    horizon = now + TRIAL_WARN_HORIZON
    rows = session.execute(
        text("SELECT workspace_id FROM discover_billing_deadlines(:now, :horizon, 100)"),
        {"now": now, "horizon": horizon},
    ).all()
    count = 0
    for (raw_ws_id,) in rows:
        ws_id = uuid.UUID(str(raw_ws_id))
        enqueue(
            session,
            "billing_check_deadline",
            BillingDeadlinePayload(workspace_id=ws_id),
            workspace_id=ws_id,
            correlation_id=None,
            dedup_key=f"billing_check_deadline:{ws_id}:{now:%Y-%m-%dT%H}",
            clock=clock,
        )
        count += 1
    return count


@register_periodic
def enqueue_billing_reconcile(session: Session, clock: Clock) -> int:
    if not get_settings().billing_enabled:
        return 0
    now = clock.now()
    enqueue(
        session,
        "billing_reconcile",
        BillingReconcilePayload(),
        workspace_id=None,
        correlation_id=None,
        dedup_key=f"billing_reconcile:{now:%Y-%m-%d}",
        clock=clock,
    )
    return 1
