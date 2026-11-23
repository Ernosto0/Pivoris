"""Unit tests for LLM briefing narration and strict INV-08 grounding."""

from __future__ import annotations

from app.ai.tasks.narrate_briefing import (
    NARRATE_BRIEFING,
    NarrateBriefingInput,
    NarrateBriefingOutput,
    _fake_narrate_briefing,
)
from app.core.narrator import narrate_briefing_fallback, validate_briefing_grounding

SAMPLE_MORNING_FACTS = {
    "local_date": "2026-11-23",
    "customers_talked": 12,
    "questions_answered": 8,
    "booking_enquiries": 3,
    "pricing_enquiries": 0,
    "pending_approvals": 1,
    "pending_owner_questions": 0,
    "scheduled_posts_today": 1,
    "scheduled_post_times": ["18:00"],
}


def test_morning_fallback_tr_matches_natural_assistant_style_and_grounds() -> None:
    text = narrate_briefing_fallback("morning", SAMPLE_MORNING_FACTS, user_locale="tr")
    assert "Günaydın!" in text
    assert "12 müşteriyle konuştum" in text
    assert "8 kişinin sorusunu yanıtladım" in text
    assert "3 kişi randevu hakkında bilgi istedi" in text
    assert "1 konuşma için onayınızı bekliyorum" in text
    assert "18.00" in text
    assert validate_briefing_grounding(text, SAMPLE_MORNING_FACTS) == []


def test_morning_fallback_en_grounds_and_omits_zero_items() -> None:
    text = narrate_briefing_fallback("morning", SAMPLE_MORNING_FACTS, user_locale="en")
    assert "Good morning!" in text
    assert "12 customers" in text
    assert "8 questions" in text
    assert "3 people asked about appointments" in text
    assert "1 item is waiting for your approval" in text
    assert "18:00" in text
    assert "pricing" not in text.lower()
    assert validate_briefing_grounding(text, SAMPLE_MORNING_FACTS) == []


def test_grounding_rejects_invented_number_and_wrong_post_time() -> None:
    bad_num = "Günaydın! Dün akşam 99 müşteriyle konuştum."
    problems = validate_briefing_grounding(bad_num, SAMPLE_MORNING_FACTS)
    assert any("99" in p for p in problems)

    bad_time = "Günaydın! Bugünkü paylaşımınız saat 19.30'a planlandı."
    time_problems = validate_briefing_grounding(bad_time, SAMPLE_MORNING_FACTS)
    assert any("19.30" in p for p in time_problems)


def test_fake_implementation_passes_task_post_validate() -> None:
    for kind, facts in (
        ("morning", SAMPLE_MORNING_FACTS),
        (
            "evening",
            {
                "local_date": "2026-11-23",
                "inbound_messages": 15,
                "conversations": 10,
                "replies_sent": 14,
                "pending_approvals": 2,
                "content_published": 1,
                "content_scheduled_next_24h": 1,
                "scheduled_post_times": ["18:00"],
            },
        ),
    ):
        for locale in ("tr", "en"):
            inp = NarrateBriefingInput(
                briefing_kind=kind,  # type: ignore[arg-type]
                locale=locale,  # type: ignore[arg-type]
                local_date="2026-11-23",
                facts=facts,
            )
            out = _fake_narrate_briefing(inp, NarrateBriefingOutput)
            assert NARRATE_BRIEFING.post_validate(inp, out) == []
