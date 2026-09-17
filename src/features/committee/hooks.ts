/**
 * Committee management. Admin only — every endpoint answers 403 otherwise.
 *
 * Reset-PIN and Remove end the member's sessions server-side (token_version bump plus
 * refresh-token revocation), so nothing needs doing on this device beyond refreshing the
 * list. A role change needs no token bump at all: the API re-derives the role from the
 * database on every request, so it lands on the member's very next screen.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { committeeApi, type AddCommitteeMemberRequest, type Id, type UpdateCommitteeMemberRequest } from "../../api";
import { queryKeys } from "../../app/queryKeys";

export function useCommittee() {
  return useQuery({
    queryKey: queryKeys.committee.all,
    queryFn: committeeApi.list
  });
}

function useCommitteeInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.committee.all });
    // A role change can't target yourself, but refetching `/me` is cheap insurance
    // against showing a stale role anywhere.
    queryClient.invalidateQueries({ queryKey: queryKeys.me });
  };
}

export function useAddCommitteeMember() {
  const invalidate = useCommitteeInvalidation();
  return useMutation({
    mutationFn: (body: AddCommitteeMemberRequest) => committeeApi.add(body),
    onSuccess: invalidate
  });
}

/** 400 `self_action` only blocks changing your own role; name and email remain editable. */
export function useUpdateCommitteeMember() {
  const invalidate = useCommitteeInvalidation();
  return useMutation({
    mutationFn: ({ id, body }: { id: Id; body: UpdateCommitteeMemberRequest }) =>
      committeeApi.update(id, body),
    onSuccess: invalidate
  });
}

/** Clears their PIN and ends their sessions; they re-set it through first-login. */
export function useResetPin() {
  const invalidate = useCommitteeInvalidation();
  return useMutation({
    mutationFn: (id: Id) => committeeApi.resetPin(id),
    onSuccess: invalidate
  });
}

/** Soft-remove. They can't sign in, and their phone number frees up for re-adding. */
export function useRemoveCommitteeMember() {
  const invalidate = useCommitteeInvalidation();
  return useMutation({
    mutationFn: (id: Id) => committeeApi.remove(id),
    onSuccess: invalidate
  });
}
