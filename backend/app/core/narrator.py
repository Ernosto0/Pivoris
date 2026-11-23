"""Natural assistant narrations for command results (INV-08).

Transforms structured CommandResult payloads into conversational, human-like speech in
English and Turkish. Every metric/value is preserved exactly from the computed facts/SQL.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.i18n import t

_METRIC_AFTER_CUES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("replies_auto", re.compile(r"^\s*(?:otomatik|automatically)\b", re.IGNORECASE)),
    (
        "replies_approved",
        re.compile(r"^\s*(?:onayınızla|after your approval|approved)\b", re.IGNORECASE),
    ),
    (
        "replies_by_owner",
        re.compile(r"^\s*(?:tanesini doğrudan siz|yourself)\b", re.IGNORECASE),
    ),
    (
        "escalations",
        re.compile(r"^\s*(?:konuşma size devredildi|handed over|escalated)\b", re.IGNORECASE),
    ),
    ("attention_now", re.compile(r"^\s*(?:konu var|needing attention)\b", re.IGNORECASE)),
    ("pending_approvals", re.compile(r"^\s*(?:pending approvals?|bekleyen onay)\b", re.IGNORECASE)),
    (
        "inbound_messages",
        re.compile(r"^\s*(?:incoming\s+(?:dm|message)s?|gelen\s+(?:dm|mesaj))\b", re.IGNORECASE),
    ),
    (
        "conversations",
        re.compile(r"^\s*(?:conversations?|farklı konuşma)\b", re.IGNORECASE),
    ),
    (
        "replies_sent",
        re.compile(
            r"^\s*(?:replies?\s+were\s+sent|yanıt\s+gönderildi|mesaja\s+yanıt\s+verildi)\b",
            re.IGNORECASE,
        ),
    ),
    ("reach", re.compile(r"^\s*(?:kişiye ulaştı|accounts)\b", re.IGNORECASE)),
    ("views", re.compile(r"^\s*(?:görüntülenme|views?)\b", re.IGNORECASE)),
    ("interactions", re.compile(r"^\s*(?:etkileşim|interactions?)\b", re.IGNORECASE)),
)
_METRIC_BEFORE_CUES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("attention_now", re.compile(r"ilgilenmeniz gereken\s*$", re.IGNORECASE)),
    ("reach", re.compile(r"\breached\s*$", re.IGNORECASE)),
)


def _extract_numbers(text: str) -> list[int]:
    """Extract integer numbers from text (e.g. '11', '7000', '5')."""
    return [int(m) for m in re.findall(r"\b\d+\b", text)]


def validate_metrics_grounding(
    narrated_text: str, params: dict[str, Any], user_query: str = ""
) -> list[str]:
    """Verify INV-08: narrated text never invents numbers or misattributes metrics."""
    allowed_numbers: set[int] = set()
    for v in params.values():
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            allowed_numbers.add(int(v))
        elif isinstance(v, str):
            for n in _extract_numbers(v):
                allowed_numbers.add(n)

    if "replies_auto" in params or "replies_approved" in params:
        auto = int(params.get("replies_auto") or 0)
        approved = int(params.get("replies_approved") or 0)
        allowed_numbers.add(auto + approved)

    query_numbers = set(_extract_numbers(user_query))
    allowed_numbers.update(query_numbers)

    problems: list[str] = []
    for match in re.finditer(r"\b(\d+)\b", narrated_text):
        num = int(match.group(1))
        if num not in allowed_numbers:
            problems.append(
                f"Number {num} in narration is not grounded in command params {allowed_numbers}"
            )
            continue

        # Bind metric labels adjacent to this number to the specific field value in params.
        if num in query_numbers:
            continue
        after_clause = re.split(r"[,.;()\n]", narrated_text[match.end() : match.end() + 40])[0]
        before_start = max(0, match.start() - 32)
        before_clause = re.split(r"[,.;()\n]", narrated_text[before_start : match.start()])[-1]

        matched_field: str | None = None
        for field, pat in _METRIC_AFTER_CUES:
            if pat.search(after_clause):
                matched_field = field
                break
        if matched_field is None:
            for field, pat in _METRIC_BEFORE_CUES:
                if pat.search(before_clause):
                    matched_field = field
                    break

        if matched_field is not None and matched_field in params:
            expected_val = int(params[matched_field] or 0)
            if num != expected_val:
                problems.append(
                    f"Number {num} is attributed to '{matched_field}' (expected {expected_val})"
                )

    return problems


def narrate_fallback(
    message_key: str,
    params: dict[str, Any],
    user_locale: str = "en",
    user_query: str = "",
) -> str:
    """Generate a conversational, natural assistant sentence for any command result."""
    locale = "tr" if user_locale.lower().startswith("tr") else "en"
    key = message_key.replace("command.", "")

    if key == "activity_summary":
        return _narrate_activity_summary(params, locale, user_query)
    if key == "insights_summary":
        if params.get("status") in {"partial", "syncing", "not_granted"}:
            return (
                "Instagram performans verileri henüz tam değil. Eksik günler sıfır olarak sayılmaz."
                if locale == "tr"
                else "Instagram performance history is incomplete or unavailable. "
                "Missing days are not counted as zero."
            )
        reach = int(params.get("reach") or 0)
        views = int(params.get("views") or 0)
        interactions = int(params.get("interactions") or 0)
        days = int(params.get("days") or 7)
        if locale == "tr":
            return (
                f"Son {days} günde içerikleriniz toplam {reach} kişiye ulaştı, "
                f"{views} görüntülenme ve {interactions} etkileşim aldı."
            )
        return (
            f"Over the last {days} days, your content reached {reach} accounts, "
            f"with {views} views and {interactions} interactions."
        )
    if key == "pending_approvals":
        count = int(params.get("count") or 0)
        if count == 0:
            return (
                "Şu an onayınızı bekleyen hiçbir işlem yok, her şey güncel!"
                if locale == "tr"
                else "Nothing is waiting for approval right now, you're all caught up!"
            )
        if locale == "tr":
            return f"Şu an inceleyip onaylamanızı bekleyen {count} adet işlem var."
        return (
            f"You have {count} item{'s' if count > 1 else ''} waiting for your approval right now."
        )
    if key == "fact_value":
        label = params.get("label", "")
        display = params.get("display", "")
        if locale == "tr":
            return f"{label} bilgisi şu anda {display} olarak kayıtlı."
        return f"The current {label} is set to {display}."
    if key == "fact_updated":
        label = params.get("label", "")
        new_val = params.get("new_display", "")
        if locale == "tr":
            return f"{label} bilgisini {new_val} olarak güncelledim."
        return f"I've updated the {label} to {new_val}."
    if key == "fact_unchanged":
        label = params.get("label", "")
        display = params.get("display", "")
        if locale == "tr":
            return f"{label} zaten {display} olarak kayıtlı, herhangi bir değişiklik gerekmedi."
        return f"The {label} is already {display}, so no changes were needed."
    if key == "content_status":
        title = params.get("title", "")
        status_label = params.get("statusLabel") or params.get("status", "")
        if locale == "tr":
            return f"'{title}' içeriğinizin güncel durumu: {status_label}."
        return f"Your post '{title}' is currently {status_label}."
    if key in {
        "price_card_started",
        "price_card_no_price",
        "price_card_not_a_price",
        "price_card_fact_unusable",
    }:
        return t(f"command.{key}", locale, **params)
    if key == "draft_created":
        title = params.get("title", "")
        if locale == "tr":
            return (
                f"'{title}' başlıklı taslağınızı hazırladım. İçerik bölümünden inceleyebilirsiniz."
            )
        return f"I've prepared the draft '{title}' for you. You can review it under Content."

    if key == "content_rescheduled":
        title, when = params.get("title", ""), params.get("when", "")
        return (
            f"{title} için yeni zaman: {when}."
            if locale == "tr"
            else f"{title} is now scheduled for {when}."
        )
    if key == "agent_paused_until":
        when = params.get("when", "")
        return (
            f"Asistan {when} tarihine kadar duraklatıldı."
            if locale == "tr"
            else f"Assistant paused until {when}."
        )
    if key == "management_refused":
        return (
            "Değişiklik uygulanamadı. Güncel durumu ve zamanı kontrol edip yeniden deneyin."
            if locale == "tr"
            else "The change could not be applied. Check the current state and time, then retry."
        )

    # General fallback
    return ""


def _narrate_activity_summary(params: dict[str, Any], locale: str, user_query: str) -> str:
    period = str(params.get("period", "today"))
    inbound = int(params.get("inbound_messages") or 0)
    conversations = int(params.get("conversations") or 0)
    replies_sent = int(params.get("replies_sent") or 0)
    replies_auto = int(params.get("replies_auto") or 0)
    replies_approved = int(params.get("replies_approved") or 0)
    replies_by_owner = int(params.get("replies_by_owner") or 0)
    escalations = int(params.get("escalations") or 0)
    attention_now = int(params.get("attention_now") or 0)

    assistant_replies = replies_auto + replies_approved
    q_lower = user_query.lower()
    asking_dm_answers = any(
        w in q_lower for w in ("answer", "yanıtla", "cevapla", "reply", "replies")
    )

    if locale == "tr":
        period_str = (
            "Bugün" if period == "today" else ("Dün" if period == "yesterday" else "Son 7 günde")
        )

        # When user specifically asks how many DMs were answered:
        if asking_dm_answers:
            if replies_sent == 0:
                base = f"{period_str} henüz hiçbir mesaja yanıt verilmedi."
            else:
                details = []
                if assistant_replies > 0:
                    details.append(
                        f"{assistant_replies} tanesini ben "
                        f"({replies_auto} otomatik, {replies_approved} onayınızla)"
                    )
                if replies_by_owner > 0:
                    details.append(f"{replies_by_owner} tanesini doğrudan siz")
                detail_str = " ve ".join(details) if details else ""
                base = f"{period_str} toplam {replies_sent} mesaja yanıt verildi ({detail_str})."
        else:
            if inbound == 0:
                base = f"{period_str} gelen yeni mesaj olmadı."
            else:
                base = (
                    f"{period_str} {conversations} farklı konuşmada "
                    f"toplam {inbound} gelen mesaj aldık ve {replies_sent} yanıt gönderildi."
                )

        tail = []
        if escalations > 0:
            tail.append(f"{escalations} konuşma size devredildi")
        if attention_now > 0:
            tail.append(f"şu an ilgilenmeniz gereken {attention_now} konu var")
        elif attention_now == 0:
            tail.append("şu an ilgi bekleyen herhangi bir konu bulunmuyor")

        tail_str = f" ({', '.join(tail)})." if tail else "."
        return f"{base}{tail_str}"

    else:
        period_str = (
            "today"
            if period == "today"
            else ("yesterday" if period == "yesterday" else "this week")
        )
        cap_period = period_str.capitalize()

        if asking_dm_answers:
            if replies_sent == 0:
                base = f"No messages were replied to {period_str}."
            else:
                parts = []
                if assistant_replies > 0:
                    parts.append(
                        f"I handled {assistant_replies} "
                        f"({replies_auto} automatically, {replies_approved} after your approval)"
                    )
                if replies_by_owner > 0:
                    parts.append(f"you answered {replies_by_owner} yourself")
                joined_parts = " and ".join(parts) if parts else ""
                conv_suffix = "s" if conversations != 1 else ""
                base = (
                    f"Across {conversations} conversation{conv_suffix} {period_str}, "
                    f"a total of {replies_sent} replies were sent—{joined_parts}."
                )
        else:
            if inbound == 0:
                base = f"{cap_period} you received no new incoming messages."
            else:
                msg_suffix = "s" if inbound != 1 else ""
                conv_suffix = "s" if conversations != 1 else ""
                base = (
                    f"{cap_period} you received {inbound} incoming message{msg_suffix} "
                    f"across {conversations} conversation{conv_suffix}, "
                    f"and {replies_sent} replies were sent."
                )

        tail = []
        if escalations > 0:
            tail.append(f"{escalations} handed over to you")
        if attention_now > 0:
            tail.append(f"{attention_now} needing attention right now")
        elif attention_now == 0:
            tail.append("everything is caught up right now")

        tail_str = f" ({', '.join(tail)})." if tail else "."
        return f"{base}{tail_str}"


_TIME_PATTERN = re.compile(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)\b")


def validate_briefing_grounding(narrated_text: str, facts: dict[str, Any]) -> list[str]:
    """Verify INV-08 for morning/evening briefings: every number and clock time is grounded."""
    if not narrated_text or not narrated_text.strip():
        return ["Briefing narration is empty"]

    allowed_numbers: set[int] = set()
    allowed_times: set[str] = set()

    for key, val in facts.items():
        if key == "scheduled_post_times" and isinstance(val, (list, tuple)):
            for raw_t in val:
                if isinstance(raw_t, str):
                    m = _TIME_PATTERN.fullmatch(raw_t.strip())
                    if m:
                        hh, mm = int(m.group(1)), int(m.group(2))
                        allowed_times.add(f"{hh:02d}:{mm:02d}")
                        allowed_numbers.add(hh)
                        allowed_numbers.add(mm)
        elif isinstance(val, (int, float)) and not isinstance(val, bool):
            allowed_numbers.add(int(val))
        elif isinstance(val, str):
            for n in _extract_numbers(val):
                allowed_numbers.add(n)

    problems: list[str] = []

    # Check every clock time like 18:00 or 18.00 is explicitly in scheduled_post_times.
    for match in _TIME_PATTERN.finditer(narrated_text):
        hh, mm = int(match.group(1)), int(match.group(2))
        normalized = f"{hh:02d}:{mm:02d}"
        if normalized not in allowed_times:
            problems.append(
                f"Time {match.group(0)} in briefing is not in scheduled_post_times "
                f"{sorted(allowed_times)}"
            )

    # Check every integer token is grounded in facts.
    for match in re.finditer(r"\b(\d+)\b", narrated_text):
        num = int(match.group(1))
        if num not in allowed_numbers:
            problems.append(
                f"Number {num} in briefing is not grounded in facts {sorted(allowed_numbers)}"
            )

    return problems


def _format_post_times_tr(times: list[str]) -> str:
    formatted = [t.replace(":", ".") for t in times]
    if len(formatted) == 1:
        return f"Bugünkü Instagram paylaşımınız saat {formatted[0]}'e planlandı."
    joined = ", ".join(formatted[:-1]) + f" ve {formatted[-1]}"
    return f"Bugün {len(formatted)} Instagram paylaşımınız saat {joined} için planlandı."


def _format_post_times_en(times: list[str]) -> str:
    if len(times) == 1:
        return f"Today's Instagram post is scheduled for {times[0]}."
    joined = ", ".join(times[:-1]) + f" and {times[-1]}"
    return f"You have {len(times)} Instagram posts scheduled today at {joined}."


def narrate_briefing_fallback(
    briefing_kind: str,
    facts: dict[str, Any],
    user_locale: str = "tr",
) -> str:
    """Deterministic, warm natural-language briefing used for fake LLM and error fallback."""
    locale = "tr" if user_locale.lower().startswith("tr") else "en"
    post_times = [str(t) for t in (facts.get("scheduled_post_times") or []) if isinstance(t, str)]

    if briefing_kind == "morning":
        customers = int(facts.get("customers_talked") or 0)
        answered = int(facts.get("questions_answered") or 0)
        bookings = int(facts.get("booking_enquiries") or 0)
        pricing = int(facts.get("pricing_enquiries") or 0)
        approvals = int(facts.get("pending_approvals") or 0)
        questions = int(facts.get("pending_owner_questions") or 0)

        if locale == "tr":
            lines = ["Günaydın! 🌤️"]
            if customers > 0:
                lines.append(f"Dün akşam siz yokken {customers} müşteriyle konuştum.")
            if answered > 0:
                lines.append(f"{answered} kişinin sorusunu yanıtladım.")
            if bookings > 0:
                lines.append(f"{bookings} kişi randevu hakkında bilgi istedi.")
            if pricing > 0:
                lines.append(f"{pricing} kişi fiyat hakkında bilgi sordu.")
            if approvals > 0:
                lines.append(f"{approvals} konuşma için onayınızı bekliyorum.")
            if questions > 0:
                lines.append(f"{questions} soru için cevabınızı bekliyorum.")
            if post_times:
                lines.append(_format_post_times_tr(post_times))
            if len(lines) == 1:
                lines.append("Dün akşam yeni bir hareket olmadı, her şey yolunda.")
            return "\n\n".join(lines)

        lines = ["Good morning! 🌤️"]
        if customers > 0:
            noun = "customer" if customers == 1 else "customers"
            lines.append(f"While you were away last night, I spoke with {customers} {noun}.")
        if answered > 0:
            noun = "question" if answered == 1 else "questions"
            lines.append(f"I answered {answered} {noun}.")
        if bookings > 0:
            noun = "person" if bookings == 1 else "people"
            lines.append(f"{bookings} {noun} asked about appointments.")
        if pricing > 0:
            noun = "person" if pricing == 1 else "people"
            lines.append(f"{pricing} {noun} asked about pricing.")
        if approvals > 0:
            noun = "item is" if approvals == 1 else "items are"
            lines.append(f"{approvals} {noun} waiting for your approval.")
        if questions > 0:
            noun = "question is" if questions == 1 else "questions are"
            lines.append(f"{questions} {noun} waiting for your answer.")
        if post_times:
            lines.append(_format_post_times_en(post_times))
        if len(lines) == 1:
            lines.append("It was a quiet night with no new activity—everything is caught up.")
        return "\n\n".join(lines)

    # Evening daily report narration
    inbound = int(facts.get("inbound_messages") or 0)
    conversations = int(facts.get("conversations") or 0)
    replies_sent = int(facts.get("replies_sent") or 0)
    approvals = int(facts.get("pending_approvals") or 0)
    published = int(facts.get("content_published") or 0)
    scheduled_24h = int(facts.get("content_scheduled_next_24h") or 0)

    if locale == "tr":
        lines = ["İyi akşamlar! 🌙"]
        if inbound > 0 or replies_sent > 0:
            if conversations > 0:
                lines.append(
                    f"Bugün {conversations} müşteriyle toplam {inbound} mesaj aldık "
                    f"ve {replies_sent} yanıt gönderdim."
                )
            else:
                lines.append(
                    f"Bugün toplam {inbound} yeni mesaj geldi ve {replies_sent} yanıt gönderildi."
                )
        else:
            lines.append("Bugün yeni bir müşteri mesajı gelmedi.")
        if published > 0:
            lines.append(f"Bugün {published} Instagram paylaşımı yayınlandı.")
        if approvals > 0:
            lines.append(f"Şu an onayınızı bekleyen {approvals} işlem var.")
        if post_times:
            lines.append(_format_post_times_tr(post_times))
        elif scheduled_24h > 0:
            lines.append(f"Önümüzdeki 24 saat için {scheduled_24h} paylaşım planlandı.")
        return "\n\n".join(lines)

    lines = ["Good evening! 🌙"]
    if inbound > 0 or replies_sent > 0:
        if conversations > 0:
            c_noun = "customer" if conversations == 1 else "customers"
            m_noun = "message" if inbound == 1 else "messages"
            r_noun = "reply" if replies_sent == 1 else "replies"
            lines.append(
                f"Today we received {inbound} {m_noun} across {conversations} {c_noun} "
                f"and sent {replies_sent} {r_noun}."
            )
        else:
            m_noun = "message" if inbound == 1 else "messages"
            r_noun = "reply" if replies_sent == 1 else "replies"
            lines.append(f"Today we received {inbound} {m_noun} and sent {replies_sent} {r_noun}.")
    else:
        lines.append("No new customer messages arrived today.")
    if published > 0:
        p_noun = "post was" if published == 1 else "posts were"
        lines.append(f"{published} Instagram {p_noun} published today.")
    if approvals > 0:
        a_noun = "item is" if approvals == 1 else "items are"
        lines.append(f"{approvals} {a_noun} waiting for your approval right now.")
    if post_times:
        lines.append(_format_post_times_en(post_times))
    elif scheduled_24h > 0:
        s_noun = "post is" if scheduled_24h == 1 else "posts are"
        lines.append(f"{scheduled_24h} {s_noun} scheduled in the next 24 hours.")
    return "\n\n".join(lines)
