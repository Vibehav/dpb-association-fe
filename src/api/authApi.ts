/**
 * Auth endpoints. All public (`auth: false`) except `verify-pin`, which needs a bearer
 * token even though it sits under the API's public `/auth/**` matcher.
 *
 * These return raw token pairs. Deliberately, they do **not** fetch `/me` and fold the
 * role into a session object the way the old client did — the role must be re-derived
 * from `GET /me` per screen, never captured at login (integration doc §2.3).
 */

import { request, type TokenPair } from "./client";
import type { OtpPurpose, PhoneCheckResponse, ResetTokenResponse } from "./types";

export const authApi = {
  /** Is this number on the committee, and has a PIN ever been set? */
  checkPhone(phone: string) {
    return request<PhoneCheckResponse>("/auth/phone", {
      method: "POST",
      body: { phone },
      auth: false
    });
  },

  /** 401 `wrong_pin` · 423 `pin_locked` · 409 `pin_not_set` · 404 `not_on_committee`. */
  login(phone: string, pin: string) {
    return request<TokenPair>("/auth/login", {
      method: "POST",
      body: { phone, pin },
      auth: false
    });
  },

  /** 202 on success · 429 `otp_throttled` inside the 60s resend window. */
  requestOtp(phone: string, purpose: OtpPurpose) {
    return request<void>("/auth/otp/request", {
      method: "POST",
      body: { phone, purpose },
      auth: false
    });
  },

  /** Returns a short-lived reset token. Keep it in memory only — never on disk. */
  verifyOtp(phone: string, code: string) {
    return request<ResetTokenResponse>("/auth/otp/verify", {
      method: "POST",
      body: { phone, code },
      auth: false
    });
  },

  /** Sets the PIN and signs the member in. Used for first-login, forgot and change. */
  setPin(resetToken: string, newPin: string) {
    return request<TokenPair>("/auth/pin/set", {
      method: "POST",
      body: { resetToken, newPin },
      auth: false
    });
  },

  // NOTE: there is deliberately no `refresh()` here. `client.ts` owns token rotation so it
  // can single-flight it, and exposing a second way to do it invited callers to bypass that.

  /** Revokes this device's refresh token only. */
  logout(refreshToken: string) {
    return request<void>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
      auth: false
    });
  },

  /**
   * App-unlock PIN check. 204 on success, 401 `wrong_pin` on failure — and a failure
   * counts toward the server's 5-attempt lockout, which is why the client never retries
   * this call. Requires a *valid* access token; see `AuthContext.unlock`.
   */
  verifyPin(pin: string) {
    return request<void>("/auth/verify-pin", { method: "POST", body: { pin } });
  }
};
