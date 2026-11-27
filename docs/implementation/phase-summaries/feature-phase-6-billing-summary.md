# Feature Phase 6 Close-Out Summary: Subscription Billing with Dodo Payments

- **Phase:** Feature Phase 6 — Subscription Billing with Dodo Payments
- **Specification:** [feature-phase-6-billing.md](../phases/feature-phase-6-billing.md), [ADR-029](../../architecture/decisions/ADR-029-subscription-billing-dodo-payments.md), [ADR-019](../../architecture/decisions/ADR-019-open-source-and-hosted-boundary.md)
- **Sessions executed:** S1 through S7
- **Alembic migration head:** `0104` (`0102 → 20261127_0103_workspace_plan_billing_fields.py → 20261127_0104_hosted_billing_tables.py`). Next free: `0105`.
- **Status:** **Implemented and verified offline + Dodo test-mode store configured via MCP. Stopped for review** (nothing committed).
- **Date:** 2026-11-27

---

## 1. Executive Summary

Pivoris now supports real self-service paid subscriptions for both **Türkiye** (fixed TRY + KDV) and **Global** (USD + tax) workspaces through **Dodo Payments** acting as Merchant of Record, while preserving the open-source boundary ([ADR-019](../../architecture/decisions/ADR-019-open-source-and-hosted-boundary.md)):

- Billing lives inside an optional hosted module (`backend/app/hosted/billing/`), controlled by `BILLING_PROVIDER=none|fake|dodo` (code default `none`, so self-hosters are never paywalled; `.env.example` uses `fake`; production refuses `fake`).
- Core modules (`app/plans/`, `app/inbox/`, `app/agent/`, `app/comments/`, `app/content/`) never import `app.hosted`; enforced by two new `import-linter` contracts (`hosted-entry-points-only`, `dodo-sdk-only-in-adapter`).
- New workspaces receive a **14-day cardless trial** (`BILLING_TRIAL_DAYS=14`, full tier reply allowance); existing workspaces are backfilled to `2026-12-27T00:00:00Z` (release + 30 days); demo (`is_demo`) and operator-exempt (`billing_exempt`) workspaces never block.
- When trial or Dodo's 7-day `past_due` grace expires (`BILLING_INACTIVE`), AI customer reply drafting, auto-send, and AI content generation (`draft_content`) pause cleanly without calling the LLM, while customer messages continue arriving in the inbox and notifying humans, scheduled posts still publish, and the sandbox test chat keeps working.

---

## 2. What Changed (By Session)

### S1 — Contracts, Dependencies & Dodo Test-Mode Store Setup
- Configured Pivoris Dodo test-mode store (`brnd_0Nsqs1ADANpmDH0r6nHGq`, business `bus_0NmBkEGHU88a8xMDJrH7j`) via the Dodo Payments MCP:
  - Created Founder product `pdt_0Nsr46dXafmkuoTG6cJTO` (990 ₺/month + KDV, `pivoris_plan=growth`, `founder=true`, `trial_period_days=0`).
  - Created 6-product public Product Collection `pdc_0Nsr46kk52vbmRaSbwjbd` (`Pivoris Plans`: immediate prorated upgrades, next-billing-date downgrades, Founder excluded).
  - Verified TR and US checkout sessions, `metadata.pivoris_ref` propagation, and Customer Portal session creation.
- Pinned `dodopayments==1.127.0` in `backend/pyproject.toml` and `backend/uv.lock`.
- Authored [ADR-029](../../architecture/decisions/ADR-029-subscription-billing-dodo-payments.md), [feature-phase-6-billing.md](../phases/feature-phase-6-billing.md), sanitized fixtures in `backend/tests/contract/fixtures/dodo/*.json`, and updated `invariants.md` (INV-15 scope note), `data-model.md`, `api-design.md`, `state-machines.md`, `environment-variables.md`, `observability.md`, and `pricing-and-unit-economics.md` (§3.1, §4 Pro quota `7,500`, §6 & §6.1).

### S2 — Core Enforcement, Migration `0103`, Settings, CLI & Import Contracts
- **Migration `0103`** (`backend/migrations/versions/20261127_0103_workspace_plan_billing_fields.py`): added `trial_ends_at`, `access_until`, `billing_exempt`, `warned_trial_ending`, `warned_billing_paused` to `workspace_plans`, backfilled missing rows and existing workspaces to `2026-12-27T00:00:00Z`, and marked `is_demo` workspaces `billing_exempt = true`.
- **`backend/app/plans/`**: implemented pure `billing_block_reason` & `block_reason` (`REPLY_QUOTA_PAUSED`, `BILLING_INACTIVE`, `None`), `pause_reason`, `is_quota_paused`, `is_billing_blocked`, `ensure_plan_row` (wired into `identity/service.py:create_workspace`), expanded `UsageOut`, and added CLI commands `plan-trial --days N` and `billing-exempt --on/--off`.
- Switched all drafting/generation callers (`agent/coordinator.py`, `agent/dm.py`, `comments/actions.py`, `comments/private_reply.py`, `inbox/jobs.py`, `inbox/sandbox.py`, `policy/rules_reply.py`, `content/generation.py`).
- Added billing settings, `_SECRET_FIELDS` entries (`dodo_api_key`, `dodo_webhook_secret`), `_billing_problems()` startup checks (`app/core/config.py`), and Problem error codes (`BILLING_INACTIVE` 402, `BILLING_ALREADY_SUBSCRIBED` 409, `BILLING_SUBSCRIPTION_ACTIVE` 409, `BILLING_PROVIDER_UNAVAILABLE` 503).

### S3, S4 & S5 — Hosted Billing Module, Migration `0104`, Webhooks, Providers, API & Lifecycle
- **Migration `0104`** (`backend/migrations/versions/20261127_0104_hosted_billing_tables.py`): created Category C RLS tables `billing_accounts` and `billing_checkouts` (`CATEGORY_C_TABLES` → 70), global Category A table `billing_webhook_events`, and `SECURITY DEFINER` helpers `resolve_billing_workspace` & `discover_billing_deadlines`.
- **`backend/app/hosted/billing/`**:
  - `webhooks.py`: Standard Webhooks HMAC-SHA256 verification (`whsec_` base64 secret, ±5 min `Clock` skew, `hmac.compare_digest`), `webhook.signature_invalid` auditing, customer email/name PII stripping, `ON CONFLICT DO NOTHING` deduplication (`INV-06`), Pivoris brand filtering (`ignored` for foreign brands), and strict workspace resolution by `dodo_subscription_id` then `pivoris_ref` (**never** `customer_id`, `INV-01`).
  - `catalog.py`, `provider.py`, `dodo.py` (lazy SDK import + injectable `httpx.Client`, external calls strictly outside DB transactions), `fake.py`, `registry.py`.
  - `service.py`, `router.py`, `dev_router.py`, `cli.py` (`billing-founder --on/--off`): `GET /billing`, `POST /billing/checkout`, `POST /billing/portal` (`billing.manage`, owner only), and dev-only `POST /api/v1/dev/billing/simulate` (`INV-20`).
  - `jobs.py` & `texts.py`: `billing_apply_event` snapshot state machine (first-activation quota reset, renewal period preservation, `past_due` 7-day grace, `cancelled` end-of-period access, duplicate-subscription protection + alert), `billing_deadline_sweep` / `billing_workspace_deadline`, daily `billing_reconcile`, and notifications (`billing.trial_ending`, `billing.payment_failed`, `billing.paused`, `billing.activated` across in-app, Web Push, and Telegram; excluded from WhatsApp).
- **Lifecycle & Retention Guards**: `request_workspace_deletion` refuses deletion with `409 BILLING_SUBSCRIPTION_ACTIVE` when an active or past-due subscription exists (`operations/workspace_lifecycle.py`), and `retention/cleanup.py` prunes `billing_webhook_events`.

### S6 — Frontend Billing Page, Polling (`INV-18`), Dev Simulator & Banners
- Regenerated `frontend/openapi.json` and `frontend/src/api/schema.d.ts`; added TypeScript aliases in `frontend/src/api/types.ts`.
- Created `frontend/src/features/billing/{hooks.ts,BillingPage.tsx,DevBillingCheckoutPage.tsx,billing.test.tsx}`:
  - Status panel (trial, active, cancelling, past-due grace, stopped `BILLING_INACTIVE`, exempt), `<SimulatedBadge />` when `is_simulated` (`INV-09`), Monthly/Annual toggle, TRY (`+ KDV`) & USD (`+ tax`) plan cards, CLI-gated Founder offer card, owner actions (`Abone ol`, `Aboneliği yönet`), and manager read-only view.
  - `?checkout=returned` polling (`INV-18`): polls `GET /billing` every 3 s for up to 2 minutes, displaying `"Ödeme doğrulanıyor…"` until verified `status === "active"` arrives (or `"Ödeme henüz doğrulanmadı"` on timeout).
  - `/dev/billing-checkout` simulated checkout & portal screen (`INV-09`, `INV-20`).
- Updated `navigation.ts`, `MorePage.tsx`, `DestinationLauncher.tsx`, `AppShell.tsx`, `router.tsx`, `UsageNotice.tsx` (trial-ending, payment-problem, and billing-stopped dashboard banners), `Usage.tsx`, `WorkspaceDangerZone.tsx` (direct link to `Aboneliği yönet` on `BILLING_SUBSCRIPTION_ACTIVE`), and `tr`/`en` locale catalogs (`billing.json`, `common.json`, `inbox.json`, `notifications/describe.ts`, `notifications/target.ts`).

### S7 — Runbook, Documentation Alignment, Landing Copy & Verification
- Created [billing-runbook.md](../../operations/billing-runbook.md) and updated [ADR-019](../../architecture/decisions/ADR-019-open-source-and-hosted-boundary.md), [local-development.md](../../operations/local-development.md), [open-questions.md](../../research/open-questions.md) (`OQ-06`), [mvp-scope.md](../../product/mvp-scope.md), [security-and-privacy.md](../../architecture/security-and-privacy.md), and [roadmap.md](../roadmap.md).
- Updated `landing/src/copy.ts` (TR and EN): updated trial copy from 30 days to **14 days · no card** across Hero, Pilot, FAQ, and Mobile CTA, and replaced the `"Planlanan"` / `"Planned"` billing card with accurate Dodo Payments copy (card payment, fixed TRY `+ KDV` in Türkiye, USD `+ tax` elsewhere, invoices issued by Dodo Payments as Merchant of Record).

---

## 3. Acceptance Criteria Proof Matrix

| Criterion | Proving Tests |
|---|---|
| 1. `BILLING_PROVIDER=none` never blocks any workspace and mounts no billing routes | `tests/unit/plans/test_block_reason.py`, `tests/integration/billing/test_billing_lifecycle.py::test_billing_provider_none_mounts_no_billing_routes` |
| 2. Standard Webhooks HMAC verification (401 + `webhook.signature_invalid` audit), PII stripping, and 3× `webhook-id` deduplication (`INV-06`) | `tests/unit/billing/test_webhooks_and_catalog.py`, `tests/integration/billing/test_billing_lifecycle.py::test_bad_signature_401_audit_and_3x_dedup_single_job_and_pii_stripped` |
| 3. Full subscription lifecycle (`trial` → blocked at day 14 → `active` with first-activation quota reset → renewal preserves period → out-of-order ignored → `past_due` 7-day grace → `cancelled` end-of-period → foreign brand `ignored` → unmatched alert) | `tests/integration/billing/test_billing_lifecycle.py::test_full_subscription_lifecycle_and_out_of_order_and_unmatched_events` |
| 4. Tenant isolation (`INV-01`): two workspaces sharing one owner email / `customer_id`, manager 403 on checkout/portal, staff 403, stranger 404, Founder CLI flag, double-subscription 409, deletion guard 409 | `tests/integration/billing/test_billing_lifecycle.py::test_same_owner_email_isolation_permissions_founder_and_deletion_guard` |
| 5. Blocked workspace (`BILLING_INACTIVE`) still receives inbox messages and notifies humans, sandbox test chat still works, and AI content generation returns `402 BILLING_INACTIVE` | `tests/integration/billing/test_billing_lifecycle.py::test_blocked_workspace_still_receives_inbox_messages_and_notifies_humans` |
| 6. Dodo SDK adapter runs outside any DB transaction (`not db_session.in_transaction()`), sends expected payload, and leaks no secrets (`INV-10`) | `tests/contract/test_dodo_provider.py` |
| 7. Non-UTC deadline warnings (`billing.trial_ending`, `billing.paused`), daily reconciliation, and notification channel routing (Push + Telegram, never WhatsApp) | `tests/integration/billing/test_billing_lifecycle.py::test_deadlines_non_utc_timezone_reconciliation_and_notification_channels`, `tests/unit/integrations/channels/test_web_push_payloads.py`, `tests/unit/integrations/channels/test_telegram_delivery_unit.py` |
| 8. Frontend `BillingPage`, TRY vs USD, Monthly/Annual toggle, Founder card, manager read-only, `<SimulatedBadge />` (`INV-09`), `?checkout=returned` polling (`INV-18`), `/dev/billing-checkout` (`INV-20`), and Today banners | `frontend/src/features/billing/billing.test.tsx` (12 tests), `frontend/src/features/settings/usage.test.tsx` (9 tests) |
| 9. Architectural & RLS guards (`CATEGORY_C_TABLES == 70`, `billing_webhook_events` Category A, 29 import-linter contracts) | `tests/unit/core/test_rls_policies.py`, `uv run lint-imports` |

---

## 4. Verification Results

| Check | Result |
|---|---|
| `uv run alembic heads` & `alembic upgrade head` (`0103`, `0104`) | Single head `0104`; clean upgrade + `0103` backfill verified (`test_plan_migration.py`) |
| `uv run ruff check .` & `uv run ruff format --check .` | Pass (0 errors, 942 files formatted) |
| `uv run mypy app` | Pass (0 issues in 486 source files) |
| `uv run lint-imports` | Pass (29 contracts kept, 0 broken) |
| `uv run python -m evals run --all --provider fake --strict` | Pass (`interpret_command` 84/84, `extract_fact_candidates` 12/12, `draft_reply` 146/146, `draft_content` 26/26; 0 hard failures) |
| Backend billing & regression suites (`tests/unit`, `tests/contract`, `tests/isolation`, `tests/integration/plans`, `tests/integration/operations`, `tests/integration/billing`) | 3,795+ passed, 21 live-credential skips; all billing, RLS, permission, channel, retention, alert, and lifecycle suites 100% green *(1 pre-existing baseline diff in `test_production_packaging.py` for `ARG VITE_PUBLIC_URL` in `Dockerfile`, untouched by this phase)* |
| OpenAPI sync (`export-openapi` + `npm run gen:api`) | Pass (zero drift) |
| Frontend `npm run lint`, `npm run typecheck`, `npm run i18n:check`, `npm run build` | Pass (0 lint/TS errors, 3,155 i18n keys & 2,233 `t()` calls verified, production bundle built) |
| Frontend `npm test` (Vitest) | Pass (**71/71 test files, 999/999 tests passed**) |
| Landing `npm run build` (`tsc -b && vite build`) | Pass |
| Local `BILLING_PROVIDER=fake` E2E flow (`seed --reset` → create workspace → `GET /billing` → `POST /billing/checkout` → `POST /dev/billing/simulate` → active subscription + portal) | Pass |

---

## 5. Pending Manual Dashboard Actions (Owner / Cutover)

Because the Dodo MCP OAuth token does not include `webhooks:write` or dashboard portal/dunning settings scopes, complete these steps in the **Dodo Payments Dashboard** (documented step-by-step in [billing-runbook.md](../../operations/billing-runbook.md) §2 & §5):

1. **Webhook Endpoint (Test Mode & Live Mode):** Register `https://<railway-api-or-app-domain>/webhooks/billing/dodo` subscribed to `subscription.*`, and store `DODO_WEBHOOK_SECRET`, `DODO_API_KEY`, `BILLING_PROVIDER=dodo`, `DODO_ENVIRONMENT`, and `DODO_PRODUCTS` on both `api` and `worker` in Railway.
2. **Past-Due Grace Period:** Set subscription retry / past-due grace to **7 days** in Dodo Settings.
3. **Customer Portal:** Enable **Cancel subscription** and **Change plan** linked to Product Collection `Pivoris Plans` (`pdc_0Nsr46kk52vbmRaSbwjbd` in test mode; 6 public plans, excluding Founder).
4. **Live Mode Cutover:** Copy/recreate the 7 products and the 6-product collection in Dodo Live Mode once ready for production charges.
