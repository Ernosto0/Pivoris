"""Hosted subscription billing models (ADR-029).

``BillingAccount`` and ``BillingCheckout`` are tenant-scoped Category C tables under forced RLS.
``BillingWebhookEvent`` is a global Category A ingress deduplication ledger storing PII-scrubbed
event payloads.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    WorkspaceScopedMixin,
    workspace_unique_constraint,
)


class BillingAccount(UUIDPrimaryKeyMixin, WorkspaceScopedMixin, TimestampMixin, Base):
    __tablename__ = "billing_accounts"
    __table_args__ = (
        UniqueConstraint("workspace_id"),
        UniqueConstraint("dodo_subscription_id"),
        workspace_unique_constraint(),
    )

    dodo_customer_id: Mapped[str | None] = mapped_column(Text, default=None)
    dodo_subscription_id: Mapped[str | None] = mapped_column(Text, default=None)
    product_key: Mapped[str | None] = mapped_column(Text, default=None)
    provider_status: Mapped[str | None] = mapped_column(Text, default=None)
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    past_due_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    last_event_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    conflict_subscription_id: Mapped[str | None] = mapped_column(Text, default=None)
    founder_eligible: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))


class BillingCheckout(UUIDPrimaryKeyMixin, WorkspaceScopedMixin, Base):
    __tablename__ = "billing_checkouts"
    __table_args__ = (
        UniqueConstraint("ref"),
        workspace_unique_constraint(),
    )

    ref: Mapped[str] = mapped_column(Text, nullable=False)
    product_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'ignored', 'unmatched', 'applied')",
            name="status",
        ),
        Index("ix_billing_webhook_events_received_at", "received_at"),
    )

    webhook_id: Mapped[str] = mapped_column(Text, primary_key=True)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), index=True, default=None
    )
    subscription_id: Mapped[str | None] = mapped_column(Text, default=None)
    event_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=None)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
