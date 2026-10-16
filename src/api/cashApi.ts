import { request } from "./client";
import type {
  CashSettlement,
  CollectorCashDetail,
  CollectorsCash,
  Handover,
  HandoverDetail,
  HandoverStatus,
  Id,
  MyCash,
  Paged,
  ReceiveHandoverRequest,
  SettleRequest
} from "./types";

/** Cash handover (v2 Phase 3). Collectors hand over their own cash; admins count and settle. */
export const cashApi = {
  /** Admin and collector; zeros for an admin. */
  me() {
    return request<MyCash>("/cash/me");
  },

  /** Collector: hands over all the cash they hold. 409 `nothing_to_hand_over` / `handover_pending`. */
  handOver() {
    return request<Handover>("/cash/handovers", { method: "POST" });
  },

  /** The collector who filed it, while pending. */
  withdraw(id: Id) {
    return request<void>(`/cash/handovers/${id}/withdraw`, { method: "POST" });
  },

  /** Admin, or the collector who filed it. */
  handover(id: Id) {
    return request<HandoverDetail>(`/cash/handovers/${id}`);
  },

  /** Admin. */
  collectors() {
    return request<CollectorsCash>("/cash/collectors");
  },

  /** Admin. */
  collector(id: Id) {
    return request<CollectorCashDetail>(`/cash/collectors/${id}`);
  },

  /** Admin. Newest first. */
  handovers({ status, page = 0, size = 20 }: { status?: HandoverStatus; page?: number; size?: number }) {
    return request<Paged<Handover>>("/cash/handovers", { query: { status, page, size } });
  },

  /** Admin: what was actually counted. 400 `note_required` when it differs without a note. */
  receive(id: Id, body: ReceiveHandoverRequest) {
    return request<Handover>(`/cash/handovers/${id}/receive`, { method: "POST", body });
  },

  /** Admin. 409 `nothing_to_settle` · 400 `settle_above_outstanding`. */
  settle(collectorId: Id, body: SettleRequest) {
    return request<CashSettlement>(`/cash/collectors/${collectorId}/settle`, { method: "POST", body });
  }
};
