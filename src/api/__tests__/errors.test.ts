import {
  ApiError,
  apiErrorFromBody,
  CLIENT_ERROR_CODES,
  errorMessage,
  isCode,
  isStatus,
  SERVER_ERROR_CODES
} from "../errors";

describe("the code list", () => {
  it("has no duplicates", () => {
    const all = [...SERVER_ERROR_CODES, ...CLIENT_ERROR_CODES];
    expect(new Set(all).size).toBe(all.length);
  });

  it("knows every code the API can send that we branch on", () => {
    // Transcribed from the API's ApiException throw sites. If the backend adds a code and
    // this list isn't updated, `isCode(...)` checks against it silently never match.
    const mustKnow = [
      "unauthorized", "invalid_token", "wrong_pin", "pin_locked", "pin_not_set",
      "invalid_refresh", "invalid_reset_token", "not_on_committee",
      "otp_invalid", "otp_expired", "otp_attempts_exhausted", "otp_throttled",
      "duplicate_shop_number", "shop_not_found", "no_owner", "already_owner",
      "owner_not_addable", "owner_not_removable", "renter_exists", "already_linked",
      "link_not_found", "duplicate_phone", "person_not_found", "person_input",
      "consent_required", "committee_not_found", "duplicate_email", "nothing_to_update", "self_action", "last_admin",
      "aadhaar_missing", "invalid_media_key", "media_not_uploaded",
      "forbidden", "validation_error"
    ];
    for (const code of mustKnow) expect(SERVER_ERROR_CODES).toContain(code);
  });
});

describe("apiErrorFromBody", () => {
  it("reads our envelope", () => {
    const e = apiErrorFromBody(409, '{"code":"duplicate_phone","message":"Phone already used"}');
    expect(e.status).toBe(409);
    expect(e.code).toBe("duplicate_phone");
    expect(e.message).toBe("Phone already used");
  });

  it("falls back to `unknown` for a body with no code", () => {
    // Spring Boot's default error shape.
    const e = apiErrorFromBody(404, '{"timestamp":"…","status":404,"error":"Not Found"}');
    expect(e.code).toBe("unknown");
  });

  it("survives a non-JSON body", () => {
    const e = apiErrorFromBody(502, "<html>Bad Gateway</html>");
    expect(e.code).toBe("unknown");
    expect(e.status).toBe(502);
    expect(e.message).toBeTruthy();
  });

  it("survives an empty body", () => {
    expect(apiErrorFromBody(403, "").code).toBe("unknown");
  });

  it("keeps a message even when only the message is present", () => {
    const e = apiErrorFromBody(400, '{"message":"Something specific"}');
    expect(e.message).toBe("Something specific");
    expect(e.code).toBe("unknown");
  });
});

describe("narrowing helpers", () => {
  const error = new ApiError(409, "renter_exists", "This shop already has a renter");

  it("isCode matches any listed code", () => {
    expect(isCode(error, "renter_exists")).toBe(true);
    expect(isCode(error, "already_linked", "renter_exists")).toBe(true);
    expect(isCode(error, "duplicate_phone")).toBe(false);
    expect(isCode(new Error("plain"), "renter_exists")).toBe(false);
    expect(isCode(null, "renter_exists")).toBe(false);
  });

  it("isStatus matches any listed status", () => {
    expect(isStatus(error, 409)).toBe(true);
    expect(isStatus(error, 400, 409)).toBe(true);
    expect(isStatus(error, 404)).toBe(false);
  });

  it("flags client-side failures via status 0", () => {
    expect(new ApiError(0, "network_error", "…").isNetworkFailure).toBe(true);
    expect(error.isNetworkFailure).toBe(false);
  });
});

describe("errorMessage", () => {
  it("overrides the server wording where ours is better for a collector", () => {
    // The server says "Incorrect PIN"; the UI wants the design's phrasing.
    expect(errorMessage(new ApiError(401, "wrong_pin", "Incorrect PIN"))).toBe("Wrong M-PIN.");
  });

  it("passes the server message through for codes we do not override", () => {
    // These are well written and stay correct as the rules change — don't shadow them.
    const message = "You cannot change your own role";
    expect(errorMessage(new ApiError(400, "self_action", message))).toBe(message);
  });

  it("explains the new media codes in terms the user can act on", () => {
    expect(errorMessage(new ApiError(400, "media_not_uploaded", "No uploaded file found"))).toMatch(/retake/i);
    expect(errorMessage(new ApiError(400, "invalid_media_key", "not a valid PHOTO key"))).toMatch(/retake/i);
  });

  it("handles a plain Error and an unknown throw", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("a string", "fallback")).toBe("fallback");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
  });
});
