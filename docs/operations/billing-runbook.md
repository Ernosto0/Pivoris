# Subscription Billing Runbook (Dodo Payments)

**Purpose:** Configure, operate, troubleshoot, and cut over hosted subscription billing (`backend/app/hosted/billing/`, [ADR-029](../architecture/decisions/ADR-029-subscription-billing-dodo-payments.md)).

> [!IMPORTANT]
> Self-hosted deployments leave `BILLING_PROVIDER=none` (the code default) so no workspace is ever paywalled ([ADR-019](../architecture/decisions/ADR-019-open-source-and-hosted-boundary.md)). Local development and automated demos use `BILLING_PROVIDER=fake`. Production hosted SaaS uses `BILLING_PROVIDER=dodo` and refuses `fake` at startup.

---

## 1. Dodo Store Inventory (Test Mode Verified 2026-11-27)

- **Business ID:** `bus_0NmBkEGHU88a8xMDJrH7j`
- **Pivoris Brand ID:** `brnd_0Nsqs1ADANpmDH0r6nHGq` (webhooks for any other `brand_id`, such as NicheCold, are recorded as `ignored` without alerting)
- **Public Product Collection (Portal plan-switching):** `pdc_0Nsr46kk52vbmRaSbwjbd` (`Pivoris Plans` — upgrades apply immediately with proration; downgrades apply at next billing date; **excludes** the Founder product)

| Product key | Tier | Interval | Price (TR / Global) | Test-mode Product ID |
|---|---|---|---|---|
| `starter_monthly` | `starter` (500 replies/mo) | Monthly | 1.490 ₺ + KDV / \$29 + tax | `pdt_0NsqswkWAd0FK9oDO2f0o` |
| `starter_annual` | `starter` (500 replies/mo) | Annual | 14.900 ₺ + KDV / \$288 + tax | `pdt_0NsqswqhBfAW8bwMJ3dxR` |
| `growth_monthly` | `growth` (2,500 replies/mo) | Monthly | 2.490 ₺ + KDV / \$59 + tax | `pdt_0NsqswwdrUERi0iaabEh9` |
| `growth_annual` | `growth` (2,500 replies/mo) | Annual | 24.900 ₺ + KDV / \$588 + tax | `pdt_0Nsqsx2WkiHRSFL2R2i2b` |
| `pro_monthly` | `pro` (7,500 replies/mo) | Monthly | 4.490 ₺ + KDV / \$119 + tax | `pdt_0Nsqsx7NRkeGfrSgJx8mI` |
| `pro_annual` | `pro` (7,500 replies/mo) | Annual | 44.900 ₺ + KDV / \$1,188 + tax | `pdt_0NsqsxDIbMNHGUrK6Vy6n` |
| `founder_monthly` | `growth` (2,500 replies/mo) | Monthly | 990 ₺ + KDV | `pdt_0Nsr46dXafmkuoTG6cJTO` |

All 7 products keep `tax_inclusive=false` and `trial_period_days=0` (trials run cardlessly inside Pivoris; subscribing during trial charges immediately).

---

## 2. Dashboard & Railway Configuration

### 2.1 Dodo Payments Dashboard Settings (Required Manual Steps)
1. **Webhook Endpoint** (*Developer → Webhooks*):
   - **URL:** `https://<backend-host>/webhooks/billing/dodo` (e.g. `https://app.pivoris.com/webhooks/billing/dodo` when same-origin proxied, or the Railway API domain `/webhooks/billing/dodo`).
   - **Events filter:** Subscribe to all `subscription.*` events (`subscription.active`, `subscription.renewed`, `subscription.updated`, `subscription.plan_changed`, `subscription.on_hold`, `subscription.failed`, `subscription.cancelled`, `subscription.expired`, `subscription.past_due`).
   - Copy the signing secret (`whsec_...`) into `DODO_WEBHOOK_SECRET` on Railway.
2. **Past-Due Grace Window** (*Settings → Subscriptions / Retry & Dunning*):
   - Set past-due grace period to **7 days** before moving a failed renewal to `on_hold` / `cancelled`. Pivoris enforces `access_until = past_due_ends_at` directly from Dodo's snapshot rather than maintaining a competing timer.
3. **Customer Portal** (*Settings → Customer Portal*):
   - Enable **Cancel subscription** (cancel at next billing date).
   - Enable **Change subscription plan** using Product Collection `Pivoris Plans` (`pdc_0Nsr46kk52vbmRaSbwjbd` in test mode; create the matching 6-product collection in live mode). Keep `founder_monthly` out of this collection so non-eligible customers cannot switch into it via the portal.

### 2.2 Environment Variables (`api` and `worker` services)
Set on **both** the API service and the Worker service in Railway (see [environment-variables.md](environment-variables.md)):

```ini
BILLING_PROVIDER=dodo
BILLING_TRIAL_DAYS=14
DODO_ENVIRONMENT=test_mode
DODO_API_KEY=dodo_test_...
DODO_WEBHOOK_SECRET=whsec_...
DODO_PRODUCTS=starter_monthly=pdt_0NsqswkWAd0FK9oDO2f0o,starter_annual=pdt_0NsqswqhBfAW8bwMJ3dxR,growth_monthly=pdt_0NsqswwdrUERi0iaabEh9,growth_annual=pdt_0Nsqsx2WkiHRSFL2R2i2b,pro_monthly=pdt_0Nsqsx7NRkeGfrSgJx8mI,pro_annual=pdt_0NsqsxDIbMNHGUrK6Vy6n,founder_monthly=pdt_0Nsr46dXafmkuoTG6cJTO
# Optional override; defaults to {FRONTEND_ORIGIN}/w/{workspace_id}/more/settings/billing?checkout=returned
BILLING_RETURN_URL=
```

Startup validation (`_billing_problems` in `app/core/config.py`) refuses to boot if `BILLING_PROVIDER=dodo` is missing `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, or any of the 7 required keys in `DODO_PRODUCTS`, or if `APP_ENV=production` is paired with `BILLING_PROVIDER=fake` or `DODO_ENVIRONMENT=test_mode` unless explicitly intended in staging.

---

## 3. Operator CLI Commands

Run from `backend/` against the target environment's `DATABASE_URL`. Every command records a durable audit entry (`INV-12`).

```powershell
# Inspect current plan, quota, trial_ends_at, access_until, and billing_exempt
uv run python -m app.cli plan-show --workspace <slug-or-uuid>

# Extend or shorten a workspace's cardless trial relative to current UTC time
uv run python -m app.cli plan-trial --workspace <slug-or-uuid> --days 14

# Grant or revoke billing exemption (exempt workspaces never pause on BILLING_INACTIVE,
# and incoming webhooks will not overwrite their plan/status)
uv run python -m app.cli billing-exempt --workspace <slug-or-uuid> --on
uv run python -m app.cli billing-exempt --workspace <slug-or-uuid> --off

# Unlock or lock the 990 TRY/month Founder (Growth tier) offer on the workspace's Billing page
uv run python -m app.cli billing-founder --workspace <slug-or-uuid> --on
uv run python -m app.cli billing-founder --workspace <slug-or-uuid> --off

# Manual tier or quota override (emergency / custom enterprise arrangement)
uv run python -m app.cli plan-set --workspace <slug-or-uuid> --plan growth --status active
```

---

## 4. Incident & Alert Playbooks

### 4.1 `billing:unmatched_webhook`
- **Meaning:** A validly signed Dodo `subscription.*` webhook for the Pivoris brand (`brnd_0Nsqs1ADANpmDH0r6nHGq`) arrived, but neither `dodo_subscription_id` in `billing_accounts` nor `metadata.pivoris_ref` in `billing_checkouts` matched any workspace.
- **Why `customer_id` is never used (`INV-01`):** Dodo deduplicates customers by email; one owner with two workspaces shares a `customer_id`, so resolving by `customer_id` could cross-contaminate tenants.
- **Investigation:**
  1. Query `SELECT webhook_id, event_type, received_at, payload FROM billing_webhook_events WHERE status = 'unmatched' ORDER BY received_at DESC LIMIT 10;` (customer email and name are already stripped at ingest).
  2. Check whether the subscription was created manually in the Dodo dashboard outside the in-app `POST /billing/checkout` flow (missing `metadata.pivoris_ref`).
  3. Link the workspace's `billing_accounts.dodo_subscription_id` and `dodo_customer_id` to the intended `workspace_id`, then trigger or wait for the daily `billing_reconcile` job to pull the authoritative snapshot from Dodo.

### 4.2 `billing:duplicate_subscription:<workspace_id>`
- **Meaning:** A workspace that already has an `active` or `past_due` subscription (`sub_A`) received an `active` webhook for a **different** subscription ID (`sub_B`). The existing subscription record was **not** overwritten.
- **Investigation:**
  1. Inspect both subscriptions in the Dodo Payments dashboard under the workspace's `dodo_customer_id`.
  2. Cancel/refund the accidental duplicate subscription in Dodo so the customer is not double-billed.

### 4.3 Webhook Outage / Missed Delivery
- **Automatic recovery:** The daily `billing_reconcile` job reads every `billing_accounts` row whose status is non-final (`active`, `past_due`, `on_hold`, or `trial` with a subscription ID) directly from Dodo (`subscriptions.retrieve`, outside any DB transaction) and applies the snapshot idempotently.
- **Signature failures (`webhook.signature_invalid`):** Check *System Health* (`more/settings/system-health`) or `audit_logs` where `action = 'webhook.signature_invalid'`. Verify `DODO_WEBHOOK_SECRET` matches the active endpoint's `whsec_...` secret and server NTP clock skew is within ±5 minutes.

---

## 5. Live-Mode Cutover Checklist

1. Complete Dodo live-mode KYB / payout verification under the Pivoris brand.
2. Recreate (or copy to live mode) all **7 recurring products** with identical USD base prices, TR fixed TRY price overrides, `tax_inclusive=false`, `trial_period_days=0`, and metadata (`pivoris_plan`, plus `founder=true` on `founder_monthly`).
3. Create the live **Product Collection** containing only the **6 public products** (upgrades immediate & prorated; downgrades at next billing date). Enable plan switching and cancellation in the live Customer Portal, and set past-due grace to **7 days**.
4. Create the live webhook endpoint `https://app.pivoris.com/webhooks/billing/dodo` filtered to `subscription.*`.
5. Update `api` and `worker` environment variables:
   - `BILLING_PROVIDER=dodo`
   - `DODO_ENVIRONMENT=live_mode`
   - `DODO_API_KEY=<live api key>`
   - `DODO_WEBHOOK_SECRET=<live whsec_...>`
   - `DODO_PRODUCTS=<all 7 live pdt_... mappings>`
6. Run `alembic upgrade head` (`0103` backfills existing workspaces to a 30-day trial and exempts `is_demo` workspaces; `0104` creates `billing_accounts`, `billing_checkouts`, `billing_webhook_events`, and RLS policies).
7. Smoke-test one real checkout, verify `?checkout=returned` transitions to `Aboneliğiniz etkinleştirildi` only after the webhook applies (`INV-18`), open the Customer Portal, and cancel/refund the smoke subscription.
