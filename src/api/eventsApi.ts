import { request } from "./client";
import type {
  CollectableEvent,
  EventDetail,
  EventListItem,
  EventListParams,
  EventRequest,
  FundIncomeRow,
  Id,
  Paged,
  Spending
} from "./types";

/**
 * Events (v2 Phase 2). Reading is open to every role, with the money shaped by role on the
 * server; managing events and reading their spending is admin only.
 */
export const eventsApi = {
  /** Active, then Open, then Closed. Collectors and viewers never see a general-funded event. */
  list({ status, page = 0, size = 20 }: EventListParams = {}) {
    return request<Paged<EventListItem>>("/events", { query: { status, page, size } });
  },

  /** The collection form's picker — own-fund events not closed. Admin and collector. */
  collectable() {
    return request<CollectableEvent[]>("/events/collectable");
  },

  /** 404 `event_not_found` for a general-funded event when the caller is not an admin. */
  detail(id: Id) {
    return request<EventDetail>(`/events/${id}`);
  },

  /** Every role. Newest first, cancelled receipts included (struck). */
  income(id: Id, { page = 0, size = 20 }: { page?: number; size?: number } = {}) {
    return request<Paged<FundIncomeRow>>(`/events/${id}/income`, { query: { page, size } });
  },

  /** Admin only. Both funds, each entry tagged with the one that paid. */
  spendings(id: Id, { page = 0, size = 20 }: { page?: number; size?: number } = {}) {
    return request<Paged<Spending>>(`/events/${id}/spendings`, { query: { page, size } });
  },

  create(body: EventRequest) {
    return request<EventDetail>("/events", { method: "POST", body });
  },

  /** A full replace of name, dates and type. */
  update(id: Id, body: EventRequest) {
    return request<EventDetail>(`/events/${id}`, { method: "PATCH", body });
  },

  /** Only while nothing was ever recorded against it — else 409 `event_not_empty`. */
  remove(id: Id) {
    return request<void>(`/events/${id}`, { method: "DELETE" });
  },

  /**
   * `moveBalance` is needed only when money is left (else 400 `move_choice_required`); leave
   * it out for a general-funded event or one at ₹0.
   */
  close(id: Id, moveBalance?: boolean) {
    return request<EventDetail>(`/events/${id}/close`, {
      method: "POST",
      body: moveBalance === undefined ? {} : { moveBalance }
    });
  },

  /** A balance kept at close, moved to the general fund later — whole, once. */
  moveBalance(id: Id) {
    return request<EventDetail>(`/events/${id}/move-balance`, { method: "POST" });
  }
};
