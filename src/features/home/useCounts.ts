import { useQuery } from "@tanstack/react-query";
import { peopleApi, shopsApi } from "../../api";
import { COUNT_ONLY } from "../../app/countQueries";
import { queryKeys } from "../../app/queryKeys";

/**
 * Shop and people totals for the Home screen.
 *
 * The counts come from `totalElements` on a one-row page — what integration doc §5.1
 * prescribes. The money on Home comes from `GET /dashboard` (v2 Phase 1); these two stay as
 * they were, because "people on record" is not the dashboard's `peopleLinked`.
 */
export function useShopCount() {
  return useQuery({
    queryKey: queryKeys.shops.list(COUNT_ONLY),
    queryFn: () => shopsApi.list(COUNT_ONLY),
    select: (page) => page.totalElements,
    // Totals change only after an explicit Home refresh or a relevant successful write.
    staleTime: Infinity
  });
}

export function usePeopleCount() {
  return useQuery({
    queryKey: queryKeys.people.list(COUNT_ONLY),
    queryFn: () => peopleApi.list(COUNT_ONLY),
    select: (page) => page.totalElements,
    staleTime: Infinity
  });
}
