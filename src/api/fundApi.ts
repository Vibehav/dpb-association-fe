import { request } from "./client";
import type { Dashboard, FundIncomeRow, FundSummary, Paged } from "./types";

/** The general fund — admin only; a collector or viewer gets 403 from the endpoint itself. */
export const fundApi = {
  summary() {
    return request<FundSummary>("/funds/general");
  },

  /** Newest first, cancelled rows included (flagged) so they can be struck. */
  income({ page = 0, size = 20 }: { page?: number; size?: number }) {
    return request<Paged<FundIncomeRow>>("/funds/general/income", { query: { page, size } });
  }
};

export const dashboardApi = {
  /** Every role — shaped by role on the server. */
  get() {
    return request<Dashboard>("/dashboard");
  }
};
