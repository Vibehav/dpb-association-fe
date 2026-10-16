/**
 * Server state for cash handover (v2 Phase 3). Every write goes through `useMoneyInvalidation`,
 * which also refreshes `cash/*` — and every receipt write does too, since collecting, cancelling
 * or correcting a cash receipt moves a collector's figures.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { cashApi, type HandoverStatus, type Id, type ReceiveHandoverRequest, type SettleRequest } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useMoneyInvalidation } from "../money/hooks";

/** Account's card. Only asked for by a collector or an admin; an admin gets zeros. */
export function useMyCash(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.cash.me, queryFn: () => cashApi.me(), enabled });
}

export function useCollectorsCash(enabled = true) {
  return useQuery({ queryKey: queryKeys.cash.collectors, queryFn: () => cashApi.collectors(), enabled });
}

export function useCollectorCash(id: Id) {
  return useQuery({ queryKey: queryKeys.cash.collector(id), queryFn: () => cashApi.collector(id) });
}

/** The first page is plenty here: waiting handovers are few, and the history is recent-first. */
export function useHandovers(status: HandoverStatus) {
  return useQuery({ queryKey: queryKeys.cash.handovers(status), queryFn: () => cashApi.handovers({ status }) });
}

export function useHandover(id: Id) {
  return useQuery({ queryKey: queryKeys.cash.handover(id), queryFn: () => cashApi.handover(id) });
}

export function useHandOver() {
  const invalidate = useMoneyInvalidation();
  return useMutation({ mutationFn: () => cashApi.handOver(), onSuccess: () => invalidate() });
}

export function useWithdrawHandover() {
  const invalidate = useMoneyInvalidation();
  return useMutation({ mutationFn: (id: Id) => cashApi.withdraw(id), onSuccess: () => invalidate() });
}

export function useReceiveHandover() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: ({ id, body }: { id: Id; body: ReceiveHandoverRequest }) => cashApi.receive(id, body),
    onSuccess: () => invalidate()
  });
}

export function useSettle(collectorId: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({ mutationFn: (body: SettleRequest) => cashApi.settle(collectorId, body), onSuccess: () => invalidate() });
}
