import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { NotFoundPage } from "@/app/NotFoundPage";
import type { Billing, BillingCheckoutBody } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Notice, Skeleton } from "@/components/Feedback";
import { FilterBar, PageHeader } from "@/components/Layout";
import { SimulatedBadge } from "@/components/SimulatedBadge";
import { useMeta } from "@/features/auth/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/context";
import { externalNavigation, useBilling, useOpenPortal, useStartCheckout } from "./hooks";

export const CHECKOUT_POLL_INTERVAL_MS = 3_000;
export const CHECKOUT_POLL_TIMEOUT_MS = 120_000;

function statusSummary(
  data: Billing,
  formatDate: (iso: string) => string,
  t: (key: string, options?: Record<string, unknown>) => string,
): { title: string; body: string; tone: "neutral" | "attention" | "danger" } {
  if (data.billing_exempt) {
    return {
      title: t("billing.status.exemptTitle"),
      body: t("billing.status.exemptBody"),
      tone: "neutral",
    };
  }
  if (data.block_reason === "BILLING_INACTIVE") {
    return {
      title: t("billing.status.stoppedTitle"),
      body: t("billing.status.stoppedBody"),
      tone: "danger",
    };
  }
  if (data.status === "past_due") {
    const endIso = data.past_due_ends_at ?? data.access_until ?? data.trial_ends_at;
    return {
      title: t("billing.status.pastDueTitle"),
      body: t("billing.status.pastDueBody", { date: formatDate(endIso) }),
      tone: "attention",
    };
  }
  if (data.status === "cancelled" || data.cancel_at_period_end) {
    const endIso = data.access_until ?? data.current_period_end ?? data.trial_ends_at;
    return {
      title: t("billing.status.cancellingTitle"),
      body: t("billing.status.cancellingBody", { date: formatDate(endIso) }),
      tone: "attention",
    };
  }
  if (data.status === "active") {
    return {
      title: t("billing.status.activeTitle"),
      body: data.current_period_end
        ? t("billing.status.activeBody", { date: formatDate(data.current_period_end) })
        : t("billing.status.activeNoDate"),
      tone: "neutral",
    };
  }
  return {
    title: t("billing.status.trialTitle"),
    body: t("billing.status.trialBody", { date: formatDate(data.trial_ends_at) }),
    tone: "neutral",
  };
}

export function BillingPage() {
  const { t, i18n } = useTranslation();
  const { workspace, role } = useCurrentWorkspace();
  const [searchParams] = useSearchParams();
  const meta = useMeta();
  const [interval, setIntervalState] = useState<"monthly" | "annual">("monthly");
  const [redirecting, setRedirecting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const canView = role === "owner" || role === "manager";
  const billingEnabled = meta.data?.billing_enabled !== false;
  const returnedFromCheckout = searchParams.get("checkout") === "returned";

  const billing = useBilling(workspace.id, {
    enabled: canView && billingEnabled,
    refetchInterval: false,
  });

  // INV-18: Returning from checkout never claims payment succeeded until verified `active` arrives.
  const isVerifiedActive = billing.data?.status === "active";
  const shouldPoll =
    canView && billingEnabled && returnedFromCheckout && !isVerifiedActive && !timedOut;

  useEffect(() => {
    if (!shouldPoll) return;
    const pollId = window.setInterval(() => {
      void billing.refetch();
    }, CHECKOUT_POLL_INTERVAL_MS);
    const timeoutId = window.setTimeout(() => {
      setTimedOut(true);
    }, CHECKOUT_POLL_TIMEOUT_MS);
    return () => {
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };
  }, [shouldPoll, billing]);

  const checkout = useStartCheckout(workspace.id);
  const portal = useOpenPortal(workspace.id);

  if (!canView) return <NotFoundPage embedded />;

  if (meta.data && meta.data.billing_enabled === false) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title={t("billing.title")} description={t("billing.intro")} />
        <Notice tone="info" title={t("billing.title")}>
          {t("billing.disabled")}
        </Notice>
      </div>
    );
  }

  const data = billing.data;
  const isOwner = role === "owner" && (data?.can_manage ?? true);
  const busy = checkout.isPending || portal.isPending || redirecting;
  const number = new Intl.NumberFormat(i18n.language);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: workspace.timezone,
    }).format(new Date(iso));

  const hasActiveOrPastDue =
    Boolean(data?.has_subscription) &&
    (data?.status === "active" || data?.status === "past_due");

  function handleSubscribe(plan: BillingCheckoutBody["plan"], selectedInterval: "monthly" | "annual") {
    checkout.mutate(
      { plan, interval: selectedInterval },
      {
        onSuccess: ({ checkout_url }) => {
          setRedirecting(true);
          externalNavigation.assign(checkout_url);
        },
      },
    );
  }

  function handleManagePortal() {
    portal.mutate(undefined, {
      onSuccess: ({ portal_url }) => {
        setRedirecting(true);
        externalNavigation.assign(portal_url);
      },
    });
  }

  const visiblePlans = data?.plans.filter((item) => item.interval === interval) ?? [];
  const taxNote =
    data?.currency === "TRY" ? t("billing.taxExclusiveTRY") : t("billing.taxExclusiveUSD");
  const summary = data ? statusSummary(data, formatDate, t) : null;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={t("billing.title")}
        description={t("billing.intro")}
        action={data?.is_simulated ? <SimulatedBadge /> : undefined}
      />

      {returnedFromCheckout ? (
        isVerifiedActive ? (
          <div data-testid="checkout-return-banner" data-return-state="verified">
            <Notice tone="success" live="polite" title={t("billing.return.verifiedTitle")}>
              {t("billing.return.verifiedBody")}
            </Notice>
          </div>
        ) : timedOut ? (
          <div data-testid="checkout-return-banner" data-return-state="unverified">
            <Notice tone="attention" live="assertive" title={t("billing.return.unverifiedTitle")}>
              <p>{t("billing.return.unverifiedBody")}</p>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTimedOut(false);
                    void billing.refetch();
                  }}
                >
                  {t("billing.return.checkAgain")}
                </Button>
              </div>
            </Notice>
          </div>
        ) : (
          <div data-testid="checkout-return-banner" data-return-state="verifying">
            <Notice tone="info" live="polite" title={t("billing.return.verifyingTitle")}>
              {t("billing.return.verifyingBody")}
            </Notice>
          </div>
        )
      ) : null}

      {billing.isPending ? <Skeleton label={t("common.loading")} rows={4} /> : null}
      {billing.isError ? <ErrorMessage error={billing.error} /> : null}
      {checkout.isError ? <ErrorMessage error={checkout.error} /> : null}
      {portal.isError ? <ErrorMessage error={portal.error} /> : null}

      {data && summary ? (
        <>
          <section
            data-testid="billing-status-panel"
            aria-label={t("billing.status.heading")}
            className={`flex flex-col gap-4 rounded-panel border p-5 shadow-xs ${
              summary.tone === "danger"
                ? "border-danger/40 bg-danger-subtle"
                : summary.tone === "attention"
                  ? "border-attention/40 bg-attention-subtle"
                  : "border-border bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-metadata font-semibold uppercase tracking-wide text-secondary">
                    {t("billing.status.heading")}
                  </span>
                  <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-primary">
                    {t(`usage.plans.${data.plan}`)}
                  </span>
                  <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-secondary">
                    {t(`usage.status.${data.status}`)}
                  </span>
                  {data.is_simulated ? <SimulatedBadge compact /> : null}
                </div>
                <h2 className="mt-2 type-section text-primary">{summary.title}</h2>
                <p className="mt-1 max-w-prose text-body text-secondary">{summary.body}</p>
              </div>

              {isOwner && (data.has_subscription || data.has_customer) ? (
                <Button
                  variant="secondary"
                  pending={portal.isPending || redirecting}
                  disabled={busy}
                  onClick={handleManagePortal}
                >
                  {t("billing.manageSubscription")}
                </Button>
              ) : null}
            </div>

            {!isOwner ? (
              <p data-testid="billing-manager-readonly" className="text-metadata font-medium text-secondary">
                {t("billing.managerReadOnly")}
              </p>
            ) : null}
          </section>

          {data.founder_offer ? (
            <section
              data-testid="founder-offer-card"
              className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-action/40 bg-surface p-5 shadow-xs"
            >
              <div className="min-w-0 flex-1 basis-64">
                <span className="inline-flex rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-bold text-action">
                  {t("billing.founder.badge")}
                </span>
                <h2 className="mt-2 type-section text-primary">{t("billing.founder.title")}</h2>
                <p className="mt-1 max-w-prose text-body text-secondary">
                  {t("billing.founder.description")}
                </p>
                <p className="mt-2 text-metadata font-medium text-secondary">
                  {t("billing.quotaPerMonth", {
                    quota: number.format(data.founder_offer.ai_replies_quota),
                  })}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {data.founder_offer.amount_display}{" "}
                  <span className="text-body font-normal text-secondary">
                    {t("billing.perMonth")}
                  </span>
                </p>
                <p className="text-metadata text-secondary">{t("billing.taxExclusiveTRY")}</p>
                {isOwner && !hasActiveOrPastDue ? (
                  <Button
                    pending={checkout.isPending || redirecting}
                    disabled={busy}
                    onClick={() => handleSubscribe("founder", "monthly")}
                  >
                    {t("billing.subscribeFounder")}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-4">
            <div data-testid="billing-interval-toggle">
              <FilterBar label={t("billing.intervalGroup")}>
                <Button
                  variant={interval === "monthly" ? "primary" : "secondary"}
                  aria-pressed={interval === "monthly"}
                  onClick={() => setIntervalState("monthly")}
                >
                  {t("billing.monthly")}
                </Button>
                <Button
                  variant={interval === "annual" ? "primary" : "secondary"}
                  aria-pressed={interval === "annual"}
                  onClick={() => setIntervalState("annual")}
                >
                  {t("billing.annual")}
                </Button>
              </FilterBar>
            </div>

            <div className="grid min-w-0 gap-4 md:grid-cols-3">
              {visiblePlans.map((item) => {
                const isCurrentPaid =
                  hasActiveOrPastDue &&
                  (data.product_key === item.product_key ||
                    (!data.product_key && data.plan === item.plan));
                const recommended = !hasActiveOrPastDue && item.plan === "growth";
                return (
                  <article
                    key={item.product_key}
                    data-testid={`plan-card-${item.plan}`}
                    className={`flex min-w-0 flex-col justify-between gap-4 rounded-panel border bg-surface p-5 shadow-xs ${
                      recommended ? "border-action ring-1 ring-action/30" : "border-border"
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="type-section text-primary">
                          {t(`usage.plans.${item.plan}`)}
                        </h3>
                        {isCurrentPaid ? (
                          <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-primary">
                            {t("billing.currentPlan")}
                          </span>
                        ) : recommended ? (
                          <span className="rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-bold text-action">
                            {t("billing.recommended")}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1">
                        <p className="text-2xl font-bold text-primary tabular-nums">
                          {item.amount_display}{" "}
                          <span className="text-body font-normal text-secondary">
                            {interval === "monthly"
                              ? t("billing.perMonth")
                              : t("billing.perYear")}
                          </span>
                        </p>
                        {interval === "annual" ? (
                          <p className="mt-0.5 text-metadata font-medium text-action">
                            {t("billing.monthlyEquivalent", {
                              amount: item.monthly_equivalent_display,
                            })}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-metadata text-secondary">{taxNote}</p>
                      </div>

                      <p className="mt-2 text-body text-primary">
                        {t("billing.quotaPerMonth", {
                          quota: number.format(item.ai_replies_quota),
                        })}
                      </p>
                    </div>

                    {isOwner ? (
                      hasActiveOrPastDue ? (
                        <p className="text-metadata text-secondary">
                          {isCurrentPaid ? t("billing.currentPlan") : t("billing.switchInPortal")}
                        </p>
                      ) : (
                        <Button
                          block
                          variant={recommended ? "primary" : "secondary"}
                          pending={checkout.isPending || redirecting}
                          disabled={busy}
                          onClick={() => handleSubscribe(item.plan, interval)}
                        >
                          {t("billing.subscribe")}
                        </Button>
                      )
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
