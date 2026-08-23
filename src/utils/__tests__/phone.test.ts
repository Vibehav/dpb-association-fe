import { dialerUrl, digitsOnly, formatPhone, isValidPhone, normalisePhone, whatsAppUrl } from "../phone";

describe("normalisePhone", () => {
  it("keeps ten bare digits", () => {
    expect(normalisePhone("9820000000")).toBe("9820000000");
  });

  it("strips a pasted country code or leading zero", () => {
    // These are all things a collector realistically pastes from a contact card.
    expect(normalisePhone("+91 9820000000")).toBe("9820000000");
    expect(normalisePhone("+919820000000")).toBe("9820000000");
    expect(normalisePhone("0091-9820000000")).toBe("9820000000");
    expect(normalisePhone("09820000000")).toBe("9820000000");
  });

  it("strips separators and spaces", () => {
    expect(normalisePhone("98200 00000")).toBe("9820000000");
    expect(normalisePhone("982-000-0000")).toBe("9820000000");
  });

  it("leaves a short number short rather than padding it", () => {
    expect(normalisePhone("98200")).toBe("98200");
  });

  it("does NOT rescue an over-long number that has no recognised prefix", () => {
    // An 11-digit typo must stay 11 digits and fail validation. Taking "the last 10 digits
    // of anything longer" silently produced a different, entirely valid-looking number —
    // for a field that is hard-unique and identifies a person.
    expect(normalisePhone("98200000001")).toBe("98200000001");
    expect(isValidPhone(normalisePhone("98200000001"))).toBe(false);
  });

  it("only strips a prefix at its exact expected length", () => {
    expect(normalisePhone("919820000000")).toBe("9820000000");   // 12, starts 91
    expect(normalisePhone("00919820000000")).toBe("9820000000"); // 14, starts 0091
    expect(normalisePhone("09820000000")).toBe("9820000000");    // 11, starts 0
    // 12 digits not starting with 91 is a mistake, not a country code.
    expect(normalisePhone("129820000000")).toBe("129820000000");
  });
});

describe("isValidPhone", () => {
  it("is exactly ten digits", () => {
    expect(isValidPhone("9820000000")).toBe(true);
    expect(isValidPhone("+91 9820000000")).toBe(false); // 12 digits once stripped
    expect(isValidPhone("982000000")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("renders the +91 form, grouped 5+5 as the design shows", () => {
    expect(formatPhone("9820000000")).toBe("+91 98200 00000");
  });

  it("passes anything unexpected through untouched rather than mangling it", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("device hand-off URLs", () => {
  it("builds a dialer target with the country code", () => {
    expect(dialerUrl("9820000000")).toBe("tel:+919820000000");
  });

  it("builds a wa.me target with the country code and no plus", () => {
    // wa.me rejects a leading +.
    expect(whatsAppUrl("9820000000")).toBe("https://wa.me/919820000000");
  });

  it("normalises whatever it is handed", () => {
    expect(whatsAppUrl("+91 98200 00000")).toBe("https://wa.me/919820000000");
  });
});

describe("digitsOnly", () => {
  it("keeps digits only", () => {
    expect(digitsOnly("+91 (982) 000-0000")).toBe("919820000000");
  });
});
