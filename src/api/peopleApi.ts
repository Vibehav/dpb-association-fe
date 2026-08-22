import { request } from "./client";
import type {
  AadhaarSide,
  AddPersonLinkRequest,
  CreatePersonRequest,
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
  /** `query` matches name, phone or shop number. Omit `role` for "All". */
  list({ query, role, page = 0, size = PEOPLE_PAGE_SIZE }: PeopleListParams) {
    return request<Paged<PersonListItem>>("/people", { query: { query, role, page, size } });
  },

  detail(id: string) {
    return request<PersonProfile>(`/people/${id}`);
  },

  /**
   * Standalone add. Requires at least one RENTER/STAFF link — an OWNER link is a 400,
   * because owners exist only through shop registration or transfer. 409 `duplicate_phone`.
   */
  create(body: CreatePersonRequest) {
    return request<PersonProfile>("/people", { method: "POST", body });
  },

  update(id: string, body: UpdatePersonRequest) {
    return request<PersonProfile>(`/people/${id}`, { method: "PATCH", body });
  },

  /** Link another shop. Additive — the person keeps every existing link. */
  addLink(id: string, body: AddPersonLinkRequest) {
    return request<PersonProfile>(`/people/${id}/links`, { method: "POST", body });
  },

  /** Admin only. Soft-deletes and unlinks. */
  remove(id: string) {
    return request<void>(`/people/${id}`, { method: "DELETE" });
  },

  /**
   * Fresh signed photo URL. The profile response already carries one, so this is only
   * needed to refresh after a retake or once the embedded URL has expired.
   */
  photoUrl(id: string) {
    return request<SignedUrlResponse>(`/people/${id}/photo`);
  },

  /** Retake. `key` comes from the upload flow. */
  updatePhoto(id: string, key: string) {
    return request<void>(`/people/${id}/photo`, { method: "PUT", body: { key } });
  },

  /**
   * **Admin only, and every call is logged server-side** as an Aadhaar view against the
   * acting user. Never call this as a collector or viewer — it returns 403, and the
   * attempt is pointless: the UI shows a locked placeholder instead (integration doc §9).
   *
   * 404 `aadhaar_missing` when that side was never captured.
   */
  aadhaarUrl(id: string, side: AadhaarSide) {
    return request<SignedUrlResponse>(`/people/${id}/aadhaar/${side}`);
  },

  /** Re-capture. Collectors may replace an unclear copy; they still cannot view it. */
  updateAadhaar(id: string, side: AadhaarSide, key: string) {
    return request<void>(`/people/${id}/aadhaar`, { method: "PUT", body: { side, key } });
  }
};
