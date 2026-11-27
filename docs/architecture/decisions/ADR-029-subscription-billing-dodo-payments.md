# ADR-029: Subscription billing via Dodo Payments in optional hosted module

- **Status:** Accepted (Feature Phase 6, 2026-11-27)
- **Date:** 2026-11-27

## Context
Pivoris previously tracked AI reply allowances in `workspace_plans` (`starter`, `growth`, `pro`) without enforcing `status` or collecting recurring payments. Pilot billing relied on manual bank transfers (EFT/Havale) and CLI overrides.

To launch commercial subscriptions in both **Türkiye** (TRY + KDV) and **Global** (USD + tax) markets from a single codebase while preserving the open-source core boundary ([ADR-019](ADR-019-open-source-and-hosted-boundary.md)), we need:
1. A Merchant of Record capable of localized fixed TRY pricing in Türkiye and USD pricing elsewhere, tax/VAT collection, invoicing, hosted checkout, and self-service plan/card/cancellation management.
2. Provider-agnostic trial and access enforcement in `app/plans/` that is completely disabled (`BILLING_PROVIDER=none`) for self-hosted deployments.
3. Strict adherence to workspace isolation ([INV-01](../../invariants.md)), secret redaction ([INV-10](../../invariants.md)), auditability ([INV-12](../../invariants.md)), verified-outcome UI reporting ([INV-18](../../invariants.md)), and no external network calls inside database transactions.

## Decisions

### 1. Hosted module boundary (`app/hosted/billing/`)
- Billing provider logic, catalog pricing, checkout/portal routes, webhook ingestion, reconciliation, and billing notification copy live in `backend/app/hosted/billing/`.
- `BILLING_PROVIDER` selects `none` (default, self-hosted), `fake` (local development and deterministic CI/demo, refused in production), or `dodo` (hosted SaaS).
- Core modules (`app/plans/`, `app/inbox/`, `app/agent/`, `app/comments/`, `app/content/`, `app/policy/`) **never** import `app.hosted`. Import-linter enforces that only `app.main`, `app.cli`, `app.handlers`, and `app.api.router` may import `app.hosted`, and only `app.hosted.billing.dodo` may import `dodopayments`.

### 2. Provider-agnostic enforcement in `app/plans/`
- `workspace_plans` gains `trial_ends_at` (not null), `access_until` (nullable), and `billing_exempt` (boolean, default false).
- Pure function `block_reason(row, now, *, billing_on, is_demo)` returns `"BILLING_INACTIVE"`, `"REPLY_QUOTA_PAUSED"`, or `None`:
  - Billing blocks only when `billing_on` (`billing_provider != "none"`) is true, `is_demo` is false, and `row.billing_exempt` is false.
  - `status == "trial"` and `now >= trial_ends_at` → `"BILLING_INACTIVE"`.
  - `status != "trial"` with `access_until is not None` and `now >= access_until` → `"BILLING_INACTIVE"`.
  - `status == "active"` with `access_until is None` → allowed (falls through to quota check).
- When blocked by `BILLING_INACTIVE`:
  - AI customer reply drafting (`draft_reply`, Account Agent DM/comment/private-reply turns) and AI content generation (`draft_content`) stop without calling the LLM.
  - Inbound messages still land in the inbox and trigger human notifications; scheduled posts already approved still publish; the interactive sandbox test chat continues to check only the reply quota and daily LLM cap.

### 3. INV-15 scope clarification for hosted billing session links
- [INV-15](../../invariants.md) requires every customer-facing or account-mutating external side effect (Instagram messaging, publishing, moderation, OAuth token refresh, calendar mutations) to run through `app/operations/` with a committed `operations` ledger row and reconciliation.
- Hosted billing calls (`checkout_sessions.create` and `customers.customer_portal.create`) mint ephemeral hosted redirect URLs; they do not mutate Instagram state or charge cards directly—charges and subscription state transitions occur on Dodo's hosted pages and arrive via signed webhooks (backed up by daily read-only `get_subscription` reconciliation).
- Accordingly, billing session creation does not create social-account `operations` rows. Instead:
  1. `POST /billing/checkout` commits a `billing_checkouts` row (`ref`, `workspace_id`, `product_key`, `created_by`, `expires_at`) and an `audit_logs` row (`billing.checkout_created`) **before** opening any external HTTP call.
  2. `POST /billing/portal` commits an `audit_logs` row (`billing.portal_opened`) and calls Dodo **outside any DB transaction**.
  3. Import-linter and AST source-scan tests enforce that `dodopayments` SDK methods are called **only** inside `app/hosted/billing/dodo.py`, and contract tests assert `not db_session.in_transaction()` during every provider call.

### 4. Payment-failure grace via Dodo `past_due`
- Rather than running a parallel grace timer in Pivoris, payment-failure grace uses Dodo Payments' native Subscription Grace Period configured to **7 days**.
- On `subscription.past_due`, Dodo emits `past_due_ends_at` on the subscription snapshot; Pivoris stores `past_due_ends_at` on `billing_accounts` and sets `workspace_plans.status = 'past_due'` and `workspace_plans.access_until = past_due_ends_at`.
- Access continues throughout the 7-day window while Dodo runs dunning and payment retries. If unpaid at expiry, Dodo transitions the subscription to `on_hold` or `cancelled` (and even if that webhook is delayed, `now >= access_until` stops AI drafting automatically at the deadline).

### 5. Strict workspace resolution (INV-01) and shared business brand filtering
- Dodo groups customers by email address across a business. A single owner with two Pivoris workspaces shares one `dodo_customer_id`.
- Webhook and reconciliation workspace resolution therefore **never** resolves by `customer_id`:
  1. Match `billing_accounts.dodo_subscription_id == data.subscription_id`.
  2. Otherwise match `billing_checkouts.ref == data.metadata["pivoris_ref"]`.
- Because Pivoris operates as brand `brnd_0Nsqs1ADANpmDH0r6nHGq` under a shared Dodo business, events whose `data.brand_id` does not match the Pivoris brand (when present) and whose `data.product_id` is not in configured `DODO_PRODUCTS` are recorded in `billing_webhook_events` as `ignored` without alerting.
- Pivoris-brand/product events that match neither a stored subscription nor a checkout `pivoris_ref` are recorded as `unmatched`, raise an operator alert (`billing:unmatched_webhook`), and still return HTTP `200` so Dodo does not endlessly retry unroutable deliveries.
- Stored webhook payloads strip personal fields (`email`, `name`, `phone_number`, `customer_name`, `customer_email`) before persistence and are pruned by retention.

### 6. Founder tier and workspace deletion guard
- The **Kurucu İşletme (Founder)** plan is a dedicated monthly TRY Dodo product (`pivoris_plan=growth`, `founder=true`, 990 ₺/month + KDV) excluded from the public Customer Portal Product Collection so regular workspaces cannot switch into it. Only workspaces flagged via operator CLI (`billing_accounts.founder_eligible`) can initiate Founder checkout.
- Workspace deletion (`POST /workspaces/{ws}/delete-request`) is refused with `409 BILLING_SUBSCRIPTION_ACTIVE` while `billing_accounts.provider_status` (or `workspace_plans.status` with a linked subscription) is `active` or `past_due`, directing the owner to cancel first in the Customer Portal so recurring charges never orphan after tenant purge.

## Consequences
- Self-hosted installations keep `BILLING_PROVIDER=none` and experience zero paywalls or external billing dependencies.
- Local demo and CI run with `BILLING_PROVIDER=fake` and `/dev/billing-checkout`, exercising the full signed Standard Webhooks pipeline with zero credentials ([INV-14](../../invariants.md)).
- Return from checkout (`?checkout=returned`) polls `GET /billing` and reports activation only after verified webhook processing sets `status = 'active'` ([INV-18](../../invariants.md)).
