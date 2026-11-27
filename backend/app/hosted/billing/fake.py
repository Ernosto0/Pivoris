"""Deterministic credential-free fake billing provider for local dev, demo and CI (ADR-029)."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from urllib.parse import urlencode, urlparse

from app.core.clock import Clock
from app.core.config import Settings
from app.hosted.billing.catalog import PIVORIS_BRAND_ID
from app.hosted.billing.provider import (
    CheckoutRequest,
    CheckoutSessionResult,
    PortalSessionResult,
    SubscriptionSnapshot,
)
from app.hosted.billing.webhooks import sign_standard_webhook, verify_standard_webhook

# Fixed development-only Standard Webhooks secret (base64("pivoris-fake-dev-webhook-secret-32b")).
FAKE_WEBHOOK_SECRET = "whsec_cGl2b3Jpcy1mYWtlLWRldi13ZWJob29rLXNlY3JldC0zMmI="  # noqa: S105

# Optional in-memory overrides used by reconciliation tests against the fake provider.
_FAKE_SUBSCRIPTIONS: dict[str, SubscriptionSnapshot] = {}


def set_fake_subscription(snapshot: SubscriptionSnapshot) -> None:
    _FAKE_SUBSCRIPTIONS[snapshot.subscription_id] = snapshot


def clear_fake_subscriptions() -> None:
    _FAKE_SUBSCRIPTIONS.clear()


class FakeBillingProvider:
    is_simulated: bool = True

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _origin(self, fallback_url: str) -> str:
        parsed = urlparse(fallback_url)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
        return self._settings.frontend_origin.rstrip("/")

    def create_checkout(self, req: CheckoutRequest) -> CheckoutSessionResult:
        origin = self._origin(req.return_url)
        qs = urlencode(
            {
                "ref": req.pivoris_ref,
                "plan": req.plan,
                "interval": req.interval,
                "return_url": req.return_url,
            }
        )
        return CheckoutSessionResult(
            checkout_url=f"{origin}/dev/billing-checkout?{qs}",
            session_id=f"cks_sim_{req.pivoris_ref}",
        )

    def create_portal(self, customer_id: str, return_url: str) -> PortalSessionResult:
        origin = self._origin(return_url)
        qs = urlencode({"portal": "1", "customer_id": customer_id, "return_url": return_url})
        return PortalSessionResult(portal_url=f"{origin}/dev/billing-checkout?{qs}")

    def get_subscription(self, subscription_id: str) -> SubscriptionSnapshot:
        if subscription_id in _FAKE_SUBSCRIPTIONS:
            return _FAKE_SUBSCRIPTIONS[subscription_id]
        return SubscriptionSnapshot(
            subscription_id=subscription_id,
            customer_id="cus_sim_default",
            brand_id=PIVORIS_BRAND_ID,
            product_id=None,
            status="active",
        )

    def verify_webhook(
        self, raw_body: bytes, headers: Mapping[str, str], clock: Clock
    ) -> tuple[str, datetime]:
        return verify_standard_webhook(raw_body, headers, FAKE_WEBHOOK_SECRET, clock)


def sign_fake_webhook(raw_body: bytes, webhook_id: str, timestamp: datetime) -> dict[str, str]:
    return sign_standard_webhook(raw_body, webhook_id, timestamp, FAKE_WEBHOOK_SECRET)
