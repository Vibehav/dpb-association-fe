/**
 * Server state for events (v2 Phase 2). Every write goes through `useMoneyInvalidation`: closing
 * an event or moving its balance changes the general fund and Home as well as the event.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, type EventRequest, type Id } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useMoneyInvalidation } from "../money/hooks";

function nextPage(last: { page: number; totalPages: number }) {
  return last.page + 1 < last.totalPages ? last.page + 1 : undefined;
}

/** The Events tab — Active, then Open, then Closed, as the server sorts them. */
export function useEventsList() {
  return useInfiniteQuery({
    queryKey: queryKeys.events.list({}),
    queryFn: ({ pageParam }) => eventsApi.list({ page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextPage
  });
}

/** The collection form's picker. Only fetched while "Event donation" is chosen. */
export function useCollectableEvents(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.events.collectable, queryFn: () => eventsApi.collectable(), enabled });
}

export function useEvent(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(id ?? -1),
    queryFn: () => eventsApi.detail(id as Id),
    enabled: id !== undefined
  });
}

export function useEventIncome(id: Id, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.events.income(id),
    queryFn: ({ pageParam }) => eventsApi.income(id, { page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled
  });
}

/** Admin only — never enabled for anyone else, since the endpoint refuses them. */
export function useEventSpendings(id: Id, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.events.spendings(id),
    queryFn: ({ pageParam }) => eventsApi.spendings(id, { page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled
  });
}

export function useCreateEvent() {
  const invalidate = useMoneyInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EventRequest) => eventsApi.create(body),
    onSuccess: (event) => {
      invalidate();
      queryClient.setQueryData(queryKeys.events.detail(event.id), event);
    }
  });
}

export function useUpdateEvent(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (body: EventRequest) => eventsApi.update(id, body),
    onSuccess: () => invalidate()
  });
}

/**
 * Not the full money invalidation: that would refetch this event's own page while it is
 * still on screen and earn a 404. An empty event moved no money, so the lists and the picker
 * are all that change.
 */
export function useDeleteEvent(id: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => eventsApi.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.events.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.collectable });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
}

export function useCloseEvent(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (moveBalance?: boolean) => eventsApi.close(id, moveBalance),
    onSuccess: () => invalidate()
  });
}

export function useMoveEventBalance(id: Id) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: () => eventsApi.moveBalance(id),
    onSuccess: () => invalidate()
  });
}
