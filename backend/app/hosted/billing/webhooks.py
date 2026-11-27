"""Standard Webhooks HMAC-SHA256 verification, PII scrubbing, and Dodo webhook ingestion (ADR-029).

Mounted at ``POST /webhooks/billing/dodo`` outside ``/api/v1`` (no session, no CSRF) when
``settings.billing_enabled`` is true.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_clock
from app.audit import service as audit
from app.audit.models import AuditLog
from app.core.clock import Clock
from app.core.config import Settings
from app.core.db import get_db, set_tenant_context
from app.core.logging import get_logger
from app.hosted.billing.catalog import PIVORIS_BRAND_ID, product_id_to_entry
from app.hosted.billing.models import BillingWebhookEvent
from app.jobs.queue import enqueue
from app.operations.operator_alerts import (
    COOLDOWN_BILLING,
    AlertCandidate,
    raise_alert_candidate,
)

log = get_logger(__name__)

MAX_WEBHOOK_SKEW_SECONDS = 300  # ±5 minutes per Standard Webhooks specification
SIGNATURE_FAILURE_ALERT_PER_HOUR = 10
SCRUBBED_PII_KEYS = frozenset({"email", "name", "phone_number", "customer_email", "customer_name"})


class WebhookSignatureError(ValueError):
    """Raised when Standard Webhooks headers or HMAC-SHA256 verification fail."""


class BillingApplyEventPayload(BaseModel):
    webhook_id: str


@dataclass(frozen=True)
class WebhookIngestResult:
    status: Literal["queued", "duplicate", "ignored", "unmatched", "invalid_signature"]
    webhook_id: str | None = None
    workspace_id: uuid.UUID | None = None


def _header(headers: Mapping[str, str], name: str) -> str | None:
    target = name.lower()
    for key, val in headers.items():
        if key.lower() == target:
            return val
    return None


def _decode_webhook_secret(secret: str) -> bytes:
    cleaned = secret.strip().removeprefix("whsec_")
    if not cleaned:
        raise WebhookSignatureError("empty webhook secret")
    try:
        key = base64.b64decode(cleaned, validate=True)
    except binascii.Error as exc:
        raise WebhookSignatureError("invalid base64 webhook secret") from exc
    if not key:
        raise WebhookSignatureError("empty decoded webhook secret")
    return key


def sign_standard_webhook(
    raw_body: bytes,
    webhook_id: str,
    timestamp: datetime,
    secret: str,
) -> dict[str, str]:
    """Build valid Standard Webhooks headers for ``raw_body`` (used by fake adapter & tests)."""
    key = _decode_webhook_secret(secret)
    ts_str = str(int(timestamp.astimezone(UTC).timestamp()))
    signed_content = f"{webhook_id}.{ts_str}.".encode("ascii") + raw_body
    digest = hmac.new(key, signed_content, hashlib.sha256).digest()
    sig = base64.b64encode(digest).decode("ascii")
    return {
        "webhook-id": webhook_id,
        "webhook-timestamp": ts_str,
        "webhook-signature": f"v1,{sig}",
    }


def verify_standard_webhook(
    raw_body: bytes,
    headers: Mapping[str, str],
    secret: str,
    clock: Clock,
) -> tuple[str, datetime]:
    """Verify Standard Webhooks HMAC-SHA256 over ``{id}.{timestamp}.{raw_body}``.

    Returns ``(webhook_id, header_timestamp_utc)`` or raises ``WebhookSignatureError``.
    """
    msg_id = (_header(headers, "webhook-id") or "").strip()
    ts_raw = (_header(headers, "webhook-timestamp") or "").strip()
    sig_header = (_header(headers, "webhook-signature") or "").strip()
    if not msg_id or not ts_raw or not sig_header:
        raise WebhookSignatureError("missing required Standard Webhooks header")
    try:
        ts_int = int(ts_raw)
    except ValueError as exc:
        raise WebhookSignatureError("invalid webhook-timestamp") from exc

    now_epoch = int(clock.now().astimezone(UTC).timestamp())
    if abs(now_epoch - ts_int) > MAX_WEBHOOK_SKEW_SECONDS:
        raise WebhookSignatureError("webhook timestamp outside tolerance")

    key = _decode_webhook_secret(secret)
    signed_content = f"{msg_id}.{ts_raw}.".encode("ascii") + raw_body
    expected_b64 = base64.b64encode(hmac.new(key, signed_content, hashlib.sha256).digest()).decode(
        "ascii"
    )

    matched = False
    for token in sig_header.split(" "):
        part = token.strip()
        if not part.startswith("v1,"):
            continue
        candidate_b64 = part[3:]
        if candidate_b64 and hmac.compare_digest(candidate_b64, expected_b64):
            matched = True
    if not matched:
        raise WebhookSignatureError("no matching v1 signature")

    return msg_id, datetime.fromtimestamp(ts_int, tz=UTC)


def scrub_webhook_payload(value: Any) -> Any:
    """Recursively strip customer PII (email, name, phone) before persisting webhook JSON."""
    if isinstance(value, dict):
        return {
            str(k): scrub_webhook_payload(v)
            for k, v in value.items()
            if str(k) not in SCRUBBED_PII_KEYS
        }
    if isinstance(value, list):
        return [scrub_webhook_payload(item) for item in value]
    return value


def _parse_iso_dt(raw: Any) -> datetime | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        dt = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
        return dt.astimezone(UTC) if dt.tzinfo is not None else dt.replace(tzinfo=UTC)
    except ValueError:
        return None


def _record_invalid_signature(session: Session, clock: Clock, provider_kind: str) -> None:
    audit.record(
        session,
        None,
        "webhook.signature_invalid",
        None,
        None,
        {"provider_kind": provider_kind},
        is_simulated=provider_kind.endswith("fake"),
        clock=clock,
    )
    session.flush()
    since = clock.now() - timedelta(hours=1)
    recent = session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == "webhook.signature_invalid", AuditLog.occurred_at >= since)
    )
    if (recent or 0) >= SIGNATURE_FAILURE_ALERT_PER_HOUR:
        log.error("webhook_signature_failures", provider_kind=provider_kind, last_hour=recent)
    else:
        log.warning("webhook_signature_invalid", provider_kind=provider_kind)


def ingest_dodo_webhook(
    session: Session,
    clock: Clock,
    settings: Settings,
    raw_body: bytes,
    headers: Mapping[str, str],
) -> WebhookIngestResult:
    """Verify Standard Webhooks signature, scrub PII, deduplicate, resolve workspace, enqueue."""
    from app.hosted.billing.registry import get_billing_provider

    provider = get_billing_provider(settings)
    provider_label = f"billing_{settings.billing_provider}"
    try:
        webhook_id, header_ts = provider.verify_webhook(raw_body, headers, clock)
    except WebhookSignatureError:
        _record_invalid_signature(session, clock, provider_label)
        session.commit()
        return WebhookIngestResult(status="invalid_signature")

    try:
        parsed = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        _record_invalid_signature(session, clock, provider_label)
        session.commit()
        return WebhookIngestResult(status="invalid_signature")

    if not isinstance(parsed, dict):
        _record_invalid_signature(session, clock, provider_label)
        session.commit()
        return WebhookIngestResult(status="invalid_signature")

    now = clock.now()
    event_type = str(parsed.get("type") or "unknown")
    event_ts = _parse_iso_dt(parsed.get("timestamp")) or header_ts
    raw_data = parsed.get("data")
    data: dict[str, Any] = raw_data if isinstance(raw_data, dict) else {}
    brand_id = str(data.get("brand_id")) if data.get("brand_id") else None
    product_id = str(data.get("product_id")) if data.get("product_id") else None
    subscription_id = str(data.get("subscription_id")) if data.get("subscription_id") else None
    raw_meta = data.get("metadata")
    metadata: dict[str, Any] = raw_meta if isinstance(raw_meta, dict) else {}
    pivoris_ref = str(metadata.get("pivoris_ref")) if metadata.get("pivoris_ref") else None
    scrubbed = scrub_webhook_payload(parsed)

    known_products = product_id_to_entry(settings)
    is_foreign_brand = bool(
        brand_id and brand_id != PIVORIS_BRAND_ID and product_id not in known_products
    )
    is_foreign_product = bool(
        not brand_id and product_id is not None and product_id not in known_products
    )
    if is_foreign_brand or is_foreign_product or not event_type.startswith("subscription."):
        session.execute(
            pg_insert(BillingWebhookEvent)
            .values(
                webhook_id=webhook_id,
                event_type=event_type,
                status="ignored",
                workspace_id=None,
                subscription_id=subscription_id,
                event_timestamp=event_ts,
                is_simulated=provider.is_simulated,
                payload=scrubbed,
                received_at=now,
                processed_at=now,
            )
            .on_conflict_do_nothing(index_elements=["webhook_id"])
        )
        session.commit()
        return WebhookIngestResult(status="ignored", webhook_id=webhook_id)

    resolved_row = session.execute(
        text(
            "SELECT workspace_id, matched_by, is_simulated "
            "FROM resolve_billing_workspace(:sub_id, :ref)"
        ),
        {"sub_id": subscription_id or "", "ref": pivoris_ref or ""},
    ).one_or_none()

    if resolved_row is None or resolved_row[0] is None:
        inserted_unmatched = session.scalar(
            pg_insert(BillingWebhookEvent)
            .values(
                webhook_id=webhook_id,
                event_type=event_type,
                status="unmatched",
                workspace_id=None,
                subscription_id=subscription_id,
                event_timestamp=event_ts,
                is_simulated=provider.is_simulated,
                payload=scrubbed,
                received_at=now,
                processed_at=now,
            )
            .on_conflict_do_nothing(index_elements=["webhook_id"])
            .returning(BillingWebhookEvent.webhook_id)
        )
        if inserted_unmatched is not None:
            raise_alert_candidate(
                session,
                clock,
                settings,
                AlertCandidate(
                    alert_key="billing:unmatched_webhook",
                    category="billing",
                    severity="warning",
                    summary=f"Unmatched Pivoris billing webhook: {event_type}",
                    details={
                        "webhook_id": webhook_id,
                        "event_type": event_type,
                        "subscription_id": subscription_id,
                    },
                    cooldown=COOLDOWN_BILLING,
                    workspace_id=None,
                ),
            )
        session.commit()
        return WebhookIngestResult(
            status="unmatched" if inserted_unmatched is not None else "duplicate",
            webhook_id=webhook_id,
        )

    workspace_id = uuid.UUID(str(resolved_row[0]))
    is_sim = bool(resolved_row[2]) or provider.is_simulated
    set_tenant_context(session, workspace_id)
    inserted_id = session.scalar(
        pg_insert(BillingWebhookEvent)
        .values(
            webhook_id=webhook_id,
            event_type=event_type,
            status="queued",
            workspace_id=workspace_id,
            subscription_id=subscription_id,
            event_timestamp=event_ts,
            is_simulated=is_sim,
            payload=scrubbed,
            received_at=now,
            processed_at=None,
        )
        .on_conflict_do_nothing(index_elements=["webhook_id"])
        .returning(BillingWebhookEvent.webhook_id)
    )
    if inserted_id is None:
        session.commit()
        return WebhookIngestResult(
            status="duplicate", webhook_id=webhook_id, workspace_id=workspace_id
        )

    enqueue(
        session,
        "billing_apply_event",
        BillingApplyEventPayload(webhook_id=webhook_id),
        workspace_id=workspace_id,
        correlation_id=uuid.uuid4(),
        dedup_key=f"billing_apply_event:{webhook_id}",
        clock=clock,
    )
    session.commit()
    return WebhookIngestResult(status="queued", webhook_id=webhook_id, workspace_id=workspace_id)


def create_billing_webhooks_router() -> APIRouter:
    router = APIRouter(prefix="/webhooks/billing", tags=["webhooks"])

    @router.post("/dodo")
    async def receive_dodo_webhook(
        request: Request,
        db: Session = Depends(get_db),
        clock: Clock = Depends(get_clock),
        settings: Settings = Depends(get_app_settings),
    ) -> Response:
        raw_body = await request.body()
        result = await run_in_threadpool(
            ingest_dodo_webhook, db, clock, settings, raw_body, dict(request.headers)
        )
        if result.status == "invalid_signature":
            return JSONResponse({"status": "invalid_signature"}, status_code=401)
        log.info(
            "billing_webhook_received",
            status=result.status,
            webhook_id=result.webhook_id,
            workspace_id=str(result.workspace_id) if result.workspace_id else None,
        )
        return JSONResponse({"status": "ok"})

    return router
