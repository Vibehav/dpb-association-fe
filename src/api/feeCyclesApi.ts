import { request } from "./client";
import type {
  CreateFeeCycleRequest,
  FeeCycle,
  Id,
  RaiseDemandResponse,
  RepriceResponse,
  UpdateFeeCycleRequest
} from "./types";

/** The annual fee year — admin only throughout. */
export const feeCyclesApi = {
  /**
   * The open year with its progress. **404 `no_open_cycle` is the normal "no fee set yet"
   * state**, not an error — see `useCurrentFeeCycle`.
   */
  current() {
    return request<FeeCycle>("/fee-cycles/current");
  },

  /** Closed years, newest first. */
  history() {
    return request<FeeCycle[]>("/fee-cycles");
  },

  /** 409 `cycle_already_open` / `duplicate_year`; 400 `invalid_year_label`. */
  create(body: CreateFeeCycleRequest) {
    return request<FeeCycle>("/fee-cycles", { method: "POST", body });
  },

  /** A new amount re-prices only the demands with nothing paid; `demandsUpdated` counts them. */
  update(id: Id, body: UpdateFeeCycleRequest) {
    return request<RepriceResponse>(`/fee-cycles/${id}`, { method: "PATCH", body });
  },

  /** Charges every shop on record. 409 `demand_already_raised`. */
  raiseDemand(id: Id) {
    return request<RaiseDemandResponse>(`/fee-cycles/${id}/raise-demand`, { method: "POST" });
  },

  /** What is still due becomes arrears — still collectable. */
  close(id: Id) {
    return request<FeeCycle>(`/fee-cycles/${id}/close`, { method: "POST" });
  }
};
