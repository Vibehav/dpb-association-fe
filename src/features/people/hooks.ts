/**
 * Server state for people.
 *
 * The Aadhaar query is the one to be careful with: it is only ever enabled for an admin,
 * on an explicit tap, and its cached signed URL is dropped quickly because the URL itself
 * expires in five minutes and every fetch is logged server-side as a view.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  peopleApi,
  type AadhaarSide,
  type AddPersonLinkRequest,
  type CreatePersonRequest,
  type LinkRole,
  type UpdatePersonRequest
} from "../../api";
import { queryKeys } from "../../app/queryKeys";

export type PeopleFilters = { query?: string; role?: LinkRole };

export function usePeopleList(filters: PeopleFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.people.list(filters),
    queryFn: ({ pageParam }) => peopleApi.list({ ...filters, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined)
  });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: queryKeys.people.detail(id),
    queryFn: () => peopleApi.detail(id)
  });
}

function usePersonInvalidation() {
  const queryClient = useQueryClient();
  return (personId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.people.all });
    // A link change alters the shop's people list too.
    queryClient.invalidateQueries({ queryKey: queryKeys.shops.all });
    if (personId) queryClient.invalidateQueries({ queryKey: queryKeys.people.detail(personId) });
  };
}

/** Standalone add. Needs at least one RENTER/STAFF link — OWNER here is a 400. */
export function useCreatePerson() {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (body: CreatePersonRequest) => peopleApi.create(body),
    onSuccess: (person) => invalidate(person.id)
  });
}

export function useUpdatePerson(id: string) {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (body: UpdatePersonRequest) => peopleApi.update(id, body),
    onSuccess: () => invalidate(id)
  });
}

export function useAddPersonLink(id: string) {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (body: AddPersonLinkRequest) => peopleApi.addLink(id, body),
    onSuccess: () => invalidate(id)
  });
}

export function useDeletePerson() {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (id: string) => peopleApi.remove(id),
    onSuccess: (_result, id) => invalidate(id)
  });
}

export function useUpdatePhoto(id: string) {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (key: string) => peopleApi.updatePhoto(id, key),
    onSuccess: () => invalidate(id)
  });
}

export function useUpdateAadhaar(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ side, key }: { side: AadhaarSide; key: string }) =>
      peopleApi.updateAadhaar(id, side, key),
    onSuccess: (_result, { side }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people.detail(id) });
      // Drop any signed URL for the side that was replaced.
      queryClient.removeQueries({ queryKey: queryKeys.people.aadhaar(id, side) });
    }
  });
}

/**
 * A signed URL for a stored Aadhaar image.
 *
 * **Admin only, and every successful call writes a VIEW row to `aadhaar_access_log`.** Pass
 * `enabled` false for anyone else — the rule is not to call it at all, not to call it and
 * handle the 403 (integration doc §9).
 */
export function useAadhaarUrl(id: string, side: AadhaarSide, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.people.aadhaar(id, side),
    queryFn: () => peopleApi.aadhaarUrl(id, side),
    enabled,
    // The URL lives ~5 minutes. Don't hand a stale one to an <Image>, and don't keep it
    // around in memory longer than it's usable.
    staleTime: 4 * 60 * 1000,
    gcTime: 4 * 60 * 1000,
    retry: false
  });
}
