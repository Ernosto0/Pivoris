"""Billing provider registry (ADR-029)."""

from __future__ import annotations

import httpx

from app.core.config import Settings
from app.core.errors import AppError
from app.hosted.billing.dodo import DodoBillingProvider
from app.hosted.billing.fake import FakeBillingProvider
from app.hosted.billing.provider import BillingProvider

_TEST_HTTP_CLIENT: httpx.Client | None = None


def set_dodo_http_client_for_tests(client: httpx.Client | None) -> None:
    """Inject an ``httpx.Client`` (e.g. ``MockTransport``) for Dodo contract tests."""
    global _TEST_HTTP_CLIENT
    _TEST_HTTP_CLIENT = client


def get_billing_provider(settings: Settings) -> BillingProvider:
    if settings.billing_provider == "fake":
        return FakeBillingProvider(settings)
    if settings.billing_provider == "dodo":
        return DodoBillingProvider(settings, http_client=_TEST_HTTP_CLIENT)
    raise AppError("NOT_FOUND")
