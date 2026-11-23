"""``generate_daily_report``: the scheduled daily report (workflows.md section F, ADR-006).

Every scheduler tick looks at the active workspaces. One whose **local** time has reached its
``daily_report_hour`` (default 20:00) gets exactly one job for that local day, keyed
``daily_report:{workspace}:{local_date}``. The dedup key only covers queued and running jobs, so
the tick also looks for any job with that key: a finished (or dead) job means the day is done and
the tick must not enqueue it again every minute.
"""

import uuid
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.ai.runtime import runner_deps
from app.ai.tasks.narrate_briefing import narrate_briefing_text
from app.core.clock import Clock
from app.core.context import ActorRef, WorkspaceContext
from app.identity.models import Workspace
from app.jobs.models import Job
from app.jobs.queue import enqueue
from app.jobs.registry import JobContext, job_handler
from app.jobs.scheduler import register_periodic
from app.notifications import service as notifications
from app.reporting import missed_customers, overnight, service

DEFAULT_REPORT_HOUR = 20
DEFAULT_MORNING_BRIEFING_HOUR = 9
MORNING_BRIEFING_READY = "report.morning_briefing_ready"
# The weekly missed-customer report of the week that just ended is made on Monday from 09:00 local.
MISSED_CUSTOMER_REPORT_HOUR = 9


class GenerateDailyReportPayload(BaseModel):
    workspace_id: uuid.UUID
    local_date: date


class GenerateMorningBriefingPayload(BaseModel):
    workspace_id: uuid.UUID
    local_date: date


def dedup_key(workspace_id: uuid.UUID, local_date: date) -> str:
    return f"daily_report:{workspace_id}:{local_date.isoformat()}"


def morning_briefing_dedup_key(workspace_id: uuid.UUID, local_date: date) -> str:
    return f"morning_briefing:{workspace_id}:{local_date.isoformat()}"


def report_hour(settings: dict[str, object] | None) -> int:
    """The workspace's ``daily_report_hour`` (0-23); a missing or invalid value means 20."""
    value = (settings or {}).get("daily_report_hour", DEFAULT_REPORT_HOUR)
    if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 23:
        return value
    return DEFAULT_REPORT_HOUR


def morning_briefing_enabled(settings: dict[str, object] | None) -> bool:
    """Whether the workspace wants overnight morning briefings (defaults to True)."""
    value = (settings or {}).get("morning_briefing_enabled", True)
    return value if isinstance(value, bool) else True


def morning_briefing_hour(settings: dict[str, object] | None) -> int:
    """The workspace's ``morning_briefing_hour`` (5-12); a missing or invalid value means 9."""
    value = (settings or {}).get("morning_briefing_hour", DEFAULT_MORNING_BRIEFING_HOUR)
    if isinstance(value, int) and not isinstance(value, bool) and 5 <= value <= 12:
        return value
    return DEFAULT_MORNING_BRIEFING_HOUR


@job_handler("generate_daily_report", GenerateDailyReportPayload, max_attempts=3)
def generate_daily_report(job: JobContext) -> None:
    payload = job.payload
    if not isinstance(payload, GenerateDailyReportPayload):
        return
    with job.session_factory() as session:
        workspace = session.get(Workspace, payload.workspace_id)
        if workspace is None or workspace.status != "active":
            return  # gone or suspended meanwhile: nothing to report
        ctx = WorkspaceContext(
            workspace.id,
            ActorRef.system("reporting.daily"),
            None,
            workspace.timezone,
            workspace.default_locale,
            workspace.is_demo,
        )
        report = service.generate_daily_report(
            session, job.clock, ctx, payload.local_date, scheduled=True, notify=False
        )
        post_times, _ = overnight.today_scheduled_post_times(
            session, ctx, payload.local_date, job.clock.now()
        )
        session.commit()

    # Narrate outside any DB transaction (no external LLM call inside a DB tx).
    evening_facts = {
        "local_date": report.local_date.isoformat(),
        "inbound_messages": int(report.value("inbound_messages") or 0),
        "conversations": int(report.value("conversations_with_inbound") or 0),
        "replies_sent": int(report.value("replies_sent") or 0),
        "pending_approvals": int(report.value("pending_approvals_now") or 0),
        "content_published": int(report.value("content_published") or 0),
        "content_scheduled_next_24h": int(report.value("content_scheduled_next_24h") or 0),
        "scheduled_post_times": list(post_times),
    }
    deps = runner_deps(job.session_factory, job.clock)
    narrated_tr = narrate_briefing_text(
        deps,
        ctx,
        briefing_kind="evening",
        locale="tr",
        local_date=report.local_date.isoformat(),
        facts=evening_facts,
    )
    narrated_en = narrate_briefing_text(
        deps,
        ctx,
        briefing_kind="evening",
        locale="en",
        local_date=report.local_date.isoformat(),
        facts=evening_facts,
    )

    with job.session_factory() as session:
        service.announce_daily_report(
            session,
            job.clock,
            ctx,
            report,
            extra_params={"narrated_tr": narrated_tr, "narrated_en": narrated_en},
        )
        session.commit()


@job_handler("generate_morning_briefing", GenerateMorningBriefingPayload, max_attempts=3)
def generate_morning_briefing(job: JobContext) -> None:
    payload = job.payload
    if not isinstance(payload, GenerateMorningBriefingPayload):
        return
    with job.session_factory() as session:
        workspace = session.get(Workspace, payload.workspace_id)
        if workspace is None or workspace.status != "active":
            return
        if not morning_briefing_enabled(workspace.settings):
            return
        ctx = WorkspaceContext(
            workspace.id,
            ActorRef.system("reporting.morning_briefing"),
            None,
            workspace.timezone,
            workspace.default_locale,
            workspace.is_demo,
        )
        facts = overnight.compute_overnight_facts(
            session,
            job.clock,
            ctx,
            daily_report_hour=report_hour(workspace.settings),
        )
        if facts.is_quiet:
            return  # Quiet night (0 activity, 0 pending, 0 scheduled posts today): skip noise.

    # Narrate outside any DB transaction.
    narration_params = facts.to_narration_params()
    deps = runner_deps(job.session_factory, job.clock)
    narrated_tr = narrate_briefing_text(
        deps,
        ctx,
        briefing_kind="morning",
        locale="tr",
        local_date=facts.local_date.isoformat(),
        facts=narration_params,
    )
    narrated_en = narrate_briefing_text(
        deps,
        ctx,
        briefing_kind="morning",
        locale="en",
        local_date=facts.local_date.isoformat(),
        facts=narration_params,
    )

    with job.session_factory() as session:
        notifications.notify_permission_holders(
            session,
            job.clock,
            ctx,
            permission="reports.view",
            type=MORNING_BRIEFING_READY,
            severity="info",
            params={
                **narration_params,
                "narrated_tr": narrated_tr,
                "narrated_en": narrated_en,
            },
            subject_type="morning_briefing",
            subject_id=None,
            dedup_key=f"morning-briefing:{facts.local_date.isoformat()}",
            is_simulated=facts.has_simulated_data,
        )
        session.commit()


@register_periodic
def enqueue_morning_briefings(session: Session, clock: Clock) -> int:
    """Enqueue one morning briefing per active workspace once local time reaches its hour."""
    now = clock.now()
    rows = session.execute(
        select(Workspace.id, Workspace.timezone, Workspace.settings).where(
            Workspace.status == "active"
        )
    ).all()
    enqueued = 0
    for workspace_id, timezone, settings in rows:
        if not morning_briefing_enabled(settings):
            continue
        local_now = now.astimezone(ZoneInfo(timezone))
        if local_now.hour < morning_briefing_hour(settings):
            continue
        local_date = local_now.date()
        key = morning_briefing_dedup_key(workspace_id, local_date)
        if session.scalar(select(exists().where(Job.dedup_key == key))):
            continue
        enqueue(
            session,
            "generate_morning_briefing",
            GenerateMorningBriefingPayload(workspace_id=workspace_id, local_date=local_date),
            workspace_id=workspace_id,
            correlation_id=None,
            dedup_key=key,
            clock=clock,
        )
        enqueued += 1
    return enqueued


@register_periodic
def enqueue_daily_reports(session: Session, clock: Clock) -> int:
    now = clock.now()
    rows = session.execute(
        select(Workspace.id, Workspace.timezone, Workspace.settings).where(
            Workspace.status == "active"
        )
    ).all()
    enqueued = 0
    for workspace_id, timezone, settings in rows:
        local_now = now.astimezone(ZoneInfo(timezone))
        if local_now.hour < report_hour(settings):
            continue
        local_date = local_now.date()
        key = dedup_key(workspace_id, local_date)
        if session.scalar(select(exists().where(Job.dedup_key == key))):
            continue  # queued, running, done or dead: this day has had its job
        enqueue(
            session,
            "generate_daily_report",
            GenerateDailyReportPayload(workspace_id=workspace_id, local_date=local_date),
            workspace_id=workspace_id,
            correlation_id=None,
            dedup_key=key,
            clock=clock,
        )
        enqueued += 1
    return enqueued


class GenerateMissedCustomerReportPayload(BaseModel):
    workspace_id: uuid.UUID
    week_start: date  # the local Monday of the week to report


def missed_customer_dedup_key(workspace_id: uuid.UUID, week_start: date) -> str:
    return f"missed_customer_report:{workspace_id}:{week_start.isoformat()}"


@job_handler("generate_missed_customer_report", GenerateMissedCustomerReportPayload, max_attempts=3)
def generate_missed_customer_report(job: JobContext) -> None:
    payload = job.payload
    if not isinstance(payload, GenerateMissedCustomerReportPayload):
        return
    with job.session_factory() as session:
        workspace = session.get(Workspace, payload.workspace_id)
        if workspace is None or workspace.status != "active":
            return  # gone or suspended meanwhile: nothing to report
        ctx = WorkspaceContext(
            workspace.id,
            ActorRef.system("reporting.missed_customers"),
            None,
            workspace.timezone,
            workspace.default_locale,
            workspace.is_demo,
        )
        missed_customers.generate_weekly_report(session, job.clock, ctx, payload.week_start)
        session.commit()


@register_periodic
def enqueue_missed_customer_reports(session: Session, clock: Clock) -> int:
    """One job per workspace and finished local week, from Monday 09:00 local until the next
    Monday. The dedup key also covers finished jobs (as the daily report does), so a week is
    never made twice; a worker that was down on Monday still catches the week up."""
    now = clock.now()
    rows = session.execute(
        select(Workspace.id, Workspace.timezone).where(Workspace.status == "active")
    ).all()
    enqueued = 0
    for workspace_id, timezone in rows:
        local_now = now.astimezone(ZoneInfo(timezone))
        monday = missed_customers.week_start_of(local_now.date())
        if local_now.date() == monday and local_now.hour < MISSED_CUSTOMER_REPORT_HOUR:
            continue
        week_start = monday - timedelta(days=7)
        key = missed_customer_dedup_key(workspace_id, week_start)
        if session.scalar(select(exists().where(Job.dedup_key == key))):
            continue
        enqueue(
            session,
            "generate_missed_customer_report",
            GenerateMissedCustomerReportPayload(workspace_id=workspace_id, week_start=week_start),
            workspace_id=workspace_id,
            correlation_id=None,
            dedup_key=key,
            clock=clock,
        )
        enqueued += 1
    return enqueued
