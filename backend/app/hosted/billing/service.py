"""Hosted subscription billing service: catalog views, checkout/portal sessions, and snapshots."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import service as audit
from app.core.clock import Clock
from app.core.config import Settings
from app.core.context import ActorRef, WorkspaceContext
from app.core.errors import AppError
from app.hosted.billing.catalog import (
    ENTRIES_BY_KEY,
    FOUNDER_ENTRY,
    PUBLIC_CATALOG,
    BillingInterval,
    entry_for_selection,
    product_id_to_entry,
    resolve_product_map,
)
from app.hosted.billing.models import BillingAccount, BillingCheckout
from app.hosted.billing.provider import CheckoutRequest, SubscriptionSnapshot
from app.hosted.billing.registry import get_billing_provider
from app.identity.models import User, Workspace
from app.identity.permissions import has_permission
from app.notifications.service import notify_permission_holders
from app.operations.operator_alerts import (
    COOLDOWN_BILLING,
    AlertCandidate,
    raise_alert_candidate,
)
from app.plans import service as plans_service
from app.plans.tiers import TIERS

CHECKOUT_TTL = timedelta(hours=24)
DEFAULT_DODO_GRACE = timedelta(days=7)


class PlanPriceOut(BaseModel):
    plan: Literal["starter", "growth", "pro"]
    interval: BillingInterval
    product_key: str
    amount_display: str
    monthly_equivalent_display: str
    ai_replies_quota: int


class FounderOfferOut(BaseModel):
    product_key: str
    plan: Literal["growth"]
    interval: Literal["monthly"]
    amount_display: str
    ai_replies_quota: int


class BillingOut(BaseModel):
    plan: Literal["starter", "growth", "pro"]
    status: Literal["trial", "active", "past_due", "cancelled"]
    provider_status: str | None
    product_key: str | None
    cancel_at_period_end: bool
    current_period_end: datetime | None
    trial_ends_at: datetime
    access_until: datetime | None
    past_due_ends_at: datetime | None
    billing_exempt: bool
    block_reason: Literal["BILLING_INACTIVE", "REPLY_QUOTA_PAUSED"] | None
    currency: Literal["TRY", "USD"]
    tax_exclusive: bool
    plans: list[PlanPriceOut]
    founder_offer: FounderOfferOut | None
    has_subscription: bool
    has_customer: bool
    can_manage: bool
    is_simulated: bool


class CheckoutIn(BaseModel):
    plan: Literal["starter", "growth", "pro", "founder"]
    interval: BillingInterval


class CheckoutOut(BaseModel):
    checkout_url: str
    ref: str
    is_simulated: bool


class PortalOut(BaseModel):
    portal_url: str
    is_simulated: bool


def _locked_account(session: Session, workspace_id: uuid.UUID) -> BillingAccount | None:
    session.flush()
    return session.scalars(
        select(BillingAccount).where(BillingAccount.workspace_id == workspace_id).with_for_update()
    ).one_or_none()


def get_or_create_account(session: Session, workspace_id: uuid.UUID) -> BillingAccount:
    acct = _locked_account(session, workspace_id)
    if acct is not None:
        return acct
    acct = BillingAccount(workspace_id=workspace_id)
    session.add(acct)
    session.flush()
    return acct


def _return_url_for(settings: Settings, workspace_id: uuid.UUID, *, checkout: bool) -> str:
    base = (settings.billing_return_url.strip() or settings.frontend_origin.strip()).rstrip("/")
    suffix = "?checkout=returned" if checkout else ""
    return f"{base}/w/{workspace_id}/more/settings/billing{suffix}"


def get_billing_view(
    session: Session,
    clock: Clock,
    settings: Settings,
    ctx: WorkspaceContext,
) -> BillingOut:
    workspace = session.get(Workspace, ctx.workspace_id)
    if workspace is None:
        raise AppError("NOT_FOUND")
    plan_row = plans_service.get_plan(session, clock, ctx.workspace_id)
    acct = session.scalars(
        select(BillingAccount).where(BillingAccount.workspace_id == ctx.workspace_id)
    ).one_or_none()

    now = clock.now()
    raw_block = plans_service.block_reason(
        plan_row,
        now,
        billing_on=settings.billing_enabled,
        is_demo=workspace.is_demo,
    )
    block: Literal["BILLING_INACTIVE", "REPLY_QUOTA_PAUSED"] | None = None
    if raw_block == "BILLING_INACTIVE":
        block = "BILLING_INACTIVE"
    elif raw_block == "REPLY_QUOTA_PAUSED":
        block = "REPLY_QUOTA_PAUSED"

    use_try = workspace.currency == "TRY"
    plans_out = [
        PlanPriceOut(
            plan=entry.plan,
            interval=entry.interval,
            product_key=entry.product_key,
            amount_display=entry.try_display if use_try else entry.usd_display,
            monthly_equivalent_display=(
                entry.try_monthly_equivalent if use_try else entry.usd_monthly_equivalent
            ),
            ai_replies_quota=entry.ai_replies_quota,
        )
        for entry in PUBLIC_CATALOG
    ]
    founder_out: FounderOfferOut | None = None
    if acct is not None and acct.founder_eligible:
        founder_out = FounderOfferOut(
            product_key=FOUNDER_ENTRY.product_key,
            plan="growth",
            interval="monthly",
            amount_display=FOUNDER_ENTRY.try_display,
            ai_replies_quota=FOUNDER_ENTRY.ai_replies_quota,
        )

    is_sim = (
        bool(acct.is_simulated)
        if (acct and acct.dodo_subscription_id)
        else (settings.billing_provider == "fake")
    )
    plan_slug: Literal["starter", "growth", "pro"] = (
        plan_row.plan if plan_row.plan in ("starter", "growth", "pro") else "growth"  # type: ignore[assignment]
    )
    status_slug: Literal["trial", "active", "past_due", "cancelled"] = (
        plan_row.status
        if plan_row.status in ("trial", "active", "past_due", "cancelled")
        else "trial"  # type: ignore[assignment]
    )
    return BillingOut(
        plan=plan_slug,
        status=status_slug,
        provider_status=acct.provider_status if acct else None,
        product_key=acct.product_key if acct else None,
        cancel_at_period_end=bool(acct.cancel_at_period_end) if acct else False,
        current_period_end=acct.current_period_end if acct else None,
        trial_ends_at=plan_row.trial_ends_at,
        access_until=plan_row.access_until,
        past_due_ends_at=acct.past_due_ends_at if acct else None,
        billing_exempt=bool(plan_row.billing_exempt),
        block_reason=block,
        currency="TRY" if use_try else "USD",
        tax_exclusive=True,
        plans=plans_out,
        founder_offer=founder_out,
        has_subscription=bool(acct and acct.dodo_subscription_id),
        has_customer=bool(acct and acct.dodo_customer_id),
        can_manage=has_permission(ctx.role, "billing.manage"),
        is_simulated=is_sim,
    )


def start_checkout(
    session: Session,
    clock: Clock,
    settings: Settings,
    ctx: WorkspaceContext,
    body: CheckoutIn,
) -> CheckoutOut:
    """Commit ``billing_checkouts`` + audit first, then call provider outside any DB transaction."""
    workspace = session.get(Workspace, ctx.workspace_id)
    if workspace is None:
        raise AppError("NOT_FOUND")
    if ctx.actor.type != "user" or not ctx.actor.id:
        raise AppError("FORBIDDEN")
    owner = session.get(User, uuid.UUID(str(ctx.actor.id)))
    if owner is None:
        raise AppError("FORBIDDEN")

    entry = entry_for_selection(body.plan, body.interval)
    if entry is None:
        raise AppError(
            "VALIDATION_FAILED",
            errors=[{"field": "interval", "code": "invalid_interval"}],
        )

    acct = _locked_account(session, ctx.workspace_id)
    if (
        acct is not None
        and acct.dodo_subscription_id
        and acct.provider_status in ("active", "past_due")
    ):
        raise AppError("BILLING_ALREADY_SUBSCRIBED")

    if entry.founder and not (acct is not None and acct.founder_eligible):
        raise AppError("FORBIDDEN")

    product_map = resolve_product_map(settings)
    product_id = product_map.get(entry.product_key)
    if not product_id:
        raise AppError("BILLING_PROVIDER_UNAVAILABLE")

    provider = get_billing_provider(settings)
    is_sim = provider.is_simulated
    now = clock.now()
    ref = f"chk_{secrets.token_urlsafe(18)}"

    checkout_row = BillingCheckout(
        workspace_id=ctx.workspace_id,
        ref=ref,
        product_key=entry.product_key,
        created_by=owner.id,
        is_simulated=is_sim,
        expires_at=now + CHECKOUT_TTL,
        created_at=now,
    )
    session.add(checkout_row)
    session.flush()
    audit.record(
        session,
        ctx,
        "billing.checkout_created",
        "billing_checkout",
        checkout_row.id,
        {
            "product_key": entry.product_key,
            "plan": entry.plan,
            "interval": entry.interval,
        },
        is_simulated=is_sim,
        clock=clock,
    )

    # Snapshot all values into plain Python primitives before ending the DB transaction.
    req = CheckoutRequest(
        product_id=product_id,
        product_key=entry.product_key,
        plan=body.plan,
        interval=body.interval,
        customer_email=str(owner.email),
        customer_name=str(owner.display_name),
        country="TR" if (workspace.market == "tr" or workspace.currency == "TRY") else "US",
        pivoris_ref=ref,
        return_url=_return_url_for(settings, ctx.workspace_id, checkout=True),
        force_language="tr" if (workspace.default_locale or "tr") == "tr" else "en",
    )
    session.commit()

    # External provider call happens strictly outside any open DB transaction.
    created = provider.create_checkout(req)
    return CheckoutOut(checkout_url=created.checkout_url, ref=ref, is_simulated=is_sim)


def open_portal(
    session: Session,
    clock: Clock,
    settings: Settings,
    ctx: WorkspaceContext,
) -> PortalOut:
    """Commit ``billing.portal_opened`` audit, then mint Dodo Customer Portal URL outside tx."""
    acct = _locked_account(session, ctx.workspace_id)
    if acct is None or not acct.dodo_customer_id:
        raise AppError("CONFLICT_STATE")

    provider = get_billing_provider(settings)
    is_sim = bool(acct.is_simulated) or provider.is_simulated
    customer_id = str(acct.dodo_customer_id)
    return_url = _return_url_for(settings, ctx.workspace_id, checkout=False)

    audit.record(
        session,
        ctx,
        "billing.portal_opened",
        "billing_account",
        acct.id,
        {"has_subscription": bool(acct.dodo_subscription_id)},
        is_simulated=is_sim,
        clock=clock,
    )
    session.commit()

    portal = provider.create_portal(customer_id, return_url)
    return PortalOut(portal_url=portal.portal_url, is_simulated=is_sim)


def _billing_ctx(workspace: Workspace) -> WorkspaceContext:
    return WorkspaceContext(
        workspace_id=workspace.id,
        actor=ActorRef.system("billing"),
        role=None,
        timezone=workspace.timezone,
        locale=workspace.default_locale,
        is_demo=workspace.is_demo,
    )


def apply_subscription_snapshot(
    session: Session,
    clock: Clock,
    settings: Settings,
    workspace_id: uuid.UUID,
    snapshot: SubscriptionSnapshot,
    *,
    is_simulated: bool,
) -> Literal["applied", "stale", "conflict"]:
    """Apply a verified Dodo subscription snapshot to ``billing_accounts`` and ``workspace_plans``.

    Caller owns the transaction (``billing_apply_event`` or ``billing_reconcile``).
    """
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        return "stale"
    ctx = _billing_ctx(workspace)
    plan_row = plans_service.get_plan(session, clock, workspace_id)
    acct = get_or_create_account(session, workspace_id)
    now = clock.now()

    if (
        snapshot.event_timestamp is not None
        and acct.last_event_ts is not None
        and snapshot.event_timestamp <= acct.last_event_ts
    ):
        return "stale"

    # Guard against a second distinct active subscription overwriting an active/past_due one.
    if (
        acct.dodo_subscription_id
        and snapshot.subscription_id
        and acct.dodo_subscription_id != snapshot.subscription_id
        and acct.provider_status in ("active", "past_due")
        and snapshot.status == "active"
    ):
        acct.conflict_subscription_id = snapshot.subscription_id
        audit.record(
            session,
            ctx,
            "billing.subscription_updated",
            "billing_account",
            acct.id,
            {
                "conflict": "duplicate_active_subscription",
                "existing_subscription_id": acct.dodo_subscription_id,
                "conflict_subscription_id": snapshot.subscription_id,
            },
            is_simulated=is_simulated,
            clock=clock,
        )
        raise_alert_candidate(
            session,
            clock,
            settings,
            AlertCandidate(
                alert_key=f"billing:duplicate_subscription:{workspace_id}",
                category="billing",
                severity="warning",
                summary="Second active subscription received for workspace",
                details={
                    "workspace_id": str(workspace_id),
                    "existing_subscription_id": acct.dodo_subscription_id,
                    "conflict_subscription_id": snapshot.subscription_id,
                },
                cooldown=COOLDOWN_BILLING,
                workspace_id=workspace_id,
            ),
        )
        return "conflict"

    prev_plan_status = plan_row.status
    prev_provider_status = acct.provider_status
    by_product_id = product_id_to_entry(settings)
    entry = by_product_id.get(snapshot.product_id or "")
    if entry is None and snapshot.pivoris_ref:
        checkout_match = session.scalars(
            select(BillingCheckout).where(
                BillingCheckout.workspace_id == workspace_id,
                BillingCheckout.ref == snapshot.pivoris_ref,
            )
        ).one_or_none()
        if checkout_match is not None:
            entry = ENTRIES_BY_KEY.get(checkout_match.product_key)
    if entry is None and acct.product_key:
        entry = ENTRIES_BY_KEY.get(acct.product_key)

    acct.dodo_subscription_id = snapshot.subscription_id
    if snapshot.customer_id:
        acct.dodo_customer_id = snapshot.customer_id
    if entry is not None:
        acct.product_key = entry.product_key
    acct.provider_status = snapshot.status
    acct.cancel_at_period_end = bool(snapshot.cancel_at_next_billing_date)
    period_end = snapshot.expires_at or snapshot.next_billing_date
    if period_end is not None:
        acct.current_period_end = period_end
    if snapshot.status == "past_due":
        if snapshot.past_due_ends_at is not None:
            acct.past_due_ends_at = snapshot.past_due_ends_at
        elif acct.past_due_ends_at is None:
            acct.past_due_ends_at = now + DEFAULT_DODO_GRACE
    else:
        acct.past_due_ends_at = None
    if snapshot.event_timestamp is not None:
        acct.last_event_ts = snapshot.event_timestamp
    acct.is_simulated = is_simulated

    if snapshot.pivoris_ref:
        chk = session.scalars(
            select(BillingCheckout).where(
                BillingCheckout.workspace_id == workspace_id,
                BillingCheckout.ref == snapshot.pivoris_ref,
            )
        ).one_or_none()
        if chk is not None and chk.completed_at is None:
            chk.completed_at = now

    first_activation = False
    audit_action = "billing.subscription_updated"
    raw_status = snapshot.status

    # Operator billing_exempt workspaces never have their workspace_plans status overwritten.
    if not plan_row.billing_exempt:
        if entry is not None:
            plan_row.plan = entry.plan
            plan_row.monthly_quota = TIERS[entry.plan]

        if (
            raw_status == "active"
            and snapshot.cancel_at_next_billing_date
            and period_end is not None
            and period_end > now
        ):
            plan_row.status = "cancelled"
            plan_row.access_until = period_end
            plan_row.warned_billing_paused = False
            audit_action = "billing.subscription_cancelled"
        elif raw_status == "active":
            first_activation = acct.activated_at is None
            if first_activation:
                acct.activated_at = now
                plan_row.period_start = now
                plan_row.anchor_day = now.day
                plan_row.period_end = plans_service.next_month(now, now.day)
                plans_service.reset_usage(plan_row)
            plan_row.status = "active"
            plan_row.access_until = None
            plan_row.warned_billing_paused = False
            audit_action = (
                "billing.subscription_activated"
                if (first_activation or prev_plan_status != "active")
                else "billing.subscription_updated"
            )
            if first_activation or prev_plan_status != "active":
                act_iso = acct.activated_at.isoformat() if acct.activated_at else now.isoformat()
                notify_permission_holders(
                    session,
                    clock,
                    ctx,
                    permission="system_health.view",
                    type="billing.activated",
                    severity="info",
                    params={"plan": plan_row.plan},
                    dedup_key=f"billing.activated:{snapshot.subscription_id}:{act_iso}",
                    is_simulated=is_simulated,
                )
        elif raw_status == "past_due":
            grace_end = acct.past_due_ends_at or (now + DEFAULT_DODO_GRACE)
            acct.past_due_ends_at = grace_end
            plan_row.status = "past_due"
            plan_row.access_until = grace_end
            audit_action = "billing.subscription_past_due"
            if grace_end > now:
                plan_row.warned_billing_paused = False
                notify_permission_holders(
                    session,
                    clock,
                    ctx,
                    permission="system_health.view",
                    type="billing.payment_failed",
                    severity="attention",
                    params={"past_due_ends_at": grace_end.isoformat()},
                    dedup_key=f"billing.payment_failed:{snapshot.subscription_id}:{grace_end.isoformat()}",
                    is_simulated=is_simulated,
                )
            elif not plan_row.warned_billing_paused:
                plan_row.warned_billing_paused = True
                notify_permission_holders(
                    session,
                    clock,
                    ctx,
                    permission="system_health.view",
                    type="billing.paused",
                    severity="critical",
                    params={"reason": "BILLING_INACTIVE"},
                    dedup_key=f"billing.paused:{workspace_id}:{grace_end.isoformat()}",
                    is_simulated=is_simulated,
                )
        elif raw_status == "cancelled":
            plan_row.status = "cancelled"
            audit_action = "billing.subscription_cancelled"
            if period_end is not None and period_end > now:
                plan_row.access_until = period_end
                plan_row.warned_billing_paused = False
            else:
                plan_row.access_until = now
                if not plan_row.warned_billing_paused:
                    plan_row.warned_billing_paused = True
                    notify_permission_holders(
                        session,
                        clock,
                        ctx,
                        permission="system_health.view",
                        type="billing.paused",
                        severity="critical",
                        params={"reason": "BILLING_INACTIVE"},
                        dedup_key=f"billing.paused:{workspace_id}:{now.isoformat()}",
                        is_simulated=is_simulated,
                    )
        elif raw_status in ("on_hold", "failed", "expired"):
            plan_row.status = "past_due" if raw_status in ("on_hold", "failed") else "cancelled"
            plan_row.access_until = now
            audit_action = (
                "billing.subscription_past_due"
                if plan_row.status == "past_due"
                else "billing.subscription_cancelled"
            )
            if not plan_row.warned_billing_paused:
                plan_row.warned_billing_paused = True
                notify_permission_holders(
                    session,
                    clock,
                    ctx,
                    permission="system_health.view",
                    type="billing.paused",
                    severity="critical",
                    params={"reason": "BILLING_INACTIVE"},
                    dedup_key=f"billing.paused:{workspace_id}:{now.isoformat()}",
                    is_simulated=is_simulated,
                )

    audit.record(
        session,
        ctx,
        audit_action,
        "billing_account",
        acct.id,
        {
            "subscription_id": snapshot.subscription_id,
            "provider_status": snapshot.status,
            "previous_provider_status": prev_provider_status,
            "plan": plan_row.plan,
            "status": plan_row.status,
            "first_activation": first_activation,
            "billing_exempt": bool(plan_row.billing_exempt),
        },
        is_simulated=is_simulated,
        clock=clock,
    )
    session.flush()
    return "applied"


def snapshot_from_webhook_payload(
    payload: dict[str, Any], fallback_ts: datetime | None
) -> SubscriptionSnapshot | None:
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    sub_id = data.get("subscription_id")
    if not sub_id:
        return None
    raw_customer = data.get("customer")
    customer: dict[str, Any] = raw_customer if isinstance(raw_customer, dict) else {}
    customer_id = str(customer.get("customer_id")) if customer.get("customer_id") else None
    raw_meta = data.get("metadata")
    meta: dict[str, Any] = raw_meta if isinstance(raw_meta, dict) else {}
    pivoris_ref = str(meta.get("pivoris_ref")) if meta.get("pivoris_ref") else None

    def _dt(val: Any) -> datetime | None:
        if not isinstance(val, str) or not val.strip():
            return None
        try:
            parsed = datetime.fromisoformat(val.strip().replace("Z", "+00:00"))
            return (
                parsed.astimezone(UTC) if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
            )
        except ValueError:
            return None

    return SubscriptionSnapshot(
        subscription_id=str(sub_id),
        customer_id=customer_id,
        brand_id=str(data["brand_id"]) if data.get("brand_id") else None,
        product_id=str(data["product_id"]) if data.get("product_id") else None,
        status=str(data.get("status") or "unknown"),
        cancel_at_next_billing_date=bool(data.get("cancel_at_next_billing_date", False)),
        next_billing_date=_dt(data.get("next_billing_date")),
        expires_at=_dt(data.get("expires_at")),
        past_due_ends_at=_dt(data.get("past_due_ends_at")),
        pivoris_ref=pivoris_ref,
        event_timestamp=_dt(payload.get("timestamp")) or fallback_ts,
    )
