import { request } from "./client";
import type { Dashboard, FundIncomeRow, FundSummary, OpeningBalance, Paged, SetOpeningBalanceRequest, Spending } from "./types";

/** The general fund — admin only; a collector or viewer gets 403 from the endpoint itself. */
export const fundApi = {
  summary() {
    return request<FundSummary>("/funds/general");
  },

  /** Newest first, cancelled rows included (flagged) so they can be struck. */
  income({ page = 0, size = 20 }: { page?: number; size?: number }) {
    return request<Paged<FundIncomeRow>>("/funds/general/income", { query: { page, size } });
  },

  /** Running costs and event support (named by its event), newest first, voided included. */
  spendings({ page = 0, size = 20 }: { page?: number; size?: number }) {
    return request<Paged<Spending>>("/funds/general/spendings", { query: { page, size } });
  },

  /** Entered once. 409 `opening_balance_exists` · 400 `future_date`. */
  setOpeningBalance(body: SetOpeningBalanceRequest) {
    return request<OpeningBalance>("/funds/general/opening-balance", { method: "POST", body });
  },

  /** `note` required. Then it can be entered again. 204. */
  voidOpeningBalance(note: string) {
    return request<void>("/funds/general/opening-balance/void", { method: "POST", body: { note } });
  }
};

export const dashboardApi = {
  /** Every role — shaped by role on the server. */
  get() {
    return request<Dashboard>("/dashboard");
  }
};
