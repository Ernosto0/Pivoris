import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertIcon, CriticalIcon } from "@/components/icons";
import { useMeta } from "@/features/auth/hooks";
import { FOCUS } from "@/features/home/DashboardPanel";
import { useCurrentWorkspace } from "@/features/workspaces/context";
import { useReplyUsage } from "./hooks";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Notice on Today when subscription billing needs attention (stopped, payment failed, or trial
 * ending within 3 days) or when the monthly AI reply allowance is at 80% or more. Silent while
 * normal, for staff, and while loading or on error.
 */
export function UsageNotice() {
  const { t, i18n } = useTranslation();
  const { workspace } = useCurrentWorkspace();
  const meta = useMeta();
  const usageQuery = useReplyUsage();
  const usage = usageQuery.data;
  if (!usage) return null;

  const billingEnabled = Boolean(meta.data?.billing_enabled);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: workspace.timezone,
    }).format(new Date(iso));

  const trialEndsMs = Date.parse(usage.trial_ends_at);
  const nowMs = usageQuery.dataUpdatedAt;
  const trialEndingSoon =
    billingEnabled &&
    !workspace.is_demo &&
    !usage.billing_exempt &&
    usage.status === "trial" &&
    usage.block_reason !== "BILLING_INACTIVE" &&
    Number.isFinite(trialEndsMs) &&
    trialEndsMs > nowMs &&
    trialEndsMs - nowMs <= THREE_DAYS_MS;

  const paymentProblem =
    billingEnabled &&
    !workspace.is_demo &&
    !usage.billing_exempt &&
    usage.status === "past_due" &&
    usage.block_reason !== "BILLING_INACTIVE";

  const billingStopped = usage.block_reason === "BILLING_INACTIVE";

  if (billingStopped || paymentProblem || trialEndingSoon) {
    const urgent = billingStopped || paymentProblem;
    const stateTag = billingStopped
      ? "billing_stopped"
      : paymentProblem
        ? "past_due"
        : "trial_ending";
    const title = billingStopped
      ? t("usage.billingBanner.stoppedTitle")
      : paymentProblem
        ? t("usage.billingBanner.paymentProblemTitle")
        : t("usage.billingBanner.trialEndingTitle", { date: formatDate(usage.trial_ends_at) });
    const sub = billingStopped
      ? t("usage.billingBanner.stoppedSub")
      : paymentProblem
        ? t("usage.billingBanner.paymentProblemSub", {
            date: formatDate(usage.access_until ?? usage.period_end),
          })
        : t("usage.billingBanner.trialEndingSub");

    return (
      <div
        role={urgent ? "alert" : "status"}
        data-testid="usage-notice"
        data-state={stateTag}
        className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3 sm:px-5 ${
          urgent ? "border-danger/30 bg-danger-subtle" : "border-attention/30 bg-attention-subtle"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base text-on-action ${urgent ? "bg-danger" : "bg-attention"}`}
        >
          {urgent ? <CriticalIcon /> : <AlertIcon />}
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-medium text-primary">{title}</p>
          <p className="text-metadata text-secondary">{sub}</p>
        </div>
        <Link
          to={`/w/${workspace.id}/more/settings/billing`}
          className={`inline-flex min-h-10 items-center rounded-control border border-border bg-surface px-4 text-body font-semibold text-primary hover:bg-surface-subtle ${FOCUS}`}
        >
          {t("usage.billingBanner.cta")}
        </Link>
      </div>
    );
  }

  if (!usage.state || usage.state === "normal") return null;

  const paused = usage.state === "paused";
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <div
      role={paused ? "alert" : "status"}
      data-testid="usage-notice"
      data-state={usage.state}
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3 sm:px-5 ${
        paused ? "border-danger/30 bg-danger-subtle" : "border-attention/30 bg-attention-subtle"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base text-on-action ${paused ? "bg-danger" : "bg-attention"}`}
      >
        {paused ? <CriticalIcon /> : <AlertIcon />}
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-medium text-primary">{t(`usage.state.${usage.state}`)}</p>
        <p className="text-metadata text-secondary tabular-nums">
          {t("usage.used", { used: number.format(usage.used), quota: number.format(usage.quota) })}
        </p>
      </div>
      <Link
        to={`/w/${workspace.id}/more/settings#usage`}
        className={`inline-flex min-h-10 items-center rounded-control border border-border bg-surface px-4 text-body font-semibold text-primary hover:bg-surface-subtle ${FOCUS}`}
      >
        {t("usage.details")}
      </Link>
    </div>
  );
}
