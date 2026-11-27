"""Dodo Payments adapter (ADR-029). Only this module may import ``dodopayments``."""

from __future__ import annotations

import time
from collections.abc import Mapping
from datetime import UTC, datetime
from types import ModuleType
from typing import Any

import httpx

from app.core.clock import Clock
from app.core.config import Settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.hosted.billing.provider import (
    CheckoutRequest,
    CheckoutSessionResult,
    PortalSessionResult,
    SubscriptionSnapshot,
)
from app.hosted.billing.webhooks import verify_standard_webhook

log = get_logger(__name__)


def load_dodo_sdk() -> ModuleType:
    """Import ``dodopayments`` lazily so self-hosted runs never load provider code."""
    import dodopayments

    return dodopayments


def _as_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC) if value.tzinfo is not None else value.replace(tzinfo=UTC)
    if isinstance(value, str) and value.strip():
        try:
            dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            return dt.astimezone(UTC) if dt.tzinfo is not None else dt.replace(tzinfo=UTC)
        except ValueError:
            return None
    return None


class DodoBillingProvider:
    is_simulated: bool = False

    def __init__(self, settings: Settings, *, http_client: httpx.Client | None = None) -> None:
        self._settings = settings
        self._http_client = http_client

    def _client(self) -> Any:
        sdk = load_dodo_sdk()
        kwargs: dict[str, Any] = {
            "bearer_token": self._settings.dodo_api_key.get_secret_value().strip(),
            "environment": self._settings.dodo_environment,
            "max_retries": 1,
        }
        if self._http_client is not None:
            kwargs["http_client"] = self._http_client
        return sdk.DodoPayments(**kwargs)

    def create_checkout(self, req: CheckoutRequest) -> CheckoutSessionResult:
        started = time.monotonic()
        try:
            client = self._client()
            resp = client.checkout_sessions.create(
                product_cart=[{"product_id": req.product_id, "quantity": 1}],
                customer={"email": req.customer_email, "name": req.customer_name},
                billing_address={"country": req.country},
                metadata={"pivoris_ref": req.pivoris_ref},
                return_url=req.return_url,
                customization={"force_language": req.force_language},
            )
            url = getattr(resp, "checkout_url", None)
            session_id = getattr(resp, "session_id", None)
            if not url:
                raise AppError("BILLING_PROVIDER_UNAVAILABLE")
            log.info(
                "dodo_call",
                provider="dodo",
                method="checkout_sessions.create",
                outcome="ok",
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            return CheckoutSessionResult(checkout_url=str(url), session_id=session_id)
        except AppError:
            raise
        except Exception as exc:
            http_status = getattr(exc, "status_code", None)
            log.warning(
                "dodo_call",
                provider="dodo",
                method="checkout_sessions.create",
                outcome="BILLING_PROVIDER_UNAVAILABLE",
                http_status=http_status,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            raise AppError("BILLING_PROVIDER_UNAVAILABLE") from None

    def create_portal(self, customer_id: str, return_url: str) -> PortalSessionResult:
        started = time.monotonic()
        try:
            client = self._client()
            resp = client.customers.customer_portal.create(
                customer_id,
                return_url=return_url,
                send_email=False,
            )
            link = getattr(resp, "link", None)
            if not link:
                raise AppError("BILLING_PROVIDER_UNAVAILABLE")
            log.info(
                "dodo_call",
                provider="dodo",
                method="customers.customer_portal.create",
                outcome="ok",
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            return PortalSessionResult(portal_url=str(link))
        except AppError:
            raise
        except Exception as exc:
            http_status = getattr(exc, "status_code", None)
            log.warning(
                "dodo_call",
                provider="dodo",
                method="customers.customer_portal.create",
                outcome="BILLING_PROVIDER_UNAVAILABLE",
                http_status=http_status,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            raise AppError("BILLING_PROVIDER_UNAVAILABLE") from None

    def get_subscription(self, subscription_id: str) -> SubscriptionSnapshot:
        started = time.monotonic()
        try:
            client = self._client()
            sub = client.subscriptions.retrieve(subscription_id)
            customer = getattr(sub, "customer", None)
            customer_id = getattr(customer, "customer_id", None) if customer else None
            meta = getattr(sub, "metadata", None) or {}
            ref = meta.get("pivoris_ref") if isinstance(meta, dict) else None
            log.info(
                "dodo_call",
                provider="dodo",
                method="subscriptions.retrieve",
                outcome="ok",
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            return SubscriptionSnapshot(
                subscription_id=str(getattr(sub, "subscription_id", subscription_id)),
                customer_id=str(customer_id) if customer_id else None,
                brand_id=getattr(sub, "brand_id", None),
                product_id=getattr(sub, "product_id", None),
                status=str(getattr(sub, "status", "unknown")),
                cancel_at_next_billing_date=bool(
                    getattr(sub, "cancel_at_next_billing_date", False)
                ),
                next_billing_date=_as_utc(getattr(sub, "next_billing_date", None)),
                expires_at=_as_utc(getattr(sub, "expires_at", None)),
                past_due_ends_at=_as_utc(getattr(sub, "past_due_ends_at", None)),
                pivoris_ref=str(ref) if ref else None,
                event_timestamp=None,
            )
        except Exception as exc:
            http_status = getattr(exc, "status_code", None)
            log.warning(
                "dodo_call",
                provider="dodo",
                method="subscriptions.retrieve",
                outcome="BILLING_PROVIDER_UNAVAILABLE",
                http_status=http_status,
                duration_ms=int((time.monotonic() - started) * 1000),
            )
            raise AppError("BILLING_PROVIDER_UNAVAILABLE") from None

    def verify_webhook(
        self, raw_body: bytes, headers: Mapping[str, str], clock: Clock
    ) -> tuple[str, datetime]:
        return verify_standard_webhook(
            raw_body,
            headers,
            self._settings.dodo_webhook_secret.get_secret_value(),
            clock,
        )
