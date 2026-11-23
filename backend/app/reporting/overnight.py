"""Deterministic SQL aggregation for overnight morning briefings (INV-01, INV-08, INV-09, INV-19).

Reads other modules' **models** only (never services or LLM). Computes exact counts for the
overnight window — from yesterday's evening report (``daily_report_hour`` local time, or the
stored ``DailyReport.period_end`` if a scheduled report ran) up to ``now`` — plus current
pending approvals/questions and today's scheduled Instagram posts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.approvals.models import Approval
from app.content.models import ContentItem
from app.core.clock import Clock
from app.core.context import WorkspaceContext
from app.inbox.models import Message
from app.owner_requests.models import OwnerQuestion
from app.reporting.models import DailyReport
from app.reporting.periods import day_bounds, local_date_of


@dataclass(frozen=True)
class OvernightBriefingFacts:
    """Strictly grounded, non-PII facts for an overnight morning briefing."""

    local_date: date
    timezone: str
    window_start: datetime
    window_end: datetime
    customers_talked: int
    questions_answered: int
    booking_enquiries: int
    pricing_enquiries: int
    pending_approvals: int
    pending_owner_questions: int
    today_scheduled_post_times: tuple[str, ...]  # local "HH:MM" strings, sorted
    has_simulated_data: bool

    @property
    def is_quiet(self) -> bool:
        """True when nothing happened overnight and nothing awaits the owner today."""
        return (
            self.customers_talked == 0
            and self.questions_answered == 0
            and self.booking_enquiries == 0
            and self.pricing_enquiries == 0
            and self.pending_approvals == 0
            and self.pending_owner_questions == 0
            and len(self.today_scheduled_post_times) == 0
        )

    def to_narration_params(self) -> dict[str, Any]:
        """Structured numeric/time dict safe to pass to the briefing narrator (INV-03, INV-08)."""
        return {
            "local_date": self.local_date.isoformat(),
            "customers_talked": self.customers_talked,
            "questions_answered": self.questions_answered,
            "booking_enquiries": self.booking_enquiries,
            "pricing_enquiries": self.pricing_enquiries,
            "pending_approvals": self.pending_approvals,
            "pending_owner_questions": self.pending_owner_questions,
            "scheduled_posts_today": len(self.today_scheduled_post_times),
            "scheduled_post_times": list(self.today_scheduled_post_times),
        }


def overnight_window(
    session: Session,
    ctx: WorkspaceContext,
    now: datetime,
    daily_report_hour: int,
) -> tuple[date, datetime, datetime]:
    """Compute ``(local_today, window_start_utc, window_end_utc)`` in the workspace timezone.

    Starts at yesterday's stored ``DailyReport.period_end`` if a report was generated for
    yesterday, otherwise yesterday at ``daily_report_hour:00`` in ``ctx.timezone``.
    """
    tz = ZoneInfo(ctx.timezone)
    local_today = local_date_of(now, ctx.timezone)
    yesterday = local_today - timedelta(days=1)

    stored_yesterday = session.scalar(
        select(DailyReport)
        .where(
            DailyReport.workspace_id == ctx.workspace_id,
            DailyReport.local_date == yesterday,
        )
        .order_by(DailyReport.revision.desc())
        .limit(1)
    )
    if stored_yesterday is not None and stored_yesterday.period_end < now:
        window_start = stored_yesterday.period_end
    else:
        local_start = datetime.combine(yesterday, time(hour=daily_report_hour), tzinfo=tz)
        window_start = local_start.astimezone(ZoneInfo("UTC"))

    if window_start > now:
        # Guard against unusual clock/timezone edge cases.
        window_start = now - timedelta(hours=12)

    return local_today, window_start, now


def today_scheduled_post_times(
    session: Session,
    ctx: WorkspaceContext,
    local_today: date,
    now: datetime,
) -> tuple[tuple[str, ...], bool]:
    """Return sorted local ``HH:MM`` times of remaining posts scheduled for ``local_today``."""
    tz = ZoneInfo(ctx.timezone)
    _, day_end = day_bounds(local_today, ctx.timezone)
    rows = session.execute(
        select(ContentItem.scheduled_at, ContentItem.is_simulated)
        .where(
            ContentItem.workspace_id == ctx.workspace_id,
            ContentItem.status == "scheduled",
            ContentItem.scheduled_at.is_not(None),
            ContentItem.scheduled_at >= now,
            ContentItem.scheduled_at < day_end,
        )
        .order_by(ContentItem.scheduled_at.asc())
    ).all()
    times: list[str] = []
    simulated = False
    for scheduled_at, is_sim in rows:
        if scheduled_at is not None:
            times.append(scheduled_at.astimezone(tz).strftime("%H:%M"))
        if is_sim:
            simulated = True
    return tuple(times), simulated


def compute_overnight_facts(
    session: Session,
    clock: Clock,
    ctx: WorkspaceContext,
    *,
    daily_report_hour: int = 20,
) -> OvernightBriefingFacts:
    """Aggregate overnight DM, enquiry, approval, question, and scheduled-post facts via SQL."""
    now = clock.now()
    local_today, start, end = overnight_window(session, ctx, now, daily_report_hour)

    # 1. Distinct customer conversations active overnight (inbound or business_app outbound).
    active_convs_row = session.execute(
        select(
            func.count(func.distinct(Message.conversation_id)),
            func.coalesce(func.bool_or(Message.is_simulated), False),
        ).where(
            Message.workspace_id == ctx.workspace_id,
            Message.is_deleted.is_(False),
            Message.provider_timestamp >= start,
            Message.provider_timestamp < end,
            or_(
                Message.direction == "inbound",
                (Message.direction == "outbound") & (Message.sender_kind == "business_app"),
            ),
        )
    ).one()
    customers_talked = int(active_convs_row[0] or 0)
    sim_messages = bool(active_convs_row[1])

    # 2. Questions answered (replies sent by the business app overnight).
    replies_row = session.execute(
        select(
            func.count(Message.id),
            func.coalesce(func.bool_or(Message.is_simulated), False),
        ).where(
            Message.workspace_id == ctx.workspace_id,
            Message.direction == "outbound",
            Message.sender_kind == "business_app",
            Message.provider_timestamp >= start,
            Message.provider_timestamp < end,
        )
    ).one()
    questions_answered = int(replies_row[0] or 0)
    sim_replies = bool(replies_row[1])

    # 3. Distinct conversations with booking or pricing enquiries overnight.
    booking_enquiries = int(
        session.scalar(
            select(func.count(func.distinct(Message.conversation_id))).where(
                Message.workspace_id == ctx.workspace_id,
                Message.direction == "inbound",
                Message.is_deleted.is_(False),
                Message.agent_enquiry_intent == "booking",
                Message.provider_timestamp >= start,
                Message.provider_timestamp < end,
            )
        )
        or 0
    )
    pricing_enquiries = int(
        session.scalar(
            select(func.count(func.distinct(Message.conversation_id))).where(
                Message.workspace_id == ctx.workspace_id,
                Message.direction == "inbound",
                Message.is_deleted.is_(False),
                Message.agent_enquiry_intent == "pricing",
                Message.provider_timestamp >= start,
                Message.provider_timestamp < end,
            )
        )
        or 0
    )

    # 4. Pending approvals right now (non-expired).
    approvals_row = session.execute(
        select(
            func.count(Approval.id),
            func.coalesce(func.bool_or(Approval.is_simulated), False),
        ).where(
            Approval.workspace_id == ctx.workspace_id,
            Approval.status == "pending",
            Approval.expires_at > now,
        )
    ).one()
    pending_approvals = int(approvals_row[0] or 0)
    sim_approvals = bool(approvals_row[1])

    # 5. Open owner questions right now (non-expired).
    pending_owner_questions = int(
        session.scalar(
            select(func.count(OwnerQuestion.id)).where(
                OwnerQuestion.workspace_id == ctx.workspace_id,
                OwnerQuestion.state == "pending",
                OwnerQuestion.expires_at > now,
            )
        )
        or 0
    )

    # 6. Today's scheduled Instagram posts.
    post_times, sim_posts = today_scheduled_post_times(session, ctx, local_today, now)

    return OvernightBriefingFacts(
        local_date=local_today,
        timezone=ctx.timezone,
        window_start=start,
        window_end=end,
        customers_talked=customers_talked,
        questions_answered=questions_answered,
        booking_enquiries=booking_enquiries,
        pricing_enquiries=pricing_enquiries,
        pending_approvals=pending_approvals,
        pending_owner_questions=pending_owner_questions,
        today_scheduled_post_times=post_times,
        has_simulated_data=sim_messages or sim_replies or sim_approvals or sim_posts,
    )
