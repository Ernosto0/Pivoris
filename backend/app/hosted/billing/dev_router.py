"""Dev-only synthetic billing webhook simulator (``POST /api/v1/dev/billing/simulate``, INV-20)."""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_auth, enforce_csrf, get_app_settings, get_clock
from app.core.clock import Clock
from app.core.config import Settings
from app.core.db import clear_tenant_context, get_db, get_session_factory, set_tenant_context
from app.core.errors import AppError
from app.hosted.billing.catalog import PIVORIS_BRAND_ID, resolve_product_map
from app.hosted.billing.fake import sign_fake_webhook
from app.hosted.billing.models import BillingAccount, BillingCheckout
from app.hosted.billing.webhooks import ingest_dodo_webhook
from app.identity.models import WorkspaceMember
from app.identity.permissions import has_permission
from app.identity.service import AuthenticatedSession
from app.jobs.testing import run_due_jobs

SimulateOutcome = Literal[
    "active",
    "past_due",
    "on_hold",
    "cancelled",
    "cancelled_end_of_period",
    "renewed",
]


class DevBillingSimulateIn(BaseModel):
    ref: str
    outcome: SimulateOutcome = "active"


class DevBillingSimulateOut(BaseModel):
    status: str
    webhook_id: str
    subscription_id: str
    is_simulated: bool = True


router = APIRouter(
    prefix="/api/v1/dev/billing",
    tags=["dev"],
    dependencies=[Depends(enforce_csrf)],
)


@router.post("/simulate", response_model=DevBillingSimulateOut)
def simulate_billing_webhook(
    body: DevBillingSimulateIn,
    auth: AuthenticatedSession = Depends(current_auth),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    settings: Settings = Depends(get_app_settings),
) -> DevBillingSimulateOut:
    """Verify caller owns the checkout's workspace, sign a Standard Webhook, and ingest it."""
    if not settings.demo_tools_enabled or settings.app_env == "production":
        raise AppError("NOT_FOUND")
    if settings.billing_provider != "fake":
        raise AppError("CONFLICT_STATE")

    memberships = list(
        db.scalars(select(WorkspaceMember).where(WorkspaceMember.user_id == auth.user.id)).all()
    )
    matched_checkout: BillingCheckout | None = None
    matched_role: str | None = None
    existing_account: BillingAccount | None = None
    for member in memberships:
        set_tenant_context(db, member.workspace_id)
        chk = db.scalars(
            select(BillingCheckout).where(
                BillingCheckout.workspace_id == member.workspace_id,
                BillingCheckout.ref == body.ref,
            )
        ).one_or_none()
        if chk is not None:
            matched_checkout = chk
            matched_role = member.role
            existing_account = db.scalars(
                select(BillingAccount).where(BillingAccount.workspace_id == member.workspace_id)
            ).one_or_none()
            break
    clear_tenant_context(db)

    if matched_checkout is None:
        raise AppError("NOT_FOUND")
    if not has_permission(matched_role, "billing.manage"):
        raise AppError("FORBIDDEN")

    now = clock.now()
    product_map = resolve_product_map(settings)
    product_id = product_map.get(matched_checkout.product_key, "")
    sub_id = (
        existing_account.dodo_subscription_id
        if existing_account and existing_account.dodo_subscription_id
        else "sub_sim_"
        + hashlib.sha256(str(matched_checkout.workspace_id).encode()).hexdigest()[:16]
    )
    cus_id = (
        existing_account.dodo_customer_id
        if existing_account and existing_account.dodo_customer_id
        else "cus_sim_" + hashlib.sha256(auth.user.email.encode()).hexdigest()[:16]
    )

    event_type = f"subscription.{body.outcome}"
    raw_status = body.outcome
    cancel_at_end = False
    next_billing = (now + timedelta(days=30)).isoformat()
    expires_at: str | None = None
    past_due_ends_at: str | None = None

    if body.outcome == "renewed":
        raw_status = "active"
    elif body.outcome == "past_due":
        past_due_ends_at = (now + timedelta(days=7)).isoformat()
    elif body.outcome == "cancelled_end_of_period":
        event_type = "subscription.updated"
        raw_status = "active"
        cancel_at_end = True
    elif body.outcome == "cancelled":
        expires_at = now.isoformat()

    event_body: dict[str, Any] = {
        "business_id": "bus_sim_pivoris",
        "type": event_type,
        "timestamp": now.isoformat(),
        "data": {
            "payload_type": "Subscription",
            "subscription_id": sub_id,
            "brand_id": PIVORIS_BRAND_ID,
            "product_id": product_id,
            "status": raw_status,
            "cancel_at_next_billing_date": cancel_at_end,
            "next_billing_date": next_billing,
            "expires_at": expires_at,
            "past_due_ends_at": past_due_ends_at,
            "customer": {
                "customer_id": cus_id,
                "email": auth.user.email,
                "name": auth.user.display_name,
            },
            "metadata": {"pivoris_ref": matched_checkout.ref},
        },
    }
    raw_bytes = json.dumps(event_body, separators=(",", ":")).encode("utf-8")
    webhook_id = f"msg_sim_{secrets.token_hex(12)}"
    headers = sign_fake_webhook(raw_bytes, webhook_id, now)
    ingest_result = ingest_dodo_webhook(db, clock, settings, raw_bytes, headers)

    # Run due jobs on the bound session connection so simulated checkout takes effect immediately.
    from sqlalchemy.orm import sessionmaker

    bound_factory = sessionmaker(
        bind=db.get_bind(),
        expire_on_commit=False,
        autoflush=False,
    )
    try:
        run_due_jobs(clock, session_factory=bound_factory)
    except Exception:
        run_due_jobs(clock, session_factory=get_session_factory())

    return DevBillingSimulateOut(
        status=ingest_result.status,
        webhook_id=webhook_id,
        subscription_id=sub_id,
        is_simulated=True,
    )
