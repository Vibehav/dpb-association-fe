import { request } from "./client";
import type {
  CreateSpendingRequest,
  Id,
  RecordSpendingResponse,
  SignedUrlResponse,
  Spending,
  UpdateSpendingRequest,
  VoidSpendingRequest
} from "./types";

/** Money going out (v2 Phase 2) — admin only; anyone else gets 403 from every endpoint. */
export const spendingsApi = {
  /**
   * → 201 with one entry, or two for a confirmed split. A bill too big for an event's fund
   * comes back **409 `event_fund_short`** — the split offer, not a failure: show its message
   * and resend with `splitToGeneral: true`.
   */
  record(body: CreateSpendingRequest) {
    return request<RecordSpendingResponse>("/spendings", { method: "POST", body });
  },

  get(id: Id) {
    return request<Spending>(`/spendings/${id}`);
  },

  /** The wording only. 409 `already_voided`. */
  update(id: Id, body: UpdateSpendingRequest) {
    return request<Spending>(`/spendings/${id}`, { method: "PATCH", body });
  },

  /** Attach a bill, or replace the one on file. */
  attachBill(id: Id, billKey: string) {
    return request<Spending>(`/spendings/${id}/bill`, { method: "PUT", body: { billKey } });
  },

  /** A short-lived signed URL. 404 `bill_missing`. */
  billUrl(id: Id) {
    return request<SignedUrlResponse>(`/spendings/${id}/bill`);
  },

  /** Stays listed, struck through; leaves every total. 204. */
  void(id: Id, body: VoidSpendingRequest) {
    return request<void>(`/spendings/${id}/void`, { method: "POST", body });
  }
};
