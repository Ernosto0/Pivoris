"""Workspace billing routes (``/api/v1/workspaces/{workspace_id}/billing``)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import enforce_csrf, get_app_settings, get_clock, require_membership
from app.core.clock import Clock
from app.core.config import Settings
from app.core.context import WorkspaceContext
from app.core.db import get_db
from app.hosted.billing import service
from app.hosted.billing.service import BillingOut, CheckoutIn, CheckoutOut, PortalOut


def create_hosted_billing_api_router() -> APIRouter:
    router = APIRouter(
        prefix="/api/v1/workspaces/{workspace_id}/billing",
        tags=["billing"],
        dependencies=[Depends(enforce_csrf)],
    )

    @router.get("", response_model=BillingOut)
    def get_billing(
        ctx: WorkspaceContext = Depends(require_membership("system_health.view")),
        db: Session = Depends(get_db),
        clock: Clock = Depends(get_clock),
        settings: Settings = Depends(get_app_settings),
    ) -> BillingOut:
        result = service.get_billing_view(db, clock, settings, ctx)
        db.commit()
        return result

    @router.post("/checkout", response_model=CheckoutOut)
    def create_checkout(
        body: CheckoutIn,
        ctx: WorkspaceContext = Depends(require_membership("billing.manage")),
        db: Session = Depends(get_db),
        clock: Clock = Depends(get_clock),
        settings: Settings = Depends(get_app_settings),
    ) -> CheckoutOut:
        return service.start_checkout(db, clock, settings, ctx, body)

    @router.post("/portal", response_model=PortalOut)
    def create_portal(
        ctx: WorkspaceContext = Depends(require_membership("billing.manage")),
        db: Session = Depends(get_db),
        clock: Clock = Depends(get_clock),
        settings: Settings = Depends(get_app_settings),
    ) -> PortalOut:
        return service.open_portal(db, clock, settings, ctx)

    return router
