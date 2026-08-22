import { request } from "./client";
import type { Me } from "./types";

export const meApi = {
  /**
   * The signed-in user's identity and **current** role.
   *
   * The API re-derives the role from the database on every request, so this is the only
   * trustworthy source. A member demoted mid-session sees the new role here immediately —
   * which is why every screen refetches it on focus rather than reading a cached login
   * response (integration doc §2.3, functional spec §13.2 #7).
   */
  get() {
    return request<Me>("/me");
  }
};
