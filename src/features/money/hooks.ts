/**
 * Server state for money: receipts, the fee year, the general fund (with its opening balance),
 * donors and the dashboard. Events and spending have their own hooks in `features/events` and
 * `features/spending`, but share `useMoneyInvalidation`.
 *
 * One rule governs the writes: a receipt moves **many** figures at once — the fund, the
 * dashboard, a shop's fee status, a payer's lifetime total, the audit list — so every money
 * mutation invalidates all of them through `useMoneyInvalidation`. Nothing is patched by hand
 * in the cache; the server's derived totals are the only totals.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  contributionsApi,
  dashboardApi,
  donorsApi,
  feeCyclesApi,
  fundApi,
  isCode,
  type CancelContributionRequest,
  type CorrectContributionRequest,
  type CreateContributionRequest,
  type CreateFeeCycleRequest,
  type Id,
  type SetOpeningBalanceRequest,
  type UpdateDonorRequest,
  type UpdateFeeCycleRequest
} from "../../api";
import { peopleCountQueryHash, shopCountQueryHash } from "../../app/countQueries";
import { isIdProofQuery, queryKeys } from "../../app/queryKeys";

/**
 * Everything a money write can change. Since Phase 2 that includes every event's figures and
 * the spending lists: a cancelled donation, a voided bill or a close moves money between an
 * event and the general fund. A bill's signed URL is left alone — it is fetched on demand.
 */
export function useMoneyInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: queryKeys.fund.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    // A cash receipt collected, cancelled or corrected moves a collector's cash figures.
    queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    queryClient.invalidateQueries({
      queryKey: queryKeys.spendings.all,
      predicate: (query) => query.queryKey[3] !== "bill"
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.feeCycles.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.donors.all });
    // Fee chips and fee cards.
    queryClient.invalidateQueries({
      queryKey: queryKeys.shops.all,
      predicate: (query) => query.queryHash !== shopCountQueryHash
    });
    // Lifetime totals and histories. Never an ID-proof URL — every refetch is an audit row.
    queryClient.invalidateQueries({
      queryKey: queryKeys.people.all,
      predicate: (query) => query.queryHash !== peopleCountQueryHash && !isIdProofQuery(query)
    });
  };
}

// ---- dashboard ---------------------------------------------------------------

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => dashboardApi.get() });
}

// ---- receipts ------------------------------------------------------------------

export function useReceipt(id: Id) {
  return useQuery({
    queryKey: queryKeys.contributions.receipt(id),
    queryFn: () => contributionsApi.receipt(id)
  });
}

/**
 * The collection form's save. A short fee amount rejects with 409
 * `part_payment_unconfirmed` — the caller shows its message and resends confirmed.
 */
export function useCollect() {
  const invalidate = useMoneyInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContributionRequest) => contributionsApi.create(body),
    onSuccess: (receipt) => {
      invalidate();
      queryClient.setQueryData(queryKeys.contributions.receipt(receipt.id), receipt);
    }
  });
}

export function useCancelReceipt(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: CancelContributionRequest) => contributionsApi.cancel(id, body),
    onSuccess: () => invalidate()
  });
}

/** Resolves to the **new** receipt; the original is now cancelled. */
export function useCorrectReceipt(id: Id) {
  const invalidate = useMoneyInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CorrectContributionRequest) => contributionsApi.correct(id, body),
    onSuccess: (replacement) => {
      invalidate();
      queryClient.setQueryData(queryKeys.contributions.receipt(replacement.id), replacement);
    }
  });
}

export function useCancelledReceipts() {
  return useInfiniteQuery({
    queryKey: queryKeys.contributions.cancelled,
    queryFn: ({ pageParam }) => contributionsApi.cancelled({ page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined)
  });
}

// ---- fee year (admin) ------------------------------------------------------------

/**
 * The open fee year, or **null when none is open**. The API answers that state with
 * 404 `no_open_cycle`; it is the normal "no fee set yet" screen, not an error to show.
 */
export function useCurrentFeeCycle() {
  return useQuery({
    queryKey: queryKeys.feeCycles.current,
    queryFn: async () => {
      try {
        return await feeCyclesApi.current();
      } catch (error) {
        if (isCode(error, "no_open_cycle")) return null;
        throw error;
      }
    }
  });
}

export function useFeeCycleHistory() {
  return useQuery({ queryKey: queryKeys.feeCycles.history, queryFn: () => feeCyclesApi.history() });
}

export function useCreateFeeCycle() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: CreateFeeCycleRequest) => feeCyclesApi.create(body),
    onSuccess: () => invalidate()
  });
}

export function useUpdateFeeCycle(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: UpdateFeeCycleRequest) => feeCyclesApi.update(id, body),
    onSuccess: () => invalidate()
  });
}

export function useRaiseDemand(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: () => feeCyclesApi.raiseDemand(id),
    onSuccess: () => invalidate()
  });
}

export function useCloseFeeCycle(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: () => feeCyclesApi.close(id),
    onSuccess: () => invalidate()
  });
}

// ---- general fund (admin) ---------------------------------------------------------

export function useFundSummary() {
  return useQuery({ queryKey: queryKeys.fund.summary, queryFn: () => fundApi.summary() });
}

export function useFundIncome() {
  return useInfiniteQuery({
    queryKey: queryKeys.fund.income,
    queryFn: ({ pageParam }) => fundApi.income({ page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined)
  });
}

/** Running costs and event support. Loaded only when the Spendings tab is open. */
export function useFundSpendings(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.fund.spendings,
    queryFn: ({ pageParam }) => fundApi.spendings({ page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled
  });
}

export function useSetOpeningBalance() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: SetOpeningBalanceRequest) => fundApi.setOpeningBalance(body),
    onSuccess: () => invalidate()
  });
}

export function useVoidOpeningBalance() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (note: string) => fundApi.voidOpeningBalance(note),
    onSuccess: () => invalidate()
  });
}

// ---- donors -------------------------------------------------------------------------

export function useDonor(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.donors.detail(id ?? -1),
    queryFn: () => donorsApi.detail(id as Id),
    enabled: id !== undefined
  });
}

/** Nothing is listed until the user types — the payer search is search-first, like members. */
export function useDonorSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.donors.list({ query }),
    queryFn: () => donorsApi.search({ query }),
    enabled: enabled && query.length > 0
  });
}

export function useUpdateDonor(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: UpdateDonorRequest) => donorsApi.update(id, body),
    onSuccess: () => invalidate()
  });
}
