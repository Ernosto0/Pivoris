"""Operator commands for a workspace's plan and billing overrides.

``plan-usage``, ``plan-set``, ``plan-reset``, ``plan-extend``, ``plan-trial`` and
``billing-exempt``; registered by ``app.cli``. Each prints the workspace's usage as one JSON line
and exits 0, or prints an error and exits 1.
"""

import argparse
import json
import sys
from datetime import timedelta

from app.audit import service as audit
from app.core.clock import SystemClock
from app.core.context import ActorRef, WorkspaceContext
from app.core.db import get_session_factory, set_tenant_context
from app.identity.repository import get_workspace_by_slug
from app.plans import service
from app.plans.router import view
from app.plans.tiers import STATUSES, TIERS


def run(args: argparse.Namespace) -> int:
    clock = SystemClock()
    with get_session_factory()() as db:
        workspace = get_workspace_by_slug(db, args.workspace)
        if workspace is None:
            print("error: workspace not found", file=sys.stderr)
            return 1
        set_tenant_context(db, workspace.id)
        ctx = WorkspaceContext(
            workspace_id=workspace.id,
            actor=ActorRef.system("cli"),
            role=None,
            timezone=workspace.timezone,
            locale=workspace.default_locale,
            is_demo=workspace.is_demo,
        )
        row = service.get_plan(db, clock, workspace.id)
        if args.command == "plan-set":
            if args.quota is not None and args.quota < 1:
                print("error: --quota must be positive", file=sys.stderr)
                return 1
            row.plan, row.monthly_quota = args.plan, TIERS[args.plan]
            if args.quota is not None:
                row.quota_override = args.quota
            if args.clear_override:
                row.quota_override = None
            if args.status is not None:
                row.status = args.status
            # A higher allowance resumes drafting at once (the paused state is computed); a
            # lower one may cross a threshold, which warns like any other crossing.
            service.warnings(db, clock, row)
        elif args.command == "plan-reset":
            # A fresh period starting now: usage back to zero, the warnings armed again.
            row.period_start = clock.now()
            row.anchor_day = row.period_start.day
            row.period_end = service.next_month(row.period_start, row.anchor_day)
            service.reset_usage(row)
        elif args.command == "plan-extend":
            if args.days < 1:
                print("error: --days must be positive", file=sys.stderr)
                return 1
            # The period lasts longer and later periods follow its new end date. Usage is kept.
            row.period_end += timedelta(days=args.days)
            row.anchor_day = row.period_end.day
        elif args.command == "plan-trial":
            if args.days < 0:
                print("error: --days must not be negative", file=sys.stderr)
                return 1
            row.trial_ends_at = clock.now() + timedelta(days=args.days)
            row.warned_trial_ending = False
            row.warned_billing_paused = False
            audit.record(
                db,
                ctx,
                "billing.plan_trial_set",
                "workspace_plan",
                workspace.id,
                {"days": args.days, "trial_ends_at": row.trial_ends_at.isoformat()},
                clock=clock,
            )
        elif args.command == "billing-exempt":
            row.billing_exempt = bool(args.on)
            audit.record(
                db,
                ctx,
                "billing.exempt_changed",
                "workspace_plan",
                workspace.id,
                {"billing_exempt": row.billing_exempt},
                clock=clock,
            )
        result = view(row, now=clock.now(), is_demo=workspace.is_demo)
        db.commit()
    print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False))
    return 0


def register(sub: "argparse._SubParsersAction[argparse.ArgumentParser]") -> None:
    helps = {
        "plan-usage": "show a workspace's plan and this period's AI reply usage",
        "plan-set": "set a workspace's plan, quota override and status",
        "plan-reset": "start a fresh period now with zero usage",
        "plan-extend": "make the current period end later (usage is kept)",
        "plan-trial": "set trial_ends_at relative to now (in days)",
        "billing-exempt": "turn billing exemption on or off for a workspace",
    }
    for name, help_text in helps.items():
        parser = sub.add_parser(name, help=help_text)
        parser.add_argument("--workspace", required=True, help="the workspace slug")
        parser.set_defaults(func=run)
        if name == "plan-set":
            parser.add_argument("--plan", required=True, choices=tuple(TIERS))
            override = parser.add_mutually_exclusive_group()
            override.add_argument("--quota", type=int, help="monthly quota override for this one")
            override.add_argument(
                "--clear-override", action="store_true", help="use the plan's own quota"
            )
            parser.add_argument("--status", choices=STATUSES)
        elif name in ("plan-extend", "plan-trial"):
            parser.add_argument("--days", type=int, required=True)
        elif name == "billing-exempt":
            toggle = parser.add_mutually_exclusive_group(required=True)
            toggle.add_argument("--on", action="store_true", help="exempt from billing blocks")
            toggle.add_argument("--off", action="store_true", help="enforce normal billing rules")
