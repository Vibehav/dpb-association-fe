import { request } from "./client";
import type { DonorListItem, DonorListParams, DonorProfile, Id, Paged, UpdateDonorRequest } from "./types";

/**
 * Outside donors. There is **no create endpoint**: a donor is created through `newDonor` on
 * `POST /contributions`, atomically with their first receipt.
 */
export const donorsApi = {
  /** Name, phone or organisation, contains. Every role. */
  search({ query, page = 0, size = 20 }: DonorListParams) {
    return request<Paged<DonorListItem>>("/donors", { query: { query, page, size } });
  },

  detail(id: Id) {
    return request<DonorProfile>(`/donors/${id}`);
  },

  /** Admin + collector. A full replace; past receipts keep the name they were issued with. */
  update(id: Id, body: UpdateDonorRequest) {
    return request<DonorProfile>(`/donors/${id}`, { method: "PATCH", body });
  }
};
