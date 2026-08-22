import { useQuery } from "@tanstack/react-query";
import { peopleApi, shopsApi } from "../../api";
import { queryKeys } from "../../app/queryKeys";

/**
 * Shop and people totals for the Home screen.
 *
 * v1 has no dashboard endpoint, so the counts come from `totalElements` on a
 * one-row page — exactly what integration doc §5.1 prescribes. Nothing else goes on
 * Home: fund balances, event cards, pending collections and top contributors are all v2.
 */
const COUNT_ONLY = { size: 1 } as const;

export function useShopCount() {
  return useQuery({
    queryKey: queryKeys.shops.list(COUNT_ONLY),
    queryFn: () => shopsApi.list(COUNT_ONLY),
    select: (page) => page.totalElements
  });
}

export function usePeopleCount() {
  return useQuery({
    queryKey: queryKeys.people.list(COUNT_ONLY),
    queryFn: () => peopleApi.list(COUNT_ONLY),
    select: (page) => page.totalElements
  });
}
