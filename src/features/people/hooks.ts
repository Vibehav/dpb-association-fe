/**
 * Server state for people.
 *
 * The ID-proof query is the one to be careful with: it is only ever enabled for an admin,
 * on an explicit tap, and its cached signed URL is dropped quickly because the URL itself
 * expires in five minutes and every fetch is logged server-side as a view.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  peopleApi,
  type AddPersonLinkRequest,
  type Id,
  type CreatePersonRequest,
  type IdProofReplaceRequest,
  type IdProofFilter,
  type IdProofSide,
  type LinkRole,
  type PhotoFilter,
  type UpdatePersonRequest
} from "../../api";
import { isIdProofQuery, queryKeys } from "../../app/queryKeys";
import { COUNT_ONLY, peopleCountQueryHash, shopCountQueryHash } from "../../app/countQueries";

export type PeopleFilters = {
  query?: string;
  role?: LinkRole;
  idProof?: IdProofFilter;
  photo?: PhotoFilter;
};

export function usePeopleList(filters: PeopleFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.people.list(filters),
    queryFn: ({ pageParam }) => peopleApi.list({ ...filters, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined)
  });
}

export function usePerson(id: Id) {
  return useQuery({
    queryKey: queryKeys.people.detail(id),
    queryFn: () => peopleApi.detail(id)
  });
}

function usePersonInvalidation() {
  const queryClient = useQueryClient();
  return (personId?: Id) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.people.all,
      // Never let a bulk refresh touch an ID-proof URL — every refetch is an audit row.
      predicate: (query) =>
        query.queryHash !== peopleCountQueryHash && !isIdProofQuery(query)
    });
    // A link change alters the shop's people list too.
    queryClient.invalidateQueries({
      queryKey: queryKeys.shops.all,
      predicate: (query) => query.queryHash !== shopCountQueryHash
    });
    if (personId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.detail(personId),
        predicate: (query) => !isIdProofQuery(query)
      });
    }
  };
}

/** Standalone add. Needs at least one RENTER/STAFF link — OWNER here is a 400. */
export function useCreatePerson() {
  const invalidate = usePersonInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePersonRequest) => peopleApi.create(body),
    onSuccess: (person) => {
      invalidate(person.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.people.list(COUNT_ONLY) });
    }
  });
}

export function useUpdatePerson(id: Id) {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (body: UpdatePersonRequest) => peopleApi.update(id, body),
    onSuccess: () => invalidate(id)
  });
}

export function useAddPersonLink(id: Id) {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (body: AddPersonLinkRequest) => peopleApi.addLink(id, body),
    onSuccess: () => invalidate(id)
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => peopleApi.remove(id),
    onSuccess: () => {
      // `lists`, not `all`. Invalidating `all` refetched the deleted person's *detail* and
      // any revealed *ID-proof* query — both keyed beneath it — producing a pair of
      // `404 person_not_found` calls the instant a member was deleted.
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.lists,
        predicate: (query) => query.queryHash !== peopleCountQueryHash
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.people.list(COUNT_ONLY) });
      // Shops the person was linked to have lost a row.
      queryClient.invalidateQueries({
        queryKey: queryKeys.shops.all,
        predicate: (query) => query.queryHash !== shopCountQueryHash
      });
    }
  });
}

export function useUpdatePhoto(id: Id) {
  const invalidate = usePersonInvalidation();
  return useMutation({
    mutationFn: (key: string) => peopleApi.updatePhoto(id, key),
    onSuccess: () => invalidate(id)
  });
}

/** Re-capture one side. The document type is untouched. */
export function useRecaptureIdProofSide(id: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ side, key }: { side: IdProofSide; key: string }) =>
      peopleApi.updateIdProofSide(id, side, key),
    onSuccess: (_result, { side }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.detail(id),
        predicate: (query) => !isIdProofQuery(query)
      });
      // `remove`, not `invalidate`. Two independent reasons, both load-bearing:
      //  1. the superseded object is enqueued into `orphaned_media` and deleted by a daily
      //     job, so a signed URL we still hold points at bytes that will stop existing;
      //  2. invalidating an *active* query refetches it, and a refetch writes a VIEW row to
      //     `id_proof_access_log` that the admin never asked for.
      queryClient.removeQueries({ queryKey: queryKeys.people.idProof(id, side) });
    }
  });
}

/**
 * Replace the whole document — the only way to change its type.
 *
 * Both sides are superseded: the new front replaces the old one, and an omitted `backKey`
 * clears the back outright. Every signed URL we hold is about to 404 for good.
 */
export function useReplaceIdProof(id: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IdProofReplaceRequest) => peopleApi.replaceIdProof(id, body),
    onSuccess: () => {
      // The type and last four live on the profile.
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.detail(id),
        predicate: (query) => !isIdProofQuery(query)
      });
      queryClient.removeQueries({ queryKey: queryKeys.people.idProof(id, "FRONT") });
      queryClient.removeQueries({ queryKey: queryKeys.people.idProof(id, "BACK") });
    }
  });
}

/**
 * Take the document off file. Admin only; the member returns to **pending**.
 *
 * Mirrors {@link useReplaceIdProof}'s cache handling, and for the same reasons: the profile
 * carries the type and last four, and any signed URL we hold is about to point at bytes the
 * server has queued for deletion. `removeQueries`, never `invalidate` — invalidating an
 * *active* ID-proof query refetches it, and that refetch is a VIEW row in the audit log that
 * nobody asked for. Here it would also be a VIEW of a document that no longer exists.
 */
export function useRemoveIdProof(id: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => peopleApi.removeIdProof(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.detail(id),
        predicate: (query) => !isIdProofQuery(query)
      });
      queryClient.removeQueries({ queryKey: queryKeys.people.idProof(id, "FRONT") });
      queryClient.removeQueries({ queryKey: queryKeys.people.idProof(id, "BACK") });
      // The member has just re-entered the pending queue, so every people list is stale.
      queryClient.invalidateQueries({
        queryKey: queryKeys.people.lists,
        predicate: (query) => query.queryHash !== peopleCountQueryHash
      });
    }
  });
}

/**
 * A signed URL for a stored ID-proof image.
 *
 * **Admin only, and every successful call writes a VIEW row to `id_proof_access_log`.** Pass
 * `enabled` false for anyone else — the rule is not to call it at all, not to call it and
 * handle the 403 (integration doc §9).
 */
export function useIdProofUrl(id: Id, side: IdProofSide, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.people.idProof(id, side),
    queryFn: () => peopleApi.idProofUrl(id, side),
    enabled,
    // The URL lives ~5 minutes. Don't hand a stale one to an <Image>, and don't keep it
    // around in memory longer than it's usable.
    staleTime: 4 * 60 * 1000,
    gcTime: 4 * 60 * 1000,
    retry: false,
    // Fetched ONLY when `enabled` flips true — i.e. on a deliberate tap.
    //
    // Without these, React Query's defaults (staleTime elapsed + focus/reconnect refetch)
    // would re-request the URL after four minutes of the panel being open, and the server
    // writes a VIEW row to `id_proof_access_log` on every request. The audit trail would then
    // contain views the admin never asked for, which defeats the point of logging them.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}
