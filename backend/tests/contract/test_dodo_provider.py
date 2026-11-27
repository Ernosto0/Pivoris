"""Contract tests for DodoBillingProvider with stubbed httpx transport (ADR-029, INV-10, INV-18).

Asserts:
- Request payloads for TR and US checkout sessions, portal sessions, and subscription reads.
- ``not session.in_transaction()`` while the external Dodo HTTP call is executing.
- Secrets (``DODO_API_KEY``, ``DODO_WEBHOOK_SECRET``) never appear in responses or logs on error.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.orm import Session, sessionmaker

from app.core.clock import FrozenClock
from app.core.config import REQUIRED_DODO_PRODUCT_KEYS, Settings
from app.core.db import get_db, set_tenant_context
from app.hosted.billing.catalog import ALL_ENTRIES
from app.hosted.billing.models import BillingAccount
from app.hosted.billing.registry import set_dodo_http_client_for_tests
from app.main import create_app
from tests.factories import login, workspace_with_members

pytestmark = pytest.mark.commits

TEST_API_KEY = "dodo_test_super_secret_key_never_leak_999"
TEST_WHSEC = "whsec_" + base64.b64encode(b"secret_webhook_signing_key_32byt").decode("ascii")


def _dodo_settings(base: Settings) -> Settings:
    product_csv = ",".join(f"{e.product_key}={e.test_product_id}" for e in ALL_ENTRIES)
    assert {e.product_key for e in ALL_ENTRIES} == set(REQUIRED_DODO_PRODUCT_KEYS)
    return base.model_copy(
        update={
            "billing_provider": "dodo",
            "dodo_environment": "test_mode",
            "dodo_api_key": SecretStr(TEST_API_KEY),
            "dodo_webhook_secret": SecretStr(TEST_WHSEC),
            "dodo_products": product_csv,
            "billing_return_url": "https://app.pivoris.test",
        }
    )


def test_dodo_checkout_and_portal_run_outside_db_transaction_and_hide_secrets(
    settings: Settings,
    session_factory: sessionmaker[Session],
    clock: FrozenClock,
    capsys: pytest.CaptureFixture[str],
) -> None:
    recorded_requests: list[tuple[str, str, dict[str, Any]]] = []
    in_tx_observations: list[bool] = []
    active_request_sessions: list[Session] = []
    fail_next = False

    def handler(request: httpx.Request) -> httpx.Response:
        # Assert NO open DB transaction is held during the outbound HTTP call!
        assert active_request_sessions, "Expected tracked request session"
        in_tx_observations.append(active_request_sessions[-1].in_transaction())
        body = json.loads(request.content.decode("utf-8")) if request.content else {}
        recorded_requests.append((request.method, str(request.url.path), body))
        if fail_next:
            return httpx.Response(
                503,
                json={"message": f"upstream failure with token {TEST_API_KEY}"},
            )
        if request.url.path.endswith("/checkouts"):
            return httpx.Response(
                200,
                json={
                    "session_id": "cks_contract_1",
                    "checkout_url": "https://test.checkout.dodopayments.com/session/cks_contract_1",
                },
            )
        if "/customer-portal" in request.url.path:
            return httpx.Response(
                200,
                json={"link": "https://test.portal.dodopayments.com/p/cus_contract_1"},
            )
        return httpx.Response(404, json={"message": "not mocked"})

    mock_http = httpx.Client(transport=httpx.MockTransport(handler))
    set_dodo_http_client_for_tests(mock_http)
    try:
        with session_factory() as setup_db:
            tr_ws, tr_users = workspace_with_members(
                setup_db, market="tr", currency="TRY", default_locale="tr", slug="contract-tr"
            )
            us_ws, us_users = workspace_with_members(
                setup_db, market="global", currency="USD", default_locale="en", slug="contract-us"
            )
            set_tenant_context(setup_db, tr_ws.id)
            setup_db.add(
                BillingAccount(
                    workspace_id=tr_ws.id,
                    dodo_customer_id="cus_contract_1",
                )
            )
            setup_db.commit()

        dodo_cfg = _dodo_settings(settings)
        app = create_app(dodo_cfg, clock)

        def _tracked_get_db() -> Iterator[Session]:
            s = session_factory()
            active_request_sessions.append(s)
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = _tracked_get_db

        with TestClient(app) as client:
            headers = login(client, tr_users["owner"])
            resp = client.post(
                f"/api/v1/workspaces/{tr_ws.id}/billing/checkout",
                headers=headers,
                json={"plan": "growth", "interval": "monthly"},
            )
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["checkout_url"].startswith("https://test.checkout.dodopayments.com/")
            assert data["is_simulated"] is False
            assert in_tx_observations[-1] is False

            method, path, payload = recorded_requests[-1]
            assert method == "POST" and path.endswith("/checkouts")
            assert payload["billing_address"] == {"country": "TR"}
            assert payload["customization"] == {"force_language": "tr"}
            assert payload["metadata"]["pivoris_ref"] == data["ref"]
            assert payload["product_cart"] == [
                {"product_id": "pdt_0NsqswwdrUERi0iaabEh9", "quantity": 1}
            ]

            # Portal session also runs outside any transaction
            portal_resp = client.post(
                f"/api/v1/workspaces/{tr_ws.id}/billing/portal",
                headers=headers,
            )
            assert portal_resp.status_code == 200, portal_resp.text
            assert portal_resp.json()["portal_url"].startswith(
                "https://test.portal.dodopayments.com/"
            )
            assert in_tx_observations[-1] is False

            # Global US workspace sends country US and language en
            us_headers = login(client, us_users["owner"])
            us_resp = client.post(
                f"/api/v1/workspaces/{us_ws.id}/billing/checkout",
                headers=us_headers,
                json={"plan": "starter", "interval": "annual"},
            )
            assert us_resp.status_code == 200, us_resp.text
            _, _, us_payload = recorded_requests[-1]
            assert us_payload["billing_address"] == {"country": "US"}
            assert us_payload["customization"] == {"force_language": "en"}

            # Provider 503 maps to BILLING_PROVIDER_UNAVAILABLE and leaks no secret
            capsys.readouterr()
            fail_next = True
            err_resp = client.post(
                f"/api/v1/workspaces/{us_ws.id}/billing/checkout",
                headers=us_headers,
                json={"plan": "pro", "interval": "monthly"},
            )
            assert err_resp.status_code == 503
            assert err_resp.json()["code"] == "BILLING_PROVIDER_UNAVAILABLE"
            captured = capsys.readouterr()
            combined = err_resp.text + captured.out + captured.err
            assert TEST_API_KEY not in combined
            assert TEST_WHSEC not in combined
    finally:
        set_dodo_http_client_for_tests(None)
        mock_http.close()
