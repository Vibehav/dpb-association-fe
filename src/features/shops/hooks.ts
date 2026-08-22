/**
 * Server state for shops.
 *
 * Lists are infinite queries — there are ~1,000 shops and the register must never ship to
 * the phone in full (integration doc §5.2). Every mutation invalidates both the lists and
 * the touched detail, plus `people` where a link changed, so a transferred shop reads
 * correctly the moment you navigate back.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  linksApi,
  shopsApi,
  type AddShopLinkRequest,
  type RegisterShopRequest,
  type TransferRequest,
  type UpdateShopRequest
} from "../../api";
import { queryKeys } from "../../app/queryKeys";

export type ShopFilters = { query?: string; lane?: string };

export function useShopsList(filters: ShopFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.shops.list(filters),
    queryFn: ({ pageParam }) => shopsApi.list({ ...filters, page: pageParam }),
    initialPageParam: 0,
    // `page` is 0-based, so the last page is `totalPages - 1`.
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined)
  });
}

export function useShop(id: string) {
  return useQuery({
    queryKey: queryKeys.shops.detail(id),
    queryFn: () => shopsApi.detail(id)
  });
}

/** Invalidate everything a shop write can affect. */
function useShopInvalidation() {
  const queryClient = useQueryClient();
  return (shopId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.shops.all });
    // A link change alters a person's shop list, and registering an owner may have
    // created a person outright.
    queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    if (shopId) queryClient.invalidateQueries({ queryKey: queryKeys.shops.detail(shopId) });
  };
}

export function useRegisterShop() {
  const invalidate = useShopInvalidation();
  return useMutation({
    mutationFn: (body: RegisterShopRequest) => shopsApi.register(body),
    onSuccess: (shop) => invalidate(shop.id)
  });
}

export function useUpdateShop(id: string) {
  const invalidate = useShopInvalidation();
  return useMutation({
    mutationFn: (body: UpdateShopRequest) => shopsApi.update(id, body),
    onSuccess: () => invalidate(id)
  });
}

export function useDeleteShop() {
  const invalidate = useShopInvalidation();
  return useMutation({
    mutationFn: (id: string) => shopsApi.remove(id),
    onSuccess: (_result, id) => invalidate(id)
  });
}

export function useAddShopLink(id: string) {
  const invalidate = useShopInvalidation();
  return useMutation({
    mutationFn: (body: AddShopLinkRequest) => shopsApi.addLink(id, body),
    onSuccess: () => invalidate(id)
  });
}

export function useTransferLicence(id: string) {
  const invalidate = useShopInvalidation();
  return useMutation({
    mutationFn: (body: TransferRequest) => shopsApi.transfer(id, body),
    onSuccess: () => invalidate(id)
  });
}

/** Remove a RENTER or STAFF link. An OWNER link is a 400 — transfer replaces it instead. */
export function useRemoveLink(shopId?: string) {
  const invalidate = useShopInvalidation();
  return useMutation({
    mutationFn: (linkId: string) => linksApi.remove(linkId),
    onSuccess: () => invalidate(shopId)
  });
}
