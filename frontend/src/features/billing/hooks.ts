import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { AppError } from "@/api/errors";
import type {
  Billing,
  BillingCheckoutBody,
  BillingCheckoutOut,
  BillingPortalOut,
  DevBillingSimulateBody,
  DevBillingSimulateOut,
} from "@/api/types";

export const billingKey = (ws: string) => ["billing", ws] as const;

/** Wrapper around browser external navigation so tests can assert redirects cleanly in jsdom. */
export const externalNavigation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};

export function useBilling(
  ws: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery<Billing, AppError>({
    queryKey: billingKey(ws),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? false,
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/workspaces/{workspace_id}/billing", {
          params: { path: { workspace_id: ws } },
        }),
      ),
    retry: false,
  });
}

export function useStartCheckout(ws: string) {
  const queryClient = useQueryClient();
  return useMutation<BillingCheckoutOut, AppError, BillingCheckoutBody>({
    mutationFn: (body) =>
      unwrap(
        api.POST("/api/v1/workspaces/{workspace_id}/billing/checkout", {
          params: { path: { workspace_id: ws } },
          body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKey(ws) }),
  });
}

export function useOpenPortal(ws: string) {
  return useMutation<BillingPortalOut, AppError>({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/workspaces/{workspace_id}/billing/portal", {
          params: { path: { workspace_id: ws } },
        }),
      ),
  });
}

export function useSimulateBilling(ws?: string) {
  const queryClient = useQueryClient();
  return useMutation<DevBillingSimulateOut, AppError, DevBillingSimulateBody>({
    mutationFn: (body) => unwrap(api.POST("/api/v1/dev/billing/simulate", { body })),
    onSuccess: () => {
      if (ws) {
        return Promise.all([
          queryClient.invalidateQueries({ queryKey: billingKey(ws) }),
          queryClient.invalidateQueries({ queryKey: ["reply-usage", ws] }),
        ]);
      }
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing"] }),
        queryClient.invalidateQueries({ queryKey: ["reply-usage"] }),
      ]);
    },
  });
}
