/**
 * Typed API errors.
 *
 * The API returns a uniform envelope on every failure:
 *
 *     { "code": "<machine_code>", "message": "<human message>" }
 *
 * The code list below is authoritative: it mirrors every `ApiException.*("<code>", …)`
 * throw site in `dpb-association-api`, plus the two codes written directly by
 * `GlobalExceptionHandler` / `SecurityConfig`. Keep it in sync when the API adds a code —
 * a code we don't know about still surfaces its `message`, but we can't branch on it.
 */

/** Codes the server can return. */
export const SERVER_ERROR_CODES = [
  // --- auth / session -------------------------------------------------------
  "unauthorized", // 401 · no or unusable token (also the security entry point)
  "invalid_token", // 401 · token failed signature/expiry parsing
  "wrong_pin", // 401 · PIN mismatch (counts toward lockout)
  "pin_locked", // 423 · 5 failures → 15-minute lock
  "pin_not_set", // 409 · member has never set a PIN → first-login OTP
  "invalid_refresh", // 401 · refresh token unknown, expired or already rotated
  "invalid_reset_token", // 401 · reset token from otp/verify is bad or expired
  "not_on_committee", // 404 · number is not an active committee member

  // --- otp ------------------------------------------------------------------
  "otp_invalid", // 400 · wrong code
  "otp_expired", // 400 · code past its TTL
  "otp_attempts_exhausted", // 400 · too many wrong codes for this request
  "otp_throttled", // 429 · resend requested inside the 60s window
  "otp_send_failed", // 502 · email provider could not deliver the code
  "no_email_on_file", // 409 · committee member has no deliverable email address

  // --- shops ----------------------------------------------------------------
  "duplicate_shop_number", // 409 · taken among active shops (case-insensitive)
  "shop_not_found", // 404
  "already_owner", // 400 · transfer target already holds the licence

  // --- links ----------------------------------------------------------------
  "owner_not_addable", // 400 · OWNER cannot be created via an add-link call
  "owner_not_removable", // 400 · OWNER link is replaced by transfer, never removed
  "renter_exists", // 409 · shop already has a renter
  "already_linked", // 409 · this person already holds a role at this shop
  "link_not_found", // 404

  // --- people ---------------------------------------------------------------
  "duplicate_phone", // 409 · phone taken among active people
  "person_not_found", // 404
  "person_input", // 400 · owner/existing-person input was malformed or empty
  "consent_required", // 400 · consent must be true to store a member
  /**
   * 409 · the member still holds the licence on one or more shops, so deleting them would
   * strip those shops of their holder. Transfer each licence first.
   *
   * **Show `error.message`, not a fixed string** — the server names the shops
   * ("Transfer the licence for shop A-30, A-31 before deleting this member"), which is the
   * whole value of the error. That is why there is no `OVERRIDE_MESSAGES` entry below.
   *
   * The profile screen blocks the delete before it is attempted, so reaching this is either
   * a race (a shop registered to them from another device) or a non-profile caller.
   */
  "person_is_owner",

  // --- committee ------------------------------------------------------------
  "committee_not_found", // 404
  "duplicate_email", // 409 · address taken among active committee members
  "nothing_to_update", // 400 · empty committee PATCH body
  "self_action", // 400 · cannot change or remove yourself
  "last_admin", // 400 · cannot remove/demote the last active admin

  // --- media ----------------------------------------------------------------
  "id_proof_missing", // 404 · that side was never captured
  /**
   * 409 · a per-side re-capture or a delete was attempted on a member with **no document on
   * file** (client revision v2). Reaching this is a client bug in the same sense as
   * `invalid_media_key`: the panel hides both actions on a pending member, because neither
   * can succeed. The first capture is `PUT /id-proof`, which carries the type with it.
   */
  "id_proof_not_captured",
  /**
   * 404 · the member has not been photographed yet (client revision v3). Unlike most 404s
   * this is an ordinary state, not a fault — show "No photo on file" with an add action
   * rather than a failure toast.
   */
  "photo_missing",
  /**
   * 400 · a key was sent in the wrong field — a `photos/…` key as an ID-proof key or vice
   * versa. This is a **client bug**, not user error: it means a capture slot was wired to
   * the wrong `MediaType`, or one key was reused across two fields. Reusing a key was a
   * real security hole (a photo key pointing at an ID-proof image exposed it to
   * non-admins), so the API now refuses it.
   *
   * It catches only the photo↔id-proof boundary. `ID_PROOF_FRONT` and `ID_PROOF_BACK` share
   * one storage prefix, so a front/back swap passes server-side validation and lands in the
   * record silently — this client is the only place that can prevent it.
   *
   * Branch on the **code**, never the message: the message now names `ID_PROOF_FRONT`.
   */
  "invalid_media_key",
  /** 400 · the object isn't in storage — the presigned PUT never completed. */
  "media_not_uploaded",

  // --- money: collecting (v2 Phase 1) ----------------------------------------
  // Most of these carry a message written to be shown as-is ("Only ₹3,000 is due for
  // 2026-27"), so they have no override below.
  "payer_required", // 400 · not exactly one of personId / donorId / newDonor
  "donor_cannot_pay_fee", // 400 · the annual fee is paid by the licence holder only
  "shop_required", // 400 · ANNUAL_FEE without shopId
  "no_open_cycle", // 409 · no fee year open (also 404 on GET /fee-cycles/current — a normal state)
  "demand_not_raised", // 409 · fee year exists, demand not raised
  "fee_demand_not_found", // 404 · that year named, but this shop owed nothing in it
  "no_licence_holder", // 409 · the shop has no holder on record to pay
  "not_licence_holder", // 400 · the payer is not the shop's licence holder
  "fee_already_paid", // 409 · nothing is due for that year
  "amount_above_due", // 400 · more than is due; message names what is
  /**
   * 409 · less than is due and not confirmed. **Not a failure** — the confirmation step of a
   * part payment. Show the message ("₹3,000 will remain due … confirm …") with Cancel /
   * Confirm, and resend with `confirmPartPayment: true`.
   */
  "part_payment_unconfirmed",
  "contribution_not_found", // 404
  "already_cancelled", // 409 · cancel or correct on a cancelled receipt
  "donor_not_found", // 404

  // --- money: fee year (admin) ------------------------------------------------
  "fee_cycle_not_found", // 404
  "invalid_year_label", // 400 · must be two consecutive years, 2026-27
  "cycle_already_open", // 409 · close the open year first
  "duplicate_year", // 409 · that year's fee was already set
  "cycle_closed", // 400 · re-price / raise / close on a closed year
  "demand_already_raised", // 409
  /**
   * 409 · the shop still owes fees. On **delete** it is a prompt: resend with
   * `confirmOutstanding=true` to delete anyway. On **transfer** it is a refusal — the dues
   * must be collected from the current holder first. Show the message; it names the amount.
   */
  "fee_outstanding",

  // --- money: events and spending (v2 Phase 2) -----------------------------------
  // Messages are written to be shown as-is; they name the event and the amounts.
  "event_required", // 400 · EVENT_DONATION without eventId, or paidFrom EVENT without one
  "event_not_expected", // 400 · eventId with another purpose
  "event_not_found", // 404 · also a general-funded event to a collector or viewer
  "event_has_no_fund", // 400 · a general-funded event takes no donations and has no fund to pay from
  "event_closed", // 409 · no new donation or spending; refresh the picker / the event
  "duplicate_event_name", // 409 · ignoring case
  "invalid_dates", // 400 · the end date is before the start
  "event_not_empty", // 409 · type switch or delete once anything was recorded
  "already_closed", // 409
  "move_choice_required", // 400 · money is left — choose to move it or keep it
  "event_balance_negative", // 409 · the event is short; the message says what to do
  "event_not_closed", // 409 · move-balance before close
  "balance_already_moved", // 409
  "nothing_to_move", // 409
  "paid_from_required", // 400 · an own-fund event's bill must say which fund pays
  /**
   * 409 · the bill is bigger than what the event's fund holds. When something is left the
   * message is the **split offer** ("confirm to pay ₹10,000 from it and the remaining ₹5,000
   * from the general fund") — resend with `splitToGeneral: true`.
   */
  "event_fund_short",
  "general_fund_short", // 409 · no spending may take the general fund below ₹0
  "future_date", // 400 · a spending or opening balance dated after today
  "spending_not_found", // 404
  "already_voided", // 409
  "bill_missing", // 404 · no bill on file
  "opening_balance_exists", // 409 · void it first
  "opening_balance_not_found", // 404

  // --- money: cash handover (v2 Phase 3) ------------------------------------------
  "nothing_to_hand_over", // 409 · no cash with the collector
  "handover_pending", // 409 · one is already waiting; withdraw to hand over everything together
  "handover_not_pending", // 409 · already counted or withdrawn
  "handover_not_found", // 404 · also another collector's handover
  "note_required", // 400 · the counted amount differs and there is no note
  "nothing_to_settle", // 409 · nothing open in that direction
  "settle_above_outstanding", // 400
  "collector_not_found", // 404

  // --- generic --------------------------------------------------------------
  "forbidden", // 403 · authenticated but the role isn't allowed
  // 400 · bean-validation failure, where `message` names the field — and also an
  // unrecognised enum value in the body (a misspelled `idProofType`) or in a path segment
  // (a bad `{side}`), where the message is Jackson's rather than ours.
  "validation_error"
] as const;

/** Codes this client synthesises when the request never produced an envelope. */
export const CLIENT_ERROR_CODES = [
  "network_error", // request never reached the server
  "timeout", // aborted by our own timeout
  "upload_failed", // presigned PUT to storage was rejected (never touches our API)
  "unknown" // non-envelope error body (proxy HTML, a 500 stack, …)
] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
export type ErrorCode = ServerErrorCode | ClientErrorCode;

/**
 * Every failure from the API layer. Carries the HTTP `status` and the machine `code`
 * so callers can branch — the old client threw a bare `Error(message)`, which made the
 * error-handling table in the integration doc (§10) impossible to implement.
 *
 * `status` is 0 for client-side failures (network, timeout).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;

  constructor(status: number, code: ErrorCode | string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** True when the request failed before the server answered. */
  get isNetworkFailure() {
    return this.status === 0;
  }
}

/** Narrowing helper: `isCode(error, "duplicate_phone", "already_linked")`. */
export function isCode(error: unknown, ...codes: (ErrorCode | string)[]): error is ApiError {
  return error instanceof ApiError && codes.includes(error.code);
}

/** Narrowing helper for a status class, e.g. `isStatus(error, 409)`. */
export function isStatus(error: unknown, ...statuses: number[]): error is ApiError {
  return error instanceof ApiError && statuses.includes(error.status);
}

/**
 * Build an ApiError from a response body. Falls back sensibly when the body isn't our
 * envelope — a reverse proxy returning HTML, or an unhandled 500 with a stack trace.
 */
export function apiErrorFromBody(status: number, rawBody: string): ApiError {
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as { code?: unknown; message?: unknown };
      const code = typeof parsed.code === "string" && parsed.code ? parsed.code : null;
      const message =
        typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : null;
      if (code || message) {
        return new ApiError(status, code ?? "unknown", message ?? fallbackMessage(status));
      }
    } catch {
      // not JSON — fall through
    }
  }
  return new ApiError(status, "unknown", fallbackMessage(status));
}

function fallbackMessage(status: number) {
  if (status >= 500) return "The server had a problem. Please try again.";
  if (status === 404) return "Not found.";
  if (status === 403) return "You don't have permission for this.";
  if (status === 401) return "Please sign in again.";
  return `Request failed (${status}).`;
}

/**
 * User-facing copy for the codes where the server's own message isn't the right thing
 * to show. Anything not listed here should display `error.message` — the API writes
 * decent human messages and they stay correct as rules change.
 */
const OVERRIDE_MESSAGES: Partial<Record<ErrorCode, string>> = {
  wrong_pin: "Wrong M-PIN.",
  pin_locked: "Locked after too many attempts. Try again later or reset your M-PIN.",
  duplicate_phone: "A member with this phone number already exists.",
  duplicate_email: "This email is already used by another active committee member.",
  duplicate_shop_number: "A shop with this number already exists.",
  renter_exists: "This shop already has a renter.",
  already_linked: "This person is already linked to this shop.",
  owner_not_addable: "The licence holder is set through registration or transfer.",
  owner_not_removable: "The licence holder is changed through Transfer licence.",
  otp_throttled: "Please wait a moment before requesting another code.",
  otp_send_failed: "Couldn't send the code, please try again.",
  no_email_on_file: "No email address is registered for this number. Please contact the treasurer.",
  forbidden: "You don't have permission for this.",
  id_proof_missing: "That side of the ID proof hasn't been captured yet.",
  photo_missing: "This member hasn't been photographed yet.",
  id_proof_not_captured:
    "This member has no ID proof on file yet. Capture the document first, then try again.",
  // The user can't fix a mis-wired field, but retaking produces a fresh key in the right
  // namespace, which does resolve it. `__DEV__` logging for this lives at the call site.
  invalid_media_key: "That image couldn't be attached. Please retake it and save again.",
  media_not_uploaded: "An image didn't finish uploading. Retake it and save again.",
  network_error: "Can't reach the server. Check your connection and try again.",
  timeout: "The request timed out. Please try again.",
  upload_failed: "The image didn't upload. Check your connection and try again."
};

/** The message to show a user for any thrown value. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) {
    return OVERRIDE_MESSAGES[error.code as ErrorCode] ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
