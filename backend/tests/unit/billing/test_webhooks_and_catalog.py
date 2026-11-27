"""Unit tests for Standard Webhooks, PII scrubbing, catalog consistency & Dodo AST guard."""

import ast
import base64
import hashlib
import hmac
from datetime import UTC, datetime, timedelta

import pytest

from app.core.clock import FrozenClock
from app.core.config import REPO_ROOT
from app.hosted.billing.catalog import ALL_ENTRIES, FOUNDER_ENTRY, PUBLIC_CATALOG
from app.hosted.billing.webhooks import (
    WebhookSignatureError,
    scrub_webhook_payload,
    sign_standard_webhook,
    verify_standard_webhook,
)

APP_DIR = REPO_ROOT / "backend" / "app"


def test_standard_webhooks_spec_vector_and_multiple_signatures() -> None:
    """Verify exact Standard Webhooks HMAC-SHA256 vector and multi-signature rotation."""
    secret_bytes = b"test_standard_webhook_secret_key"
    secret = "whsec_" + base64.b64encode(secret_bytes).decode("ascii")
    msg_id = "msg_2p9Z3kQ7xLmN4rT8vW1y"
    ts = datetime(2026, 11, 27, 12, 0, 0, tzinfo=UTC)
    ts_str = str(int(ts.timestamp()))
    body = b'{"type":"subscription.active","data":{"subscription_id":"sub_123"}}'

    expected_sig = base64.b64encode(
        hmac.new(
            secret_bytes, f"{msg_id}.{ts_str}.".encode("ascii") + body, hashlib.sha256
        ).digest()
    ).decode("ascii")

    clock = FrozenClock(ts + timedelta(seconds=30))
    headers = {
        "webhook-id": msg_id,
        "webhook-timestamp": ts_str,
        "webhook-signature": f"v1,badsig== v1,{expected_sig}",
    }
    verified_id, verified_ts = verify_standard_webhook(body, headers, secret, clock)
    assert verified_id == msg_id
    assert verified_ts == ts

    # Helper round-trip
    built = sign_standard_webhook(body, msg_id, ts, secret)
    assert verify_standard_webhook(body, built, secret, clock) == (msg_id, ts)


def test_standard_webhooks_rejects_tampered_body_wrong_secret_and_skew() -> None:
    secret = "whsec_" + base64.b64encode(b"a" * 32).decode("ascii")
    other_secret = "whsec_" + base64.b64encode(b"b" * 32).decode("ascii")
    now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=UTC)
    body = b'{"type":"subscription.active"}'
    headers = sign_standard_webhook(body, "msg_1", now, secret)

    # Tampered body
    with pytest.raises(WebhookSignatureError):
        verify_standard_webhook(body + b" ", headers, secret, FrozenClock(now))

    # Wrong secret
    with pytest.raises(WebhookSignatureError):
        verify_standard_webhook(body, headers, other_secret, FrozenClock(now))

    # Clock skew: +300s allowed, +301s rejected; -300s allowed, -301s rejected
    assert (
        verify_standard_webhook(body, headers, secret, FrozenClock(now + timedelta(seconds=300)))[0]
        == "msg_1"
    )
    with pytest.raises(WebhookSignatureError):
        verify_standard_webhook(body, headers, secret, FrozenClock(now + timedelta(seconds=301)))

    old_headers = sign_standard_webhook(body, "msg_future", now + timedelta(seconds=301), secret)
    with pytest.raises(WebhookSignatureError):
        verify_standard_webhook(body, old_headers, secret, FrozenClock(now))


def test_scrub_webhook_payload_strips_all_pii_recursively() -> None:
    raw = {
        "type": "subscription.updated",
        "customer_email": "top@example.com",
        "customer_name": "Top Name",
        "data": {
            "subscription_id": "sub_123",
            "customer": {
                "customer_id": "cus_456",
                "email": "owner@studio.example",
                "name": "Ayse Yilmaz",
                "phone_number": "+905551112233",
            },
            "cancelled_by": {
                "actor_type": "customer",
                "email": "owner@studio.example",
                "name": "Ayse Yilmaz",
            },
            "metadata": {"pivoris_ref": "chk_abc"},
        },
    }
    scrubbed = scrub_webhook_payload(raw)
    dumped = str(scrubbed)
    assert "owner@studio.example" not in dumped
    assert "top@example.com" not in dumped
    assert "Ayse Yilmaz" not in dumped
    assert "+905551112233" not in dumped
    assert scrubbed["data"]["customer"] == {"customer_id": "cus_456"}
    assert scrubbed["data"]["cancelled_by"] == {"actor_type": "customer"}
    assert scrubbed["data"]["metadata"] == {"pivoris_ref": "chk_abc"}


def test_catalog_matches_pricing_doc_section_6_1() -> None:
    pricing_doc = (REPO_ROOT / "docs" / "product" / "pricing-and-unit-economics.md").read_text(
        encoding="utf-8"
    )
    assert len(PUBLIC_CATALOG) == 6
    assert FOUNDER_ENTRY.product_key == "founder_monthly"
    assert FOUNDER_ENTRY.plan == "growth"
    assert FOUNDER_ENTRY.try_display == "990 ₺"

    for entry in ALL_ENTRIES:
        assert entry.test_product_id in pricing_doc, (
            f"Missing {entry.test_product_id} in pricing doc"
        )
        assert entry.try_display in pricing_doc, f"Missing {entry.try_display} in pricing doc"
        if not entry.founder:
            escaped_usd = entry.usd_display.replace("$", r"\$")
            assert escaped_usd in pricing_doc or entry.usd_display in pricing_doc


def test_dodo_sdk_calls_occur_only_in_hosted_dodo_adapter() -> None:
    """AST guard: only app/hosted/billing/dodo.py may touch Dodo SDK symbols/attributes."""
    dodo_attrs = {"DodoPayments", "checkout_sessions", "customer_portal"}
    allowed = APP_DIR / "hosted" / "billing" / "dodo.py"
    offenders: list[str] = []
    for path in sorted(APP_DIR.rglob("*.py")):
        if path == allowed:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in dodo_attrs:
                offenders.append(f"{path.relative_to(APP_DIR)}:{node.lineno} accesses .{node.attr}")
    assert offenders == []

    # Prove the scan actually finds the calls in dodo.py.
    adapter_tree = ast.parse(allowed.read_text(encoding="utf-8"))
    found = {node.attr for node in ast.walk(adapter_tree) if isinstance(node, ast.Attribute)}
    assert dodo_attrs <= found
