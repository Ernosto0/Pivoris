"""Operator CLI command ``billing-founder`` for Founder (Kurucu) plan eligibility (ADR-029)."""

from __future__ import annotations

import argparse
import json
import sys

from app.audit import service as audit
from app.core.clock import SystemClock
from app.core.context import ActorRef, WorkspaceContext
from app.core.db import get_session_factory, set_tenant_context
from app.hosted.billing.service import get_or_create_account
from app.identity.repository import get_workspace_by_slug


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
        acct = get_or_create_account(db, workspace.id)
        acct.founder_eligible = bool(args.on)
        audit.record(
            db,
            ctx,
            "billing.subscription_updated",
            "billing_account",
            acct.id,
            {"founder_eligible": acct.founder_eligible},
            clock=clock,
        )
        out = {
            "workspace": workspace.slug,
            "workspace_id": str(workspace.id),
            "founder_eligible": acct.founder_eligible,
        }
        db.commit()
    print(json.dumps(out, ensure_ascii=False))
    return 0


def register(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser(
        "billing-founder",
        help="enable or disable Founder (Kurucu) plan eligibility for a workspace",
    )
    parser.add_argument("--workspace", required=True, help="the workspace slug")
    toggle = parser.add_mutually_exclusive_group(required=True)
    toggle.add_argument("--on", action="store_true", help="allow Founder plan checkout")
    toggle.add_argument("--off", action="store_true", help="disallow Founder plan checkout")
    parser.set_defaults(func=run)
