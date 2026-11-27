import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NotFoundPage } from "@/app/NotFoundPage";
import type { DevBillingSimulateBody } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Skeleton } from "@/components/Feedback";
import { PageHeader } from "@/components/Layout";
import { SimulatedBadge } from "@/components/SimulatedBadge";
import { useMeta } from "@/features/auth/hooks";
import { useSimulateBilling } from "./hooks";

/** Resolve a return_url from query params to a safe internal router path (never an external origin). */
function safeInternalReturnPath(raw: string | null): string {
  if (!raw) return "/";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    }
    if (parsed.pathname.startsWith("/") && !parsed.pathname.startsWith("//")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return "/";
  }
  return "/";
}

/**
 * Dev-only simulated checkout & portal page used by `FakeBillingProvider` (`BILLING_PROVIDER=fake`).
 * Refused with NotFoundPage unless `demo_tools_enabled` is true (INV-20) and carries `<SimulatedBadge />` (INV-09).
 */
export function DevBillingCheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const meta = useMeta();
  const simulate = useSimulateBilling();

  if (meta.isPending) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Skeleton label={t("common.loading")} rows={3} />
      </main>
    );
  }
  if (!meta.data?.demo_tools_enabled) {
    return <NotFoundPage />;
  }

  const isPortal = params.get("portal") === "1";
  const ref = params.get("ref") ?? "";
  const plan = params.get("plan") ?? "";
  const interval = params.get("interval") ?? "";
  const returnPath = safeInternalReturnPath(params.get("return_url"));

  function triggerOutcome(outcome: NonNullable<DevBillingSimulateBody["outcome"]>) {
    if (!ref) return;
    simulate.mutate(
      { ref, outcome },
      {
        onSuccess: () => {
          navigate(returnPath);
        },
      },
    );
  }

  return (
    <main
      data-testid="dev-billing-checkout"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-10"
    >
      <div className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-6 shadow-xs">
        <PageHeader
          title={isPortal ? t("billing.devCheckout.portalTitle") : t("billing.devCheckout.title")}
          description={
            isPortal ? t("billing.devCheckout.portalSubtitle") : t("billing.devCheckout.subtitle")
          }
          action={<SimulatedBadge />}
        />

        {!isPortal ? (
          <>
            <dl className="grid gap-3 rounded-control border border-border bg-surface-subtle p-4 text-body sm:grid-cols-3">
              <div>
                <dt className="text-metadata font-semibold text-secondary">
                  {t("billing.devCheckout.planLabel")}
                </dt>
                <dd className="mt-0.5 font-semibold text-primary">{plan || "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata font-semibold text-secondary">
                  {t("billing.devCheckout.intervalLabel")}
                </dt>
                <dd className="mt-0.5 font-semibold text-primary">{interval || "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata font-semibold text-secondary">
                  {t("billing.devCheckout.refLabel")}
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-primary">{ref || "—"}</dd>
              </div>
            </dl>

            {simulate.isError ? <ErrorMessage error={simulate.error} /> : null}

            <div className="flex flex-col gap-2.5">
              <Button
                pending={simulate.isPending}
                disabled={!ref || simulate.isPending}
                onClick={() => triggerOutcome("active")}
              >
                {t("billing.devCheckout.approve")}
              </Button>
              <Button
                variant="secondary"
                pending={simulate.isPending}
                disabled={!ref || simulate.isPending}
                onClick={() => triggerOutcome("past_due")}
              >
                {t("billing.devCheckout.pastDue")}
              </Button>
              <Button
                variant="secondary"
                pending={simulate.isPending}
                disabled={!ref || simulate.isPending}
                onClick={() => triggerOutcome("cancelled_end_of_period")}
              >
                {t("billing.devCheckout.cancelEnd")}
              </Button>
            </div>
          </>
        ) : null}

        <div>
          <Button variant="ghost" onClick={() => navigate(returnPath)}>
            {t("billing.devCheckout.back")}
          </Button>
        </div>
      </div>
    </main>
  );
}
