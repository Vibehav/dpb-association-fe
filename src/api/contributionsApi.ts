import { request } from "./client";
import type {
  CancelContributionRequest,
  CancelledReceiptRow,
  CorrectContributionRequest,
  CreateContributionRequest,
  Id,
  Paged,
  Receipt
} from "./types";

export const contributionsApi = {
  /**
   * The collection form. Admin + collector; a viewer gets 403. → 201 with the receipt.
   *
   * A short `ANNUAL_FEE` amount comes back **409 `part_payment_unconfirmed`** — the
   * confirmation step, not a failure: show its message and resend with
   * `confirmPartPayment: true`.
   */
  create(body: CreateContributionRequest) {
    return request<Receipt>("/contributions", { method: "POST", body });
  },

  /** Receipt view / Reprint. Every role. */
  receipt(id: Id) {
    return request<Receipt>(`/contributions/${id}`);
  },

  /** Admin only. The row stays, struck through, with its number. 204. */
  cancel(id: Id, body: CancelContributionRequest) {
    return request<void>(`/contributions/${id}/cancel`, { method: "POST", body });
  },

  /** Admin only. Cancels and issues a replacement with the next number → the NEW receipt. */
  correct(id: Id, body: CorrectContributionRequest) {
    return request<Receipt>(`/contributions/${id}/correct`, { method: "POST", body });
  },

  /** Admin only. Most recently cancelled first. */
  cancelled({ page = 0, size = 20 }: { page?: number; size?: number }) {
    return request<Paged<CancelledReceiptRow>>("/contributions/cancelled", { query: { page, size } });
  }
};
