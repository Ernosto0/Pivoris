"""Unit tests for overnight briefing config, quiet-night skipping, and channel rendering."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock

from app.core.clock import FrozenClock
from app.integrations.channels.base import ChannelRecipient
from app.integrations.channels.telegram.adapter import TelegramChannel
from app.integrations.channels.whatsapp import templates as wa_templates
from app.integrations.channels.whatsapp.adapter import WhatsAppChannel
from app.integrations.channels.whatsapp.client import WhatsAppSendResult
from app.notifications.models import Notification, NotificationDelivery
from app.reporting.jobs import (
    morning_briefing_dedup_key,
    morning_briefing_enabled,
    morning_briefing_hour,
)
from app.reporting.overnight import OvernightBriefingFacts

NOW = datetime(2026, 11, 23, 6, 0, tzinfo=UTC)  # 09:00 Europe/Istanbul


def test_morning_briefing_settings_helpers() -> None:
    assert morning_briefing_enabled(None) is True
    assert morning_briefing_enabled({"morning_briefing_enabled": False}) is False
    assert morning_briefing_hour(None) == 9
    assert morning_briefing_hour({"morning_briefing_hour": 8}) == 8
    assert morning_briefing_hour({"morning_briefing_hour": 23}) == 9  # out of 5..12 -> default
    ws_id = uuid.uuid4()
    assert morning_briefing_dedup_key(ws_id, date(2026, 11, 23)) == (
        f"morning_briefing:{ws_id}:2026-11-23"
    )


def test_overnight_facts_quiet_detection() -> None:
    quiet = OvernightBriefingFacts(
        local_date=date(2026, 11, 23),
        timezone="Europe/Istanbul",
        window_start=NOW - timedelta(hours=13),
        window_end=NOW,
        customers_talked=0,
        questions_answered=0,
        booking_enquiries=0,
        pricing_enquiries=0,
        pending_approvals=0,
        pending_owner_questions=0,
        today_scheduled_post_times=(),
        has_simulated_data=False,
    )
    assert quiet.is_quiet is True

    active = OvernightBriefingFacts(
        local_date=date(2026, 11, 23),
        timezone="Europe/Istanbul",
        window_start=NOW - timedelta(hours=13),
        window_end=NOW,
        customers_talked=0,
        questions_answered=0,
        booking_enquiries=0,
        pricing_enquiries=0,
        pending_approvals=0,
        pending_owner_questions=0,
        today_scheduled_post_times=("18:00",),
        has_simulated_data=False,
    )
    assert active.is_quiet is False


def test_telegram_delivers_natural_morning_briefing_with_buttons() -> None:
    ws_id = uuid.uuid4()
    user_id = uuid.uuid4()
    notif_id = uuid.uuid4()
    narrated = "Günaydın! 🌤️\n\nDün akşam siz yokken 12 müşteriyle konuştum."
    notification = Notification(
        id=notif_id,
        workspace_id=ws_id,
        recipient_user_id=user_id,
        type="report.morning_briefing_ready",
        severity="info",
        params={
            "local_date": "2026-11-23",
            "customers_talked": 12,
            "questions_answered": 8,
            "booking_enquiries": 3,
            "pending_approvals": 1,
            "narrated_tr": narrated,
            "narrated_en": "Good morning! 🌤️",
        },
        is_simulated=False,
    )
    delivery = NotificationDelivery(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        notification_id=notif_id,
        recipient_user_id=user_id,
        channel="telegram",
        status="pending",
        delivery_metadata={},
    )
    recipient = ChannelRecipient(
        user_id=user_id,
        workspace_id=ws_id,
        channel="telegram",
        channel_user_id="12345",
        channel_chat_id="12345",
        ui_locale="tr",
        timezone="Europe/Istanbul",
    )

    session = MagicMock()
    session.get.return_value = notification
    tg_client = MagicMock()
    tg_client.send_message.return_value = {"message_id": 777}

    channel = TelegramChannel(client=tg_client)
    res = channel.deliver_notification(session, FrozenClock(NOW), delivery, recipient)

    assert res.success is True
    assert res.status == "delivered"
    call_kwargs = tg_client.send_message.call_args.kwargs
    assert narrated in call_kwargs["text"]
    assert "customers_talked" not in call_kwargs["text"]
    buttons = call_kwargs["reply_markup"]["inline_keyboard"][0]
    assert len(buttons) == 2  # Open Report + Open Approvals


def test_whatsapp_uses_narrated_text_in_session_and_template_outside() -> None:
    ws_id = uuid.uuid4()
    user_id = uuid.uuid4()
    notif_id = uuid.uuid4()
    link_id = uuid.uuid4()
    narrated = "Günaydın! 🌤️\n\nDün akşam siz yokken 12 müşteriyle konuştum."

    notification = Notification(
        id=notif_id,
        workspace_id=ws_id,
        recipient_user_id=user_id,
        type="report.morning_briefing_ready",
        severity="info",
        params={
            "local_date": "2026-11-23",
            "customers_talked": 12,
            "questions_answered": 8,
            "booking_enquiries": 3,
            "pending_approvals": 1,
            "narrated_tr": narrated,
        },
        is_simulated=False,
    )
    recipient = ChannelRecipient(
        user_id=user_id,
        workspace_id=ws_id,
        channel="whatsapp",
        channel_user_id="905551112233",
        channel_chat_id="905551112233",
        ui_locale="tr",
        timezone="Europe/Istanbul",
    )

    settings = MagicMock()
    settings.whatsapp_configured = True
    settings.whatsapp_templates_approved = True

    # 1. Inside 24h session window -> sends natural narrated text via send_text
    link_in_window = MagicMock(
        id=link_id,
        workspace_id=ws_id,
        user_id=user_id,
        channel="whatsapp",
        status="active",
        channel_chat_id="905551112233",
        channel_user_id="905551112233",
        last_inbound_at=NOW - timedelta(hours=2),
    )
    delivery_session = NotificationDelivery(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        notification_id=notif_id,
        recipient_user_id=user_id,
        channel="whatsapp",
        channel_link_id=link_id,
        status="pending",
        delivery_metadata={},
    )
    session = MagicMock()
    session.get.side_effect = [notification, link_in_window]
    wa_client = MagicMock()
    wa_client.send_text.return_value = WhatsAppSendResult(message_id="wamid.session")

    channel = WhatsAppChannel(client=wa_client, settings=settings)
    res_session = channel.deliver_notification(
        session, FrozenClock(NOW), delivery_session, recipient
    )
    assert res_session.success is True
    wa_client.send_text.assert_called_once_with("905551112233", narrated)

    # 2. Outside 24h window -> sends approved utility template pivoris_morning_briefing_v1
    link_out_window = MagicMock(
        id=link_id,
        workspace_id=ws_id,
        user_id=user_id,
        channel="whatsapp",
        status="active",
        channel_chat_id="905551112233",
        channel_user_id="905551112233",
        last_inbound_at=NOW - timedelta(hours=30),
    )
    delivery_tpl = NotificationDelivery(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        notification_id=notif_id,
        recipient_user_id=user_id,
        channel="whatsapp",
        channel_link_id=link_id,
        status="pending",
        delivery_metadata={},
    )
    session2 = MagicMock()
    session2.get.side_effect = [notification, link_out_window]
    wa_client2 = MagicMock()
    wa_client2.send_template.return_value = WhatsAppSendResult(message_id="wamid.tpl")

    channel2 = WhatsAppChannel(client=wa_client2, settings=settings)
    res_tpl = channel2.deliver_notification(session2, FrozenClock(NOW), delivery_tpl, recipient)
    assert res_tpl.success is True
    tpl = wa_templates.BY_TYPE["report.morning_briefing_ready"]
    wa_client2.send_template.assert_called_once_with(
        "905551112233", tpl.name, "tr", ["12", "8", "3", "1"]
    )
