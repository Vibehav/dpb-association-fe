import { request } from "./client";
import type {
  AddPersonLinkRequest,
  CreatePersonRequest,
  Id,
  IdProofReplaceRequest,
  IdProofSide,
  Paged,
  PeopleListParams,
  PersonListItem,
  PersonProfile,
  SignedUrlResponse,
  UpdatePersonRequest
} from "./types";

/** ~2,300 people on record — paginate. */
export const PEOPLE_PAGE_SIZE = 20;

export const peopleApi = {
  /**
   * `query` matches name, phone or shop number. Omit `role` for "All".
   *
   * `idProof` is `PENDING` or `CAPTURED` — the pending queue, since client revision v2.
   * The rows themselves carry no ID-proof field, so this filter is the only way to partition
   * the register without fetching every profile.
   */
  list({ query, role, idProof, page = 0, size = PEOPLE_PAGE_SIZE }: PeopleListParams) {
    return request<Paged<PersonListItem>>("/people", {
      query: { query, role, idProof, page, size }
    });
  },

  detail(id: Id) {
    return request<PersonProfile>(`/people/${id}`);
  },

  /**
   * Standalone add. Requires at least one RENTER/STAFF link — an OWNER link is a 400,
   * because owners exist only through shop registration or transfer. 409 `duplicate_phone`.
   */
  create(body: CreatePersonRequest) {
    return request<PersonProfile>("/people", { method: "POST", body });
  },

  update(id: Id, body: UpdatePersonRequest) {
    return request<PersonProfile>(`/people/${id}`, { method: "PATCH", body });
  },

  /** Link another shop. Additive — the person keeps every existing link. */
  addLink(id: Id, body: AddPersonLinkRequest) {
    return request<PersonProfile>(`/people/${id}/links`, { method: "POST", body });
  },

  /** Admin only. Soft-deletes and unlinks. */
  remove(id: Id) {
    return request<void>(`/people/${id}`, { method: "DELETE" });
  },

  /**
   * Fresh signed photo URL. The profile response already carries one, so this is only
   * needed to refresh after a retake or once the embedded URL has expired.
   */
  photoUrl(id: Id) {
    return request<SignedUrlResponse>(`/people/${id}/photo`);
  },

  /** Retake. `key` comes from the upload flow. */
  updatePhoto(id: Id, key: string) {
    return request<void>(`/people/${id}/photo`, { method: "PUT", body: { key } });
  },

  /**
   * **Admin only, and every call writes a VIEW row to `id_proof_access_log`** against the
   * acting user. Never call this as a collector or viewer — the rule is not to call it at
   * all, not to call it and handle the 403 (integration doc §9).
   *
   * `side` is a path segment bound by Spring's *default* enum converter, so it is
   * case-sensitive: `/id-proof/FRONT` is a 200 and `/id-proof/front` is a 400
   * `validation_error`. `IdProofSide` is already uppercase — never lowercase it here.
   *
   * 404 `id_proof_missing` when that side was never captured.
   */
  idProofUrl(id: Id, side: IdProofSide) {
    return request<SignedUrlResponse>(`/people/${id}/id-proof/${side}`);
  },

  /**
   * Re-capture one side within the current document. Collectors may replace an unclear
   * copy; they still cannot view it. The type is untouched — deliberate, so a front and a
   * back can never come from two different documents. 204, no body.
   *
   * Note the side moved from the body into the **path** in the ID-proof refactor.
   */
  updateIdProofSide(id: Id, side: IdProofSide, key: string) {
    return request<void>(`/people/${id}/id-proof/${side}`, { method: "PUT", body: { key } });
  },

  /**
   * Full replace — the only way to change the document type. 204, no body.
   *
   * Destructive by design: an omitted `backKey` clears the stored back image and an omitted
   * `last4` wipes it. See `IdProofReplaceRequest`.
   */
  replaceIdProof(id: Id, body: IdProofReplaceRequest) {
    return request<void>(`/people/${id}/id-proof`, { method: "PUT", body });
  },

  /**
   * Take the document off file, returning the member to **pending**. Admin only; 204.
   *
   * Destructive in earnest: the stored images are queued for deletion and removed from S3 by
   * the server's sweeper, so this is not just unlinking them. 409 `id_proof_not_captured`
   * when the member is already pending.
   */
  removeIdProof(id: Id) {
    return request<void>(`/people/${id}/id-proof`, { method: "DELETE" });
  }
};
