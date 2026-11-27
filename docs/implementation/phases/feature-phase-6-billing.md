# Feature Phase 6: Subscription Billing with Dodo Payments

## Objective
Enable real self-service paid subscriptions for both **Türkiye** (fixed TRY + KDV) and **Global** (USD + tax) workspaces through **Dodo Payments** (Merchant of Record), housed in an optional hosted module (`app/hosted/billing/`) so self-hosted deployments are never paywalled ([ADR-019](../../architecture/decisions/ADR-019-open-source-and-hosted-boundary.md), [ADR-029](../../architecture/decisions/ADR-029-subscription-billing-dodo-payments.md)).

## Read first
- [invariants.md](../../invariants.md)
- [ADR-019](../../architecture/decisions/ADR-019-open-source-and-hosted-boundary.md)
- [ADR-029](../../architecture/decisions/ADR-029-subscription-billing-dodo-payments.md)
- [pricing-and-unit-economics.md](../../product/pricing-and-unit-economics.md)
- [data-model.md](../../architecture/data-model.md)
- [api-design.md](../../architecture/api-design.md)
- [state-machines.md](../../architecture/state-machines.md)
- [environment-variables.md](../../operations/environment-variables.md)
- [observability.md](../../architecture/observability.md)

## Commercial & Product Decisions (2026-11-27)
- **Provider:** Dodo Payments for Türkiye and Global. Türkiye workspaces (`currency == "TRY"` / `market == "tr"`) see fixed TRY prices (`+ KDV`); everyone else sees USD prices (`+ tax`).
- **Trial:** 14 days (`BILLING_TRIAL_DAYS=14`), no credit card required, full plan reply quota. Existing workspaces receive a one-time migration backfill of `trial_ends_at = release_time + 30 days`. Demo (`is_demo`) and operator-exempt (`billing_exempt`) workspaces are never blocked.
- **Unpaid after trial / grace (`BILLING_INACTIVE`):** AI customer reply drafting, auto-send, and AI content generation (`draft_content`) stop. Existing data stays intact; inbound messages still arrive in the inbox and notify humans; scheduled posts keep publishing; the sandbox test chat keeps working.
- **Payment failure:** 7 days of grace via Dodo's native `past_due` window (`past_due_ends_at`), then `BILLING_INACTIVE`.
- **Founder (Kurucu) offer:** Dedicated Dodo product at 990 ₺/month + KDV mapped to the `growth` tier (`pdt_0Nsr46dXafmkuoTG6cJTO` in test mode), available only to CLI-flagged workspaces (`billing-founder --on`) and excluded from the Customer Portal plan-change collection (`pdc_0Nsr46kk52vbmRaSbwjbd`).
- **Pro / Scale quota:** 7,500 AI replies/month across both markets.
- **Immediate billing on subscribe:** Paying during trial charges immediately (`trial_period_days = 0`), sets `status = active`, and resets the quota period on first activation only.
- **Workspace deletion guard:** Blocked with `409 BILLING_SUBSCRIPTION_ACTIVE` while a subscription is `active` or `past_due`.

## Sessions (in order)

| Session | Scope | Key deliverables |
|---|---|---|
| **S1** | Contracts & Dodo store verification | ADR-029, INV-15 scope note, contract updates (`data-model`, `api-design`, `state-machines`, `environment-variables`, `observability`), Dodo test-mode Founder product + Product Collection, sanitized Dodo webhook fixtures |
| **S2** | Core enforcement & CLI | Migration `0103` (`trial_ends_at`, `access_until`, `billing_exempt`, 30-day backfill), `block_reason` & `pause_reason` in `app/plans/`, caller updates across inbox/agent/comments/content, settings & `_billing_problems()`, `UsageOut`, CLI (`plan-trial`, `billing-exempt`), import-linter rules |
| **S3** | Billing tables & webhook ingestion | Migration `0104` (`billing_accounts`, `billing_checkouts`, `billing_webhook_events`, `resolve_billing_workspace`, `discover_billing_deadlines`, RLS), Standard Webhooks HMAC verifier, `POST /webhooks/billing/dodo`, PII stripping, `billing_apply_event` snapshot handler + audits, retention & RLS tests |
| **S4** | Provider adapters & billing API | `provider.py` protocol, lazy `dodo.py` adapter (injectable httpx client) + `fake.py` adapter, `catalog.py` + pricing-doc consistency test, `billing.manage` permission, `GET /billing`, `POST /billing/checkout`, `POST /billing/portal`, `POST /api/v1/dev/billing/simulate`, `billing-founder` CLI, workspace deletion guard |
| **S5** | Lifecycle deadlines, reconciliation & notifications | Periodic `discover_billing_deadlines` + per-workspace deadline job (`billing.trial_ending` 3 days prior, `billing.paused` on block), daily `billing_reconcile` job, notification catalog + `hosted/billing/texts.py` + Web Push + Telegram + frontend `catalog.json` |
| **S6** | Frontend billing UI, polling & banners | `BillingPage` (`more/settings/billing`), monthly/annual toggle, TRY/USD + tax labels, founder card, owner vs manager read-only, simulated badge, `?checkout=returned` polling (`INV-18`), `/dev/billing-checkout`, `UsageNotice` & `Usage` links, `inbox.json` & `billing.json` i18n, OpenAPI typegen |
| **S7** | Runbook, copy alignment, E2E & summary | `docs/operations/billing-runbook.md`, updates to ADR-019, `local-development.md`, `open-questions.md` (OQ-06), `mvp-scope.md`, `roadmap.md`, `pricing-and-unit-economics.md` (§3.1, §4, §6), `landing/` copy ("14 gün · kart yok" + Dodo billing copy), full backend/frontend verification, phase summary |

## Acceptance Criteria
1. `BILLING_PROVIDER=none` never blocks any workspace regardless of `trial_ends_at` or `access_until`.
2. Standard Webhooks signature verification rejects tampered, wrong-secret, or >5-minute-skewed payloads with `401` and records `webhook.signature_invalid`; delivering the same `webhook-id` 3× enqueues at most one `billing_apply_event` job ([INV-06](../../invariants.md)).
3. Full lifecycle via signed events: `trial` → blocked at day 14 (`BILLING_INACTIVE`) → `active` (first activation resets quota) → `past_due` (allowed until `past_due_ends_at`, then blocked) → `active` (renewal does not reset monthly quota anchor) → `cancelled` with future end date (allowed until end date, then blocked).
4. Workspace resolution uses `dodo_subscription_id` then `pivoris_ref`, never `customer_id`; two workspaces sharing one owner email remain strictly isolated ([INV-01](../../invariants.md)).
5. Blocked workspaces still ingest inbound messages and notify humans, sandbox test chat still works, scheduled posts still publish, and AI reply drafting + AI content generation stop without calling the LLM.
6. Return from checkout (`?checkout=returned`) shows verifying state until `GET /billing` confirms `status == "active"` ([INV-18](../../invariants.md)).
7. Workspace deletion is refused with `BILLING_SUBSCRIPTION_ACTIVE` while a subscription is `active` or `past_due`.

## Explicitly Excluded
Custom card forms (PCI scope), manual EFT invoicing, WhatsApp billing utility templates (pending Meta template approval), multi-workspace consolidated invoicing.
