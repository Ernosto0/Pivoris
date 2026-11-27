"""Billing provider protocol and value objects (ADR-029)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

from app.core.clock import Clock


@dataclass(frozen=True)
class CheckoutRequest:
    product_id: str
    product_key: str
    plan: str
    interval: str
    customer_email: str
    customer_name: str
    country: str
    pivoris_ref: str
    return_url: str
    force_language: Literal["tr", "en"]


@dataclass(frozen=True)
class CheckoutSessionResult:
    checkout_url: str
    session_id: str | None = None


@dataclass(frozen=True)
class PortalSessionResult:
    portal_url: str


@dataclass(frozen=True)
class SubscriptionSnapshot:
    subscription_id: str
    customer_id: str | None
    brand_id: str | None
    product_id: str | None
    status: str
    cancel_at_next_billing_date: bool = False
    next_billing_date: datetime | None = None
    expires_at: datetime | None = None
    past_due_ends_at: datetime | None = None
    pivoris_ref: str | None = None
    event_timestamp: datetime | None = None


class BillingProvider(Protocol):
    is_simulated: bool

    def create_checkout(self, req: CheckoutRequest) -> CheckoutSessionResult: ...

    def create_portal(self, customer_id: str, return_url: str) -> PortalSessionResult: ...

    def get_subscription(self, subscription_id: str) -> SubscriptionSnapshot: ...

    def verify_webhook(
        self, raw_body: bytes, headers: Mapping[str, str], clock: Clock
    ) -> tuple[str, datetime]: ...
