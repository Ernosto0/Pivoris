"""``GET /workspaces/{id}/usage``: the plan and this period's AI reply usage (owner, manager)."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_clock, require_membership
from app.core.clock import Clock, SystemClock
from app.core.config import get_settings
from app.core.context import WorkspaceContext
from app.core.db import get_db
from app.plans import service
from app.plans.models import WorkspacePlan

router = APIRouter(prefix="/workspaces/{workspace_id}/usage", tags=["plans"])


class UsageOut(BaseModel):
    plan: Literal["starter", "growth", "pro"]
    status: Literal["trial", "active", "past_due", "cancelled"]
    monthly_quota: int  # the plan's own quota
    quota_override: int | None  # an operator's per-workspace quota, when set
    quota: int  # what applies: the override, else the plan's
    used: int
    grace_limit: int  # drafting pauses at this many (the quota plus 10%)
    period_start: datetime
    period_end: datetime
    # normal < warning (80%) < grace (100%, drafting continues) < paused (the grace is used up)
    state: Literal["normal", "warning", "grace", "paused"]
    trial_ends_at: datetime
    access_until: datetime | None
    billing_exempt: bool
    block_reason: Literal["BILLING_INACTIVE", "REPLY_QUOTA_PAUSED"] | None


def view(
    row: WorkspacePlan,
    *,
    now: datetime | None = None,
    is_demo: bool = False,
    billing_on: bool | None = None,
) -> UsageOut:
    instant = now or SystemClock().now()
    enabled = get_settings().billing_enabled if billing_on is None else billing_on
    reason = service.block_reason(row, instant, billing_on=enabled, is_demo=is_demo)
    block: Literal["BILLING_INACTIVE", "REPLY_QUOTA_PAUSED"] | None = None
    if reason == "BILLING_INACTIVE":
        block = "BILLING_INACTIVE"
    elif reason == "REPLY_QUOTA_PAUSED":
        block = "REPLY_QUOTA_PAUSED"
    return UsageOut(
        plan=row.plan,
        status=row.status,
        monthly_quota=row.monthly_quota,
        quota_override=row.quota_override,
        quota=service.quota(row),
        used=row.used,
        grace_limit=service.limit(row),
        period_start=row.period_start,
        period_end=row.period_end,
        state=service.state(row),
        trial_ends_at=row.trial_ends_at,
        access_until=row.access_until,
        billing_exempt=bool(row.billing_exempt),
        block_reason=block,
    )


@router.get("", response_model=UsageOut)
def get_usage(
    ctx: WorkspaceContext = Depends(require_membership("system_health.view")),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> UsageOut:
    row = service.get_plan(db, clock, ctx.workspace_id)
    result = view(row, now=clock.now(), is_demo=ctx.is_demo)
    db.commit()
    return result
