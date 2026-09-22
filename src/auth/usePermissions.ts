import type { Role } from "../api";
import { useMe } from "./useMe";

/**
 * What the current user may do, from the capability table in integration doc §3.
 *
 * This hides controls; it does not secure anything. The API enforces the same rules and
 * returns 403 regardless of what the client shows — assume a modified client
 * (functional spec §13.1).
 *
 * While `/me` is in flight everything is denied, so a write button never flashes into
 * view for a viewer.
 */
export type Permissions = {
  role: Role | null;
  loading: boolean;
  /** Read shops and people. Every role can. */
  canRead: boolean;
  /** Register/edit shops and people, add renter/staff links, capture photo and ID proof. */
  canWrite: boolean;
  /** Transfer a licence, remove a link, soft-delete a shop or person. */
  isAdmin: boolean;
  /** Open a stored ID-proof image. Admin only, and every view is logged server-side. */
  canViewIdProof: boolean;
  /**
   * Change *which* document is on file (`PUT /id-proof`). Admin only.
   *
   * Distinct from `canWrite` on purpose: a collector may still re-take an unclear image via
   * `PUT /id-proof/{side}`, which is what spec §4.3 scopes them to. Swapping a passport for
   * a PAN card changes what the register asserts about someone's identity, so it sits with
   * transfers and deletions.
   */
  canChangeIdProofType: boolean;
  /** Add, re-role, reset-PIN and remove committee members. */
  canManageCommittee: boolean;
};

export function usePermissions(): Permissions {
  const { data, isPending } = useMe();
  const role = data?.role ?? null;
  const isAdmin = role === "ADMIN";
  const canWrite = role === "ADMIN" || role === "COLLECTOR";

  return {
    role,
    loading: isPending,
    canRead: role !== null,
    canWrite,
    isAdmin,
    canViewIdProof: isAdmin,
    canChangeIdProofType: isAdmin,
    canManageCommittee: isAdmin
  };
}
