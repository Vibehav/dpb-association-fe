import { request } from "./client";
import type { AddCommitteeMemberRequest, CommitteeMember, Role } from "./types";

/**
 * Committee management. Every endpoint is admin only (403 otherwise).
 *
 * Two guards surface as 400 with a message worth showing verbatim: `self_action` (you
 * cannot change or remove yourself) and `last_admin` (the association must keep at least
 * one active admin).
 */
export const committeeApi = {
  /** Active members first, then removed ones with `removedAt` set. */
  list() {
    return request<CommitteeMember[]>("/committee");
  },

  detail(id: string) {
    return request<CommitteeMember>(`/committee/${id}`);
  },

  /**
   * The new member is created with `pinSet: false` and sets their own PIN through the
   * first-login OTP flow — the admin never types or sees a PIN. 409 on a duplicate
   * active phone.
   */
  add(body: AddCommitteeMemberRequest) {
    return request<CommitteeMember>("/committee", { method: "POST", body });
  },

  /** Takes effect immediately: the API re-derives the role from the DB per request. */
  changeRole(id: string, role: Role) {
    return request<CommitteeMember>(`/committee/${id}`, { method: "PATCH", body: { role } });
  },

  /** Clears the PIN and ends their sessions. They must set a new PIN to sign in again. */
  resetPin(id: string) {
    return request<void>(`/committee/${id}/reset-pin`, { method: "POST" });
  },

  /** Soft-remove. Ends their sessions and frees the phone number for re-adding. */
  remove(id: string) {
    return request<void>(`/committee/${id}`, { method: "DELETE" });
  }
};
