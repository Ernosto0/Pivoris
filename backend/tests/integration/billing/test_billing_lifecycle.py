"""End-to-end integration tests for hosted subscription billing (Sessions 3, 4 & 5, ADR-029)."""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.audit.models import AuditLog
from app.cli import main as cli_main
from app.core import config
from app.core.clock import FrozenClock
from app.core.config import Settings
from app.core.db import set_tenant_context
from app.hosted.billing.catalog import PIVORIS_BRAND_ID
from app.hosted.billing.fake import (
    clear_fake_subscriptions,
    set_fake_subscription,
    sign_fake_webhook,
)
from app.hosted.billing.models import BillingAccount, BillingWebhookEvent
from app.hosted.billing.provider import SubscriptionSnapshot
from app.integrations.channels.web_push.payloads import build_payload, deep_link
from app.jobs.models import Job
from app.jobs.scheduler import scheduler_tick
from app.jobs.testing import run_due_jobs
from app.main import create_app
from app.notifications.catalog import PUSH_TYPES, TELEGRAM_TYPES, WHATSAPP_TYPES
from app.notifications.models import Notification
from app.operations.models import OperatorAlertState
from app.plans import service as plans_service
from tests.factories import create_user, login, workspace_with_members

pytestmark = pytest.mark.commits

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "contract" / "fixtures" / "dodo"


def _fake_app(settings: Settings, clock: FrozenClock) -> TestClient:
    cfg = settings.model_copy(update={"billing_provider": "fake", "demo_tools_enabled": True})
    return TestClient(create_app(cfg, clock))


def _post_signed_event(
    client: TestClient,
    clock: FrozenClock,
    body: dict[str, Any],
    *,
    webhook_id: str | None = None,
) -> tuple[int, str]:
    wid = webhook_id or f"msg_{uuid.uuid4().hex[:16]}"
    raw = json.dumps(body, separators=(",", ":")).encode("utf-8")
    headers = sign_fake_webhook(raw, wid, clock.now())
    resp = client.post(
        "/webhooks/billing/dodo",
        content=raw,
        headers={"Content-Type": "application/json", **headers},
    )
    return resp.status_code, wid


def test_billing_provider_none_mounts_no_billing_routes(
    settings: Settings, clock: FrozenClock, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as s:
        ws, users = workspace_with_members(s)
        s.commit()

    cfg = settings.model_copy(update={"billing_provider": "none"})
    with TestClient(create_app(cfg, clock)) as client:
        meta = client.get("/api/v1/meta").json()
        assert meta["billing_enabled"] is False
        login(client, users["owner"])
        assert client.get(f"/api/v1/workspaces/{ws.id}/billing").status_code == 404
        assert client.post("/webhooks/billing/dodo", content=b"{}").status_code == 404


def test_bad_signature_401_audit_and_3x_dedup_single_job_and_pii_stripped(
    settings: Settings,
    clock: FrozenClock,
    session_factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BILLING_PROVIDER", "fake")
    config.get_settings.cache_clear()
    try:
        with session_factory() as s:
            ws, users = workspace_with_members(s, slug="dedup-ws")
            s.commit()

        with _fake_app(settings, clock) as client:
            # 1. Invalid signature -> 401 + system-level webhook.signature_invalid audit
            bad = client.post(
                "/webhooks/billing/dodo",
                content=b'{"type":"subscription.active"}',
                headers={
                    "webhook-id": "msg_bad",
                    "webhook-timestamp": str(int(clock.now().timestamp())),
                    "webhook-signature": "v1,dGhpcyBpcyBub3QgYSB2YWxpZCBzaWduYXR1cmU=",
                },
            )
            assert bad.status_code == 401

            with session_factory() as s:
                sig_audits = s.scalar(
                    select(func.count())
                    .select_from(AuditLog)
                    .where(AuditLog.action == "webhook.signature_invalid")
                )
                assert sig_audits == 1

            # 2. Start checkout to obtain pivoris_ref
            headers = login(client, users["owner"])
            chk = client.post(
                f"/api/v1/workspaces/{ws.id}/billing/checkout",
                headers=headers,
                json={"plan": "growth", "interval": "monthly"},
            )
            assert chk.status_code == 200, chk.text
            ref = chk.json()["ref"]

            # 3. Deliver the exact same webhook-id 3 times -> 200 each, ONE job enqueued (INV-06)
            fixture = json.loads((FIXTURES_DIR / "subscription_active.json").read_text("utf-8"))
            fixture["timestamp"] = clock.now().isoformat()
            fixture["data"]["metadata"]["pivoris_ref"] = ref
            fixture["data"]["subscription_id"] = "sub_dedup_01"

            for _ in range(3):
                code, _ = _post_signed_event(client, clock, fixture, webhook_id="msg_dedup_3x")
                assert code == 200

            with session_factory() as s:
                job_count = s.scalar(
                    select(func.count())
                    .select_from(Job)
                    .where(Job.job_type == "billing_apply_event")
                )
                assert job_count == 1
                stored = s.get(BillingWebhookEvent, "msg_dedup_3x")
                assert stored is not None
                assert "owner@studio.example" not in json.dumps(stored.payload)
                assert "Test Studio Owner" not in json.dumps(stored.payload)
    finally:
        monkeypatch.setenv("BILLING_PROVIDER", "none")
        config.get_settings.cache_clear()


def test_full_subscription_lifecycle_and_out_of_order_and_unmatched_events(
    settings: Settings,
    clock: FrozenClock,
    session_factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BILLING_PROVIDER", "fake")
    config.get_settings.cache_clear()
    try:
        with session_factory() as s:
            ws, users = workspace_with_members(s, slug="lifecycle-ws")
            set_tenant_context(s, ws.id)
            plan_row = plans_service.get_plan(s, clock, ws.id)
            plan_row.trial_ends_at = clock.now() + timedelta(days=14)
            s.commit()

        with _fake_app(settings, clock) as client:
            # Day 14: trial expires -> blocked with BILLING_INACTIVE
            clock.advance(days=14)
            headers = login(client, users["owner"])
            view = client.get(f"/api/v1/workspaces/{ws.id}/billing").json()
            assert view["status"] == "trial"
            assert view["block_reason"] == "BILLING_INACTIVE"

            # Subscribe to starter_monthly
            chk = client.post(
                f"/api/v1/workspaces/{ws.id}/billing/checkout",
                headers=headers,
                json={"plan": "starter", "interval": "monthly"},
            ).json()
            ref = chk["ref"]

            # Pre-spend some replies on the old trial period to verify first activation resets usage
            with session_factory() as s:
                set_tenant_context(s, ws.id)
                pr = plans_service.get_plan(s, clock, ws.id)
                pr.used = 42
                s.commit()

            # Deliver active webhook -> status=active, quota=500, used=0
            active_ev = json.loads((FIXTURES_DIR / "subscription_active.json").read_text("utf-8"))
            active_ev["timestamp"] = clock.now().isoformat()
            active_ev["data"]["subscription_id"] = "sub_life_1"
            active_ev["data"]["product_id"] = "pdt_0NsqswkWAd0FK9oDO2f0o"  # starter_monthly
            active_ev["data"]["metadata"]["pivoris_ref"] = ref
            _post_signed_event(client, clock, active_ev)
            run_due_jobs(clock, session_factory=session_factory)

            view = client.get(f"/api/v1/workspaces/{ws.id}/billing").json()
            assert (view["plan"], view["status"], view["block_reason"]) == (
                "starter",
                "active",
                None,
            )
            usage_body = client.get(f"/api/v1/workspaces/{ws.id}/usage").json()
            assert (usage_body["quota"], usage_body["used"]) == (500, 0)
            anchor_period_start = usage_body["period_start"]

            # Spend 5 replies, then renew 10 days later -> used stays 5, period unchanged
            with session_factory() as s:
                set_tenant_context(s, ws.id)
                for i in range(5):
                    assert plans_service.consume(s, clock, ws.id, f"paid-draft-{i}")
                s.commit()
            clock.advance(days=10)
            login(client, users["owner"])
            renew_ev = json.loads((FIXTURES_DIR / "subscription_renewed.json").read_text("utf-8"))
            renew_ev["timestamp"] = clock.now().isoformat()
            renew_ev["data"]["subscription_id"] = "sub_life_1"
            renew_ev["data"]["product_id"] = "pdt_0NsqswkWAd0FK9oDO2f0o"
            _post_signed_event(client, clock, renew_ev)
            run_due_jobs(clock, session_factory=session_factory)

            usage_after_renew = client.get(f"/api/v1/workspaces/{ws.id}/usage").json()
            assert usage_after_renew["used"] == 5
            assert usage_after_renew["period_start"] == anchor_period_start

            # Out-of-order older event is ignored and cannot revert plan/status
            stale_ev = json.loads((FIXTURES_DIR / "subscription_past_due.json").read_text("utf-8"))
            stale_ev["timestamp"] = (clock.now() - timedelta(days=2)).isoformat()
            stale_ev["data"]["subscription_id"] = "sub_life_1"
            _post_signed_event(client, clock, stale_ev)
            run_due_jobs(clock, session_factory=session_factory)
            assert client.get(f"/api/v1/workspaces/{ws.id}/billing").json()["status"] == "active"

            # Past-due with 7 days grace -> allowed during grace, blocked once grace ends
            clock.advance(days=1)
            grace_end = clock.now() + timedelta(days=7)
            pd_ev = json.loads((FIXTURES_DIR / "subscription_past_due.json").read_text("utf-8"))
            pd_ev["timestamp"] = clock.now().isoformat()
            pd_ev["data"]["subscription_id"] = "sub_life_1"
            pd_ev["data"]["product_id"] = "pdt_0NsqswkWAd0FK9oDO2f0o"
            pd_ev["data"]["past_due_ends_at"] = grace_end.isoformat()
            _post_signed_event(client, clock, pd_ev)
            run_due_jobs(clock, session_factory=session_factory)

            view = client.get(f"/api/v1/workspaces/{ws.id}/billing").json()
            assert view["status"] == "past_due"
            assert view["block_reason"] is None

            clock.advance(days=7, seconds=1)
            login(client, users["owner"])
            view = client.get(f"/api/v1/workspaces/{ws.id}/billing").json()
            assert view["block_reason"] == "BILLING_INACTIVE"

            # Recover to active, then cancel at period end -> allowed until period end, then blocked
            clock.advance(minutes=5)
            active_ev["timestamp"] = clock.now().isoformat()
            _post_signed_event(client, clock, active_ev)
            run_due_jobs(clock, session_factory=session_factory)
            assert client.get(f"/api/v1/workspaces/{ws.id}/billing").json()["block_reason"] is None

            clock.advance(minutes=5)
            cancel_end = clock.now() + timedelta(days=20)
            cancel_ev = json.loads(
                (FIXTURES_DIR / "subscription_cancelled_end_of_period.json").read_text("utf-8")
            )
            cancel_ev["timestamp"] = clock.now().isoformat()
            cancel_ev["data"]["subscription_id"] = "sub_life_1"
            cancel_ev["data"]["product_id"] = "pdt_0NsqswkWAd0FK9oDO2f0o"
            cancel_ev["data"]["next_billing_date"] = cancel_end.isoformat()
            _post_signed_event(client, clock, cancel_ev)
            run_due_jobs(clock, session_factory=session_factory)

            view = client.get(f"/api/v1/workspaces/{ws.id}/billing").json()
            assert view["status"] == "cancelled"
            assert view["cancel_at_period_end"] is True
            assert view["block_reason"] is None

            clock.advance(days=20, seconds=1)
            login(client, users["owner"])
            view = client.get(f"/api/v1/workspaces/{ws.id}/billing").json()
            assert view["block_reason"] == "BILLING_INACTIVE"

            # Foreign brand -> ignored (no alert); unmatched Pivoris -> unmatched + operator alert
            foreign = json.loads(
                (FIXTURES_DIR / "subscription_other_brand.json").read_text("utf-8")
            )
            foreign["timestamp"] = clock.now().isoformat()
            code, foreign_wid = _post_signed_event(client, clock, foreign)
            assert code == 200

            unmatched = json.loads((FIXTURES_DIR / "subscription_active.json").read_text("utf-8"))
            unmatched["timestamp"] = clock.now().isoformat()
            unmatched["data"]["subscription_id"] = "sub_unknown_999"
            unmatched["data"]["metadata"] = {"pivoris_ref": "chk_does_not_exist"}
            code, unmatched_wid = _post_signed_event(client, clock, unmatched)
            assert code == 200

            with session_factory() as s:
                assert s.get(BillingWebhookEvent, foreign_wid).status == "ignored"  # type: ignore[union-attr]
                assert s.get(BillingWebhookEvent, unmatched_wid).status == "unmatched"  # type: ignore[union-attr]
                alert = s.scalar(
                    select(OperatorAlertState).where(
                        OperatorAlertState.alert_key == "billing:unmatched_webhook"
                    )
                )
                assert alert is not None and alert.status == "firing"
    finally:
        monkeypatch.setenv("BILLING_PROVIDER", "none")
        config.get_settings.cache_clear()


def test_same_owner_email_isolation_permissions_founder_and_deletion_guard(
    settings: Settings,
    clock: FrozenClock,
    session_factory: sessionmaker[Session],
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BILLING_PROVIDER", "fake")
    config.get_settings.cache_clear()
    try:
        with session_factory() as s:
            ws_a, users_a = workspace_with_members(
                s, roles=("owner", "manager", "staff"), slug="iso-a", currency="TRY"
            )
            ws_b, _ = workspace_with_members(
                s, roles=(), slug="iso-b", currency="USD", market="global"
            )
            # Same owner user owns BOTH workspaces (so Dodo shares one customer_id!)
            from tests.factories import add_member

            add_member(s, ws_b, users_a["owner"], "owner")
            stranger = create_user(s, display_name="Stranger")
            s.commit()

        with _fake_app(settings, clock) as client:
            owner_headers = login(client, users_a["owner"])

            # Subscribe ws_a via dev simulator
            chk_a = client.post(
                f"/api/v1/workspaces/{ws_a.id}/billing/checkout",
                headers=owner_headers,
                json={"plan": "growth", "interval": "monthly"},
            ).json()
            sim = client.post(
                "/api/v1/dev/billing/simulate",
                headers=owner_headers,
                json={"ref": chk_a["ref"], "outcome": "active"},
            )
            assert sim.status_code == 200, sim.text

            # ws_a is active; ws_b (same owner email & customer_id!) stays on trial!
            view_a = client.get(f"/api/v1/workspaces/{ws_a.id}/billing").json()
            view_b = client.get(f"/api/v1/workspaces/{ws_b.id}/billing").json()
            assert view_a["status"] == "active" and view_a["currency"] == "TRY"
            assert view_b["status"] == "trial" and view_b["currency"] == "USD"

            # Double-subscription refusal on ws_a (409 BILLING_ALREADY_SUBSCRIBED)
            dup = client.post(
                f"/api/v1/workspaces/{ws_a.id}/billing/checkout",
                headers=owner_headers,
                json={"plan": "pro", "interval": "monthly"},
            )
            assert dup.status_code == 409
            assert dup.json()["code"] == "BILLING_ALREADY_SUBSCRIBED"

            # Workspace deletion guard refuses active subscription on ws_a
            del_blocked = client.post(
                f"/api/v1/workspaces/{ws_a.id}/delete-request",
                headers=owner_headers,
            )
            assert del_blocked.status_code == 409
            assert del_blocked.json()["code"] == "BILLING_SUBSCRIPTION_ACTIVE"

            # Founder eligibility: ws_b cannot see or buy founder until CLI enables it
            assert view_b["founder_offer"] is None
            founder_denied = client.post(
                f"/api/v1/workspaces/{ws_b.id}/billing/checkout",
                headers=owner_headers,
                json={"plan": "founder", "interval": "monthly"},
            )
            assert founder_denied.status_code == 403

            assert cli_main(["billing-founder", "--workspace", "iso-b", "--on"]) == 0
            capsys.readouterr()
            view_b_founder = client.get(f"/api/v1/workspaces/{ws_b.id}/billing").json()
            assert view_b_founder["founder_offer"]["amount_display"] == "990 ₺"
            founder_ok = client.post(
                f"/api/v1/workspaces/{ws_b.id}/billing/checkout",
                headers=owner_headers,
                json={"plan": "founder", "interval": "monthly"},
            )
            assert founder_ok.status_code == 200

            # Manager sees GET /billing (can_manage=False), gets 403 on checkout & portal
            mgr_headers = login(client, users_a["manager"])
            mgr_view = client.get(f"/api/v1/workspaces/{ws_a.id}/billing")
            assert mgr_view.status_code == 200 and mgr_view.json()["can_manage"] is False
            assert (
                client.post(
                    f"/api/v1/workspaces/{ws_a.id}/billing/checkout",
                    headers=mgr_headers,
                    json={"plan": "pro", "interval": "monthly"},
                ).status_code
                == 403
            )
            assert (
                client.post(
                    f"/api/v1/workspaces/{ws_a.id}/billing/portal", headers=mgr_headers
                ).status_code
                == 403
            )

            # Staff gets 403 on GET /billing
            login(client, users_a["staff"])
            assert client.get(f"/api/v1/workspaces/{ws_a.id}/billing").status_code == 403

            # Stranger gets 404 on foreign workspace (INV-01)
            stranger_headers = login(client, stranger)
            assert client.get(f"/api/v1/workspaces/{ws_a.id}/billing").status_code == 404
            assert (
                client.post(
                    f"/api/v1/workspaces/{ws_a.id}/billing/checkout",
                    headers=stranger_headers,
                    json={"plan": "starter", "interval": "monthly"},
                ).status_code
                == 404
            )
            assert (
                client.post(
                    f"/api/v1/workspaces/{ws_a.id}/billing/portal", headers=stranger_headers
                ).status_code
                == 404
            )
    finally:
        monkeypatch.setenv("BILLING_PROVIDER", "none")
        config.get_settings.cache_clear()


def test_deadlines_non_utc_timezone_reconciliation_and_notification_channels(
    settings: Settings,
    clock: FrozenClock,
    session_factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BILLING_PROVIDER", "fake")
    config.get_settings.cache_clear()
    try:
        # Channel registration rules: pushed + Telegram, NOT WhatsApp
        assert {"billing.trial_ending", "billing.payment_failed", "billing.paused"} <= set(
            PUSH_TYPES
        )
        assert {
            "billing.trial_ending",
            "billing.payment_failed",
            "billing.paused",
            "billing.activated",
        } <= TELEGRAM_TYPES
        assert not any(t.startswith("billing.") for t in WHATSAPP_TYPES)

        with session_factory() as s:
            ws, users = workspace_with_members(
                s,
                roles=("owner", "manager"),
                timezone="America/New_York",
                slug="tz-deadline-ws",
            )
            set_tenant_context(s, ws.id)
            row = plans_service.get_plan(s, clock, ws.id)
            # Trial ends in 2 days -> inside 3-day warning horizon
            row.trial_ends_at = clock.now() + timedelta(days=2)
            s.commit()

        scheduler_tick(session_factory, clock)
        run_due_jobs(clock, session_factory=session_factory)

        with session_factory() as s:
            set_tenant_context(s, ws.id)
            warns = list(
                s.scalars(
                    select(Notification).where(
                        Notification.workspace_id == ws.id,
                        Notification.type == "billing.trial_ending",
                    )
                ).all()
            )
            assert {n.recipient_user_id for n in warns} == {
                users["owner"].id,
                users["manager"].id,
            }
            push = build_payload(warns[0], "tr")
            assert push.url == f"/w/{ws.id}/more/settings/billing"
            assert deep_link(warns[0]) == f"/w/{ws.id}/more/settings/billing"

        # Advance past trial end -> billing.paused fires once
        clock.advance(days=2, hours=2)
        scheduler_tick(session_factory, clock)
        run_due_jobs(clock, session_factory=session_factory)

        with session_factory() as s:
            set_tenant_context(s, ws.id)
            paused_notifs = list(
                s.scalars(
                    select(Notification).where(
                        Notification.workspace_id == ws.id,
                        Notification.type == "billing.paused",
                    )
                ).all()
            )
            assert len(paused_notifs) == 2

            # Seed a subscription stuck on past_due locally -> reconcile fixes it to active
            s.add(
                BillingAccount(
                    workspace_id=ws.id,
                    dodo_subscription_id="sub_recon_1",
                    dodo_customer_id="cus_recon_1",
                    product_key="pro_monthly",
                    provider_status="past_due",
                    is_simulated=True,
                )
            )
            s.commit()

        set_fake_subscription(
            SubscriptionSnapshot(
                subscription_id="sub_recon_1",
                customer_id="cus_recon_1",
                brand_id=PIVORIS_BRAND_ID,
                product_id="pdt_0Nsqsx7NRkeGfrSgJx8mI",
                status="active",
                next_billing_date=clock.now() + timedelta(days=30),
            )
        )
        clock.advance(days=1)
        scheduler_tick(session_factory, clock)
        run_due_jobs(clock, session_factory=session_factory)

        with session_factory() as s:
            set_tenant_context(s, ws.id)
            row = plans_service.get_plan(s, clock, ws.id)
            assert (row.plan, row.status, row.access_until) == ("pro", "active", None)
    finally:
        clear_fake_subscriptions()
        monkeypatch.setenv("BILLING_PROVIDER", "none")
        config.get_settings.cache_clear()


def test_blocked_workspace_still_receives_inbox_messages_and_notifies_humans(
    settings: Settings,
    clock: FrozenClock,
    session_factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When blocked by BILLING_INACTIVE, inbound messages still land in inbox and notify humans."""
    from app.demo import simulator

    monkeypatch.setenv("BILLING_PROVIDER", "fake")
    config.get_settings.cache_clear()
    try:
        cfg = settings.model_copy(update={"billing_provider": "fake", "demo_tools_enabled": True})
        with session_factory() as s:
            ws, users = workspace_with_members(s, slug="blocked-inbox-ws")
            set_tenant_context(s, ws.id)
            from app.operations.accounts import connect_mock
            from tests.factories import knowledge_ctx

            connect_mock(
                s,
                clock,
                knowledge_ctx(ws, users["owner"], "owner"),
                cfg,
                username="blocked_studio",
            )
            row = plans_service.get_plan(s, clock, ws.id)
            row.trial_ends_at = clock.now() - timedelta(days=1)  # already expired!
            s.commit()

            # Sandbox test chat still works when BILLING_INACTIVE (checks quota only, not billing)
            from app.inbox import sandbox

            turn = sandbox.submit_message(
                s,
                clock,
                cfg,
                knowledge_ctx(ws, users["owner"], "owner"),
                users["owner"].id,
                "Merhaba, saatleriniz nedir?",
            )
            s.commit()
            assert turn.id is not None

        prepared = simulator.prepare_customer_message(
            session_factory,
            clock,
            cfg,
            ws.id,
            customer_alias="ayse",
            text="Merhaba, fiyat nedir?",
            attachments=[],
        )
        with TestClient(create_app(cfg, clock)) as client:
            wh = client.post(
                "/webhooks/instagram/mock",
                content=prepared.body,
                headers={"Content-Type": "application/json", **prepared.headers},
            )
            assert wh.status_code == 200
            run_due_jobs(clock, session_factory=session_factory)
            clock.advance(seconds=15)
            run_due_jobs(clock, session_factory=session_factory)

            owner_headers = login(client, users["owner"])
            convos = client.get(f"/api/v1/workspaces/{ws.id}/conversations").json()["items"]
            assert len(convos) == 1
            assert convos[0]["attention"] == "needs_human"

            # Content generation is refused with 402 BILLING_INACTIVE
            gen = client.post(
                f"/api/v1/workspaces/{ws.id}/content-items/generate",
                headers=owner_headers,
                json={
                    "content_type": "feed_image",
                    "objective": "Weekend pilates",
                    "client_request_id": "gen-blocked-1",
                },
            )
            assert gen.status_code == 402
            assert gen.json()["code"] == "BILLING_INACTIVE"

        with session_factory() as s:
            set_tenant_context(s, ws.id)
            human_notifs = list(
                s.scalars(
                    select(Notification).where(
                        Notification.workspace_id == ws.id,
                        Notification.type == "conversation.needs_human",
                    )
                ).all()
            )
            assert len(human_notifs) >= 1
    finally:
        monkeypatch.setenv("BILLING_PROVIDER", "none")
        config.get_settings.cache_clear()
