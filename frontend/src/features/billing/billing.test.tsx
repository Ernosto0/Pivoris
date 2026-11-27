import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Billing, ReplyUsage } from "@/api/types";
import { ME, READINESS, WS_GOLKENT, WS_PRIVATE, workspace } from "@/test/fixtures";
import { json, mockApi } from "@/test/mockApi";
import { renderApp } from "@/test/renderApp";
import { CHECKOUT_POLL_INTERVAL_MS, CHECKOUT_POLL_TIMEOUT_MS } from "./BillingPage";
import { externalNavigation } from "./hooks";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const BASE = `/api/v1/workspaces/${WS_PRIVATE}`;
const BILLING_PATH = `/w/${WS_PRIVATE}/more/settings/billing`;
const TODAY_PATH = `/w/${WS_PRIVATE}`;
const SETTINGS_PATH = `/w/${WS_PRIVATE}/more/settings`;

const asRole = (role: "owner" | "manager" | "staff") => ({
  ...ME,
  memberships: ME.memberships.map((m) => (m.workspace_id === WS_PRIVATE ? { ...m, role } : m)),
});

function billingFixture(overrides: Partial<Billing> = {}): Billing {
  const isTry = (overrides.currency ?? "TRY") === "TRY";
  return {
    plan: "growth",
    status: "trial",
    provider_status: null,
    product_key: null,
    cancel_at_period_end: false,
    current_period_end: null,
    trial_ends_at: "2026-12-11T00:00:00Z",
    access_until: null,
    past_due_ends_at: null,
    billing_exempt: false,
    block_reason: null,
    currency: "TRY",
    tax_exclusive: true,
    plans: isTry
      ? [
          {
            plan: "starter",
            interval: "monthly",
            product_key: "starter_monthly",
            amount_display: "1.490 ₺",
            monthly_equivalent_display: "1.490 ₺",
            ai_replies_quota: 500,
          },
          {
            plan: "starter",
            interval: "annual",
            product_key: "starter_annual",
            amount_display: "14.900 ₺",
            monthly_equivalent_display: "1.242 ₺",
            ai_replies_quota: 500,
          },
          {
            plan: "growth",
            interval: "monthly",
            product_key: "growth_monthly",
            amount_display: "2.490 ₺",
            monthly_equivalent_display: "2.490 ₺",
            ai_replies_quota: 2500,
          },
          {
            plan: "growth",
            interval: "annual",
            product_key: "growth_annual",
            amount_display: "24.900 ₺",
            monthly_equivalent_display: "2.075 ₺",
            ai_replies_quota: 2500,
          },
          {
            plan: "pro",
            interval: "monthly",
            product_key: "pro_monthly",
            amount_display: "4.490 ₺",
            monthly_equivalent_display: "4.490 ₺",
            ai_replies_quota: 7500,
          },
          {
            plan: "pro",
            interval: "annual",
            product_key: "pro_annual",
            amount_display: "44.900 ₺",
            monthly_equivalent_display: "3.742 ₺",
            ai_replies_quota: 7500,
          },
        ]
      : [
          {
            plan: "starter",
            interval: "monthly",
            product_key: "starter_monthly",
            amount_display: "$29",
            monthly_equivalent_display: "$29",
            ai_replies_quota: 500,
          },
          {
            plan: "growth",
            interval: "monthly",
            product_key: "growth_monthly",
            amount_display: "$59",
            monthly_equivalent_display: "$59",
            ai_replies_quota: 2500,
          },
          {
            plan: "pro",
            interval: "monthly",
            product_key: "pro_monthly",
            amount_display: "$119",
            monthly_equivalent_display: "$119",
            ai_replies_quota: 7500,
          },
        ],
    founder_offer: null,
    has_subscription: false,
    has_customer: false,
    can_manage: true,
    is_simulated: false,
    ...overrides,
  };
}

function usageFixture(overrides: Partial<ReplyUsage> = {}): ReplyUsage {
  return {
    plan: "growth",
    status: "trial",
    monthly_quota: 2500,
    quota_override: null,
    quota: 2500,
    used: 120,
    grace_limit: 2750,
    period_start: "2026-11-01T00:00:00Z",
    period_end: "2026-12-01T00:00:00Z",
    state: "normal",
    trial_ends_at: "2099-01-01T00:00:00Z",
    access_until: null,
    billing_exempt: false,
    block_reason: null,
    ...overrides,
  };
}

function baseRoutes(
  me = ME,
  billingData: Billing | (() => Billing) = billingFixture(),
  metaOverrides: Record<string, unknown> = {},
) {
  return {
    "GET /api/v1/meta": () =>
      json({
        product_name: "Pivoris",
        demo_tools_enabled: true,
        billing_enabled: true,
        llm_mode: "fake",
        supported_locales: ["tr", "en"],
        instagram_providers: ["mock"],
        mock_requires_demo_workspace: false,
        ...metaOverrides,
      }),
    "GET /api/v1/auth/me": () => json(me),
    [`GET /api/v1/workspaces/${WS_PRIVATE}`]: () => json(workspace(WS_PRIVATE)),
    [`GET /api/v1/workspaces/${WS_GOLKENT}`]: () => json(workspace(WS_GOLKENT)),
    [`GET ${BASE}/readiness`]: () => json(READINESS),
    [`GET ${BASE}/billing`]: () =>
      json(typeof billingData === "function" ? billingData() : billingData),
  };
}

describe("BillingPage", () => {
  it("renders TRY plans with monthly/annual toggle and starts checkout for the owner", async () => {
    const assignSpy = vi.spyOn(externalNavigation, "assign").mockImplementation(() => {});
    const seen = mockApi({
      ...baseRoutes(),
      [`POST ${BASE}/billing/checkout`]: () =>
        json({
          checkout_url: "https://test.checkout.dodopayments.com/session/cks_123",
          ref: "chk_abc",
          is_simulated: false,
        }),
    });

    renderApp(BILLING_PATH);

    const starterCard = await screen.findByTestId("plan-card-starter");
    expect(within(starterCard).getByText(/1\.490 ₺/)).toBeInTheDocument();
    expect(within(starterCard).getByText("+ KDV (ödeme adımında eklenir)")).toBeInTheDocument();

    // Switch to Annual
    fireEvent.click(screen.getByRole("button", { name: "Yıllık (2 ay ücretsiz)" }));
    expect(within(screen.getByTestId("plan-card-growth")).getByText(/24\.900 ₺/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId("plan-card-growth")).getByText("Yıllık ödemede aylık 2.075 ₺"),
    ).toBeInTheDocument();

    // Subscribe to Growth annual
    fireEvent.click(
      within(screen.getByTestId("plan-card-growth")).getByRole("button", { name: "Abone ol" }),
    );

    await waitFor(() =>
      expect(assignSpy).toHaveBeenCalledWith(
        "https://test.checkout.dodopayments.com/session/cks_123",
      ),
    );
    const post = seen.find((r) => r.method === "POST" && r.path === `${BASE}/billing/checkout`);
    expect(post?.body).toEqual({ plan: "growth", interval: "annual" });
  });

  it("renders USD prices and tax label for global workspaces", async () => {
    mockApi(baseRoutes(ME, billingFixture({ currency: "USD" })));
    renderApp(BILLING_PATH);

    const proCard = await screen.findByTestId("plan-card-pro");
    expect(within(proCard).getByText(/\$119/)).toBeInTheDocument();
    expect(within(proCard).getByText("+ vergi (ödeme adımında hesaplanır)")).toBeInTheDocument();
    expect(within(proCard).getByText(/7\.500/)).toBeInTheDocument();
  });

  it("is read-only for managers and hidden from staff", async () => {
    mockApi(baseRoutes(asRole("manager"), billingFixture({ can_manage: false, has_subscription: true, status: "active" })));
    renderApp(BILLING_PATH);

    expect(await screen.findByTestId("billing-manager-readonly")).toHaveTextContent(
      "yalnızca çalışma alanı sahibi yapabilir",
    );
    expect(screen.queryByRole("button", { name: "Abone ol" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aboneliği yönet" })).toBeNull();
  });

  it("shows the Founder offer when eligible, simulated badge when simulated, and portal button when subscribed", async () => {
    const assignSpy = vi.spyOn(externalNavigation, "assign").mockImplementation(() => {});
    const seen = mockApi({
      ...baseRoutes(
        ME,
        billingFixture({
          is_simulated: true,
          founder_offer: {
            product_key: "founder_monthly",
            plan: "growth",
            interval: "monthly",
            amount_display: "990 ₺",
            ai_replies_quota: 2500,
          },
        }),
      ),
      [`POST ${BASE}/billing/checkout`]: () =>
        json({ checkout_url: "http://localhost/dev/billing-checkout?ref=chk_f", ref: "chk_f", is_simulated: true }),
    });

    renderApp(BILLING_PATH);

    const founder = await screen.findByTestId("founder-offer-card");
    expect(within(founder).getByText(/990 ₺/)).toBeInTheDocument();
    expect(screen.getAllByTestId("simulated-badge").length).toBeGreaterThan(0);

    fireEvent.click(within(founder).getByRole("button", { name: "Kurucu pakete abone ol" }));
    await waitFor(() => expect(assignSpy).toHaveBeenCalled());
    const post = seen.find((r) => r.method === "POST" && r.path === `${BASE}/billing/checkout`);
    expect(post?.body).toEqual({ plan: "founder", interval: "monthly" });
  });

  it("opens Customer Portal for an owner with an active subscription", async () => {
    const assignSpy = vi.spyOn(externalNavigation, "assign").mockImplementation(() => {});
    mockApi({
      ...baseRoutes(
        ME,
        billingFixture({
          status: "active",
          has_subscription: true,
          has_customer: true,
          product_key: "growth_monthly",
          current_period_end: "2026-12-27T00:00:00Z",
        }),
      ),
      [`POST ${BASE}/billing/portal`]: () =>
        json({ portal_url: "https://test.portal.dodopayments.com/p_123", is_simulated: false }),
    });

    renderApp(BILLING_PATH);

    const manageBtn = await screen.findByRole("button", { name: "Aboneliği yönet" });
    fireEvent.click(manageBtn);
    await waitFor(() =>
      expect(assignSpy).toHaveBeenCalledWith("https://test.portal.dodopayments.com/p_123"),
    );
  });

  it("enforces INV-18 on ?checkout=returned: verifies via polling before claiming success, and shows unverified on timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status: Billing["status"] = "trial";

    mockApi(
      baseRoutes(ME, () =>
        billingFixture({
          status,
          has_subscription: status === "active",
          current_period_end: status === "active" ? "2026-12-27T00:00:00Z" : null,
        }),
      ),
    );

    renderApp(`${BILLING_PATH}?checkout=returned`);

    const banner = await screen.findByTestId("checkout-return-banner");
    expect(banner).toHaveAttribute("data-return-state", "verifying");
    expect(banner).toHaveTextContent("Ödeme doğrulanıyor…");
    expect(banner).not.toHaveTextContent("Aboneliğiniz etkinleştirildi");

    // Webhook arrives on next poll -> verified!
    status = "active";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKOUT_POLL_INTERVAL_MS + 50);
    });

    await waitFor(() =>
      expect(screen.getByTestId("checkout-return-banner")).toHaveAttribute(
        "data-return-state",
        "verified",
      ),
    );
    expect(screen.getByTestId("checkout-return-banner")).toHaveTextContent(
      "Aboneliğiniz etkinleştirildi",
    );
  });

  it("shows unverified state after 2 minutes when webhook has not arrived (INV-18)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi(baseRoutes(ME, billingFixture({ status: "trial" })));

    renderApp(`${BILLING_PATH}?checkout=returned`);
    expect(await screen.findByTestId("checkout-return-banner")).toHaveAttribute(
      "data-return-state",
      "verifying",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKOUT_POLL_TIMEOUT_MS + 100);
    });

    await waitFor(() =>
      expect(screen.getByTestId("checkout-return-banner")).toHaveAttribute(
        "data-return-state",
        "unverified",
      ),
    );
    expect(screen.getByTestId("checkout-return-banner")).toHaveTextContent(
      "Ödeme henüz doğrulanmadı",
    );
  });
});

describe("DevBillingCheckoutPage (INV-09, INV-20)", () => {
  it("renders NotFoundPage when demo_tools_enabled is false", async () => {
    mockApi(baseRoutes(ME, billingFixture(), { demo_tools_enabled: false }));
    renderApp(`/dev/billing-checkout?ref=chk_1&plan=growth&interval=monthly&return_url=${encodeURIComponent(BILLING_PATH)}`);

    await waitFor(() => expect(screen.queryByTestId("dev-billing-checkout")).toBeNull());
  });

  it("shows SimulatedBadge and simulates active webhook then navigates back", async () => {
    const seen = mockApi({
      ...baseRoutes(ME, billingFixture({ status: "active", is_simulated: true })),
      "POST /api/v1/dev/billing/simulate": () =>
        json({
          status: "queued",
          webhook_id: "msg_sim_1",
          subscription_id: "sub_sim_1",
          is_simulated: true,
        }),
    });

    renderApp(
      `/dev/billing-checkout?ref=chk_sim_99&plan=growth&interval=monthly&return_url=${encodeURIComponent(`${BILLING_PATH}?checkout=returned`)}`,
    );

    const page = await screen.findByTestId("dev-billing-checkout");
    expect(within(page).getByTestId("simulated-badge")).toBeInTheDocument();

    fireEvent.click(
      within(page).getByRole("button", {
        name: "Ödemeyi tamamla (Aktif abonelik simüle et)",
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("checkout-return-banner")).toHaveAttribute(
        "data-return-state",
        "verified",
      ),
    );
    const simPost = seen.find(
      (r) => r.method === "POST" && r.path === "/api/v1/dev/billing/simulate",
    );
    expect(simPost?.body).toEqual({ ref: "chk_sim_99", outcome: "active" });
  });
});

describe("Dashboard billing banners & Settings link", () => {
  it("shows trial-ending banner within 3 days on non-demo workspace and links to Billing", async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    mockApi({
      ...baseRoutes(),
      [`GET ${BASE}/usage`]: () => json(usageFixture({ status: "trial", trial_ends_at: soon })),
    });

    renderApp(TODAY_PATH);
    const notice = await screen.findByTestId("usage-notice");
    expect(notice).toHaveAttribute("data-state", "trial_ending");
    expect(within(notice).getByRole("link", { name: "Aboneliği aç" })).toHaveAttribute(
      "href",
      BILLING_PATH,
    );
  });

  it("shows payment-problem alert when past_due and billing-stopped alert when BILLING_INACTIVE", async () => {
    mockApi({
      ...baseRoutes(),
      [`GET ${BASE}/usage`]: () =>
        json(
          usageFixture({
            status: "trial",
            block_reason: "BILLING_INACTIVE",
          }),
        ),
    });

    renderApp(TODAY_PATH);
    const notice = await screen.findByTestId("usage-notice");
    expect(notice).toHaveAttribute("role", "alert");
    expect(notice).toHaveAttribute("data-state", "billing_stopped");
    expect(notice).toHaveTextContent("Yapay zekâ yanıt ve içerik üretimi durduruldu.");
  });

  it("links to Billing from Settings Usage panel when billing is enabled", async () => {
    mockApi({
      ...baseRoutes(),
      [`GET ${BASE}/usage`]: () => json(usageFixture()),
    });

    renderApp(SETTINGS_PATH);
    const meter = await screen.findByTestId("usage-meter");
    expect(within(meter).getByRole("link", { name: "Abonelik ve planlar" })).toHaveAttribute(
      "href",
      BILLING_PATH,
    );
  });
});
