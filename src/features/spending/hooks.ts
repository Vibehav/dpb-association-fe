/**
 * Server state for spending (v2 Phase 2) — admin only. A spending moves an event's figures, the
 * general fund and Home together, so every write goes through `useMoneyInvalidation`.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  spendingsApi,
  type CreateSpendingRequest,
  type Id,
  type UpdateSpendingRequest,
  type VoidSpendingRequest
} from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useMoneyInvalidation } from "../money/hooks";

export function useSpending(id: Id) {
  return useQuery({ queryKey: queryKeys.spendings.detail(id), queryFn: () => spendingsApi.get(id) });
}

/**
 * The bill's signed URL — fetched only when the admin asks to see it, and never kept: it
 * expires within minutes, so a cached one would show a broken image later.
 */
export function useBillUrl(id: Id, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.spendings.bill(id),
    queryFn: () => spendingsApi.billUrl(id),
    enabled,
    staleTime: 0,
    gcTime: 0
  });
}

/**
 * Rejects with 409 `event_fund_short` when an event's fund can't cover the bill — the split
 * offer; the caller asks and resends with `splitToGeneral: true`.
 */
export function useRecordSpending() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: CreateSpendingRequest) => spendingsApi.record(body),
    onSuccess: () => invalidate()
  });
}

export function useUpdateSpending(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: UpdateSpendingRequest) => spendingsApi.update(id, body),
    onSuccess: () => invalidate()
  });
}

export function useAttachBill(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (billKey: string) => spendingsApi.attachBill(id, billKey),
    onSuccess: () => invalidate()
  });
}

export function useVoidSpending(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: VoidSpendingRequest) => spendingsApi.void(id, body),
    onSuccess: () => invalidate()
  });
}
