/** Mirrors integration doc §8. Each rule the server enforces should be refused locally first. */

import {
  firstError,
  OTP_LENGTH,
  PIN_LENGTH,
  validateIdProofLast4,
  validateBusinessName,
  validateConsent,
  validateEmail,
  validateLane,
  validateLinks,
  validateName,
  validateOtp,
  validatePhone,
  validatePin,
  validateShopNumber,
  validateWhatsApp
} from "../validators";

const ok = (result: string | null) => expect(result).toBeNull();
const fails = (result: string | null) => expect(result).toBeTruthy();

describe("phone — exactly 10 digits", () => {
  it("accepts ten digits, however they arrive", () => {
    ok(validatePhone("9820000000"));
    ok(validatePhone("98200 00000"));
    ok(validatePhone("+91 9820000000"));
  });

  it("rejects anything else", () => {
    fails(validatePhone(""));
    fails(validatePhone("982000000"));      // 9
    fails(validatePhone("98200000001"));    // 11
    fails(validatePhone("abcdefghij"));
  });

  it("treats WhatsApp as optional but validated when given", () => {
    ok(validateWhatsApp(""));
    ok(validateWhatsApp("9820000000"));
    fails(validateWhatsApp("12345"));
  });
});

describe("committee email — required and well-formed", () => {
  it("accepts a normal email address", () => {
    ok(validateEmail("meera@example.com"));
    ok(validateEmail("  meera@example.com  "));
  });

  it("rejects blank and malformed addresses", () => {
    fails(validateEmail(""));
    fails(validateEmail("meera"));
    fails(validateEmail("meera@example"));
  });
});

describe("PIN and OTP lengths", () => {
  it("uses 4 and 6", () => {
    expect(PIN_LENGTH).toBe(4);
    expect(OTP_LENGTH).toBe(6);
  });

  it("accepts only the exact length, digits only", () => {
    ok(validatePin("1947"));
    fails(validatePin("194"));
    fails(validatePin("19477"));
    fails(validatePin("19a7"));

    ok(validateOtp("123456"));
    fails(validateOtp("12345"));
    fails(validateOtp("1234567"));
  });
});

describe("required text fields", () => {
  it("rejects blank and whitespace-only", () => {
    for (const check of [validateName, validateShopNumber, validateBusinessName, validateLane]) {
      ok(check("something"));
      fails(check(""));
      fails(check("   "));
    }
  });
});

describe("Aadhaar last 4 — optional, but exactly 4 digits when given", () => {
  it("accepts empty or four digits", () => {
    ok(validateIdProofLast4(""));
    ok(validateIdProofLast4("   "));
    ok(validateIdProofLast4("1234"));
  });

  it("rejects a partial or non-numeric value rather than silently truncating", () => {
    fails(validateIdProofLast4("123"));
    fails(validateIdProofLast4("12345"));
    fails(validateIdProofLast4("12a4"));
  });
});

describe("consent — mandatory", () => {
  it("must be ticked", () => {
    ok(validateConsent(true));
    fails(validateConsent(false));
  });
});

describe("links — at least one, and never OWNER", () => {
  it("requires at least one", () => {
    fails(validateLinks([]));
    ok(validateLinks([{ shopId: "s1", role: "STAFF" }]));
  });

  it("refuses an OWNER link — owners come only from registration or transfer", () => {
    fails(validateLinks([{ shopId: "s1", role: "OWNER" }]));
    fails(validateLinks([{ shopId: "s1", role: "STAFF" }, { shopId: "s2", role: "OWNER" }]));
  });

  it("accepts renter and staff together", () => {
    ok(validateLinks([{ shopId: "s1", role: "RENTER" }, { shopId: "s2", role: "STAFF" }]));
  });
});

describe("firstError", () => {
  it("returns the first failure so one message shows at a time (spec §7.2)", () => {
    expect(firstError(null, "second", "third")).toBe("second");
  });

  it("returns null when everything passes", () => {
    expect(firstError(null, null)).toBeNull();
  });

  it("preserves the caller's order", () => {
    // Name before phone: the spec fixes the sequence, not just the set.
    const message = firstError(validateName(""), validatePhone(""));
    expect(message).toBe(validateName(""));
  });
});
