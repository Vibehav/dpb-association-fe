import {
  cancelReasonLabel,
  countLine,
  feeChipLabel,
  formatMoney,
  paymentModeLabel,
  formatDate,
  formatDateTime,
  idProofLabel,
  idProofSummary,
  initials,
  hasNoBusinessName,
  roleLabel,
  shopTitle,
  tenancyLabel,
  titleCase
} from "../format";

describe("formatDate", () => {
  it("renders DD MMM YYYY (§11)", () => {
    expect(formatDate("2026-08-22")).toBe("22 Aug 2026");
  });

  it("presents a UTC instant in IST, not UTC", () => {
    // 19:30 UTC is 01:00 the NEXT day in IST (+5:30). If this ever returns "22 Aug 2026"
    // the timezone conversion has been lost and dates will be a day out for late-evening
    // records.
    expect(formatDate("2026-08-22T19:30:00Z")).toBe("23 Aug 2026");
  });

  it("returns empty for absent or unparseable input rather than 'Invalid Date'", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("includes a time and shifts to IST", () => {
    const shown = formatDateTime("2026-08-22T19:30:00Z");
    expect(shown).toContain("23 Aug 2026");
    expect(shown).toMatch(/1:00/);
  });

  it("returns empty for bad input", () => {
    expect(formatDateTime("nope")).toBe("");
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(initials("Sachin Shinde")).toBe("SS");
    expect(initials("ramesh patil")).toBe("RP");
  });

  it("handles one word, extra spaces and long names", () => {
    expect(initials("Amrish")).toBe("A");
    expect(initials("  Sunita   Deshmukh  ")).toBe("SD");
    expect(initials("Anil Kumar Jadhav")).toBe("AK");
  });
});

describe("enum labels", () => {
  it("uses the design's wording for tenancy, not titleCase", () => {
    // titleCase("OWNER_RUN") gives the robotic "Owner Run".
    expect(tenancyLabel("OWNER_RUN")).toBe("Run by owner");
    expect(tenancyLabel("RENTED_OUT")).toBe("Rented out");
  });

  it("falls back for an unknown tenancy rather than rendering the raw enum", () => {
    expect(tenancyLabel("SOMETHING_NEW")).toBe("Something New");
  });

  it("title-cases link roles", () => {
    expect(roleLabel("OWNER")).toBe("Owner");
    expect(roleLabel("RENTER")).toBe("Renter");
    expect(roleLabel("STAFF")).toBe("Staff");
  });

  it("uses the collector's wording for ID proofs, which titleCase cannot produce", () => {
    // titleCase mangles three of the five, which is why the map exists at all.
    expect(idProofLabel("PAN")).toBe("PAN CARD"); // titleCase gives "Pan"
    expect(idProofLabel("VOTER_ID")).toBe("VOTER ID"); // titleCase gives "Voter Id"
    // The wire value is American; the label an Indian collector reads is not.
    expect(idProofLabel("DRIVING_LICENSE")).toBe("DRIVING LICENCE");
    expect(idProofLabel("AADHAAR")).toBe("AADHAAR");
    expect(idProofLabel("PASSPORT")).toBe("PASSPORT");
  });

  it("degrades a type it doesn't know rather than rendering undefined", () => {
    // A sixth value added server-side must still read as something.
    expect(idProofLabel("RATION_CARD")).toBe("RATION CARD");
  });

  it("masks the last four beside the type, and omits it when unrecorded", () => {
    // A bare "••••4567" is no longer safe to read as an Aadhaar.
    expect(idProofSummary("PASSPORT", "4567")).toBe("PASSPORT ••••4567");
    expect(idProofSummary("PAN", "234F")).toBe("PAN CARD ••••234F");
    expect(idProofSummary("VOTER_ID", null)).toBe("VOTER ID");
  });

  it("titleCase expands underscores", () => {
    expect(titleCase("ID_PROOF_FRONT")).toBe("Id Proof Front");
  });
});

describe("countLine", () => {
  it("reports the loaded count against the true total, grouped Indian-style", () => {
    // The total comes from `totalElements`, never the loaded array length.
    expect(countLine(6, 1024, "shop")).toBe("6 of 1,024 shops shown");
  });

  it("takes an explicit plural where the noun needs one", () => {
    expect(countLine(3, 13, "person", "people")).toBe("3 of 13 people shown");
  });

  it("uses the singular when the total is one", () => {
    expect(countLine(1, 1, "shop")).toBe("1 of 1 shop shown");
  });
});

/**
 * The trading name became optional in client revision v1, so a shop can arrive with none.
 * `shopTitle` is what stops a card rendering a blank line, which reads as a loading failure.
 */
describe("shopTitle — a shop always has something to be called", () => {
  it("uses the business name when there is one", () => {
    expect(shopTitle({ shopNumber: "A-31", businessName: "Shree Traders" })).toBe("Shree Traders");
  });

  it("falls back to the shop number, which is the shop's real identity", () => {
    expect(shopTitle({ shopNumber: "A-31", businessName: null })).toBe("A-31");
  });

  it("treats a whitespace-only name as no name", () => {
    // The API stores "" and "   " as null, but a stale cache or an in-flight form value can
    // still hand us one — and " " would render as an empty title.
    expect(shopTitle({ shopNumber: "A-31", businessName: "   " })).toBe("A-31");
  });
});

describe("hasNoBusinessName", () => {
  it("is true for null and for whitespace, false for a real name", () => {
    expect(hasNoBusinessName({ businessName: null })).toBe(true);
    expect(hasNoBusinessName({ businessName: "  " })).toBe(true);
    expect(hasNoBusinessName({ businessName: "Shree Traders" })).toBe(false);
  });
});

describe("formatMoney", () => {
  it("groups in the Indian way — last three, then pairs", () => {
    expect(formatMoney(0)).toBe("₹0");
    expect(formatMoney(501)).toBe("₹501");
    expect(formatMoney(2100)).toBe("₹2,100");
    expect(formatMoney(482500)).toBe("₹4,82,500");
    expect(formatMoney(12345678)).toBe("₹1,23,45,678");
  });

  it("reads the API's two-decimal numbers as whole rupees", () => {
    expect(formatMoney(5000.0)).toBe("₹5,000");
  });

  it("never renders a withheld figure as ₹0", () => {
    // `spent` and `balance` arrive null for a collector — withheld, not zero.
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
});

describe("feeChipLabel", () => {
  it("has words for every position a shop can be in this year", () => {
    expect(feeChipLabel("PAID")).toBe("Fee paid");
    expect(feeChipLabel("PARTIAL")).toBe("Part paid");
    expect(feeChipLabel("PENDING")).toBe("Due");
  });

  it("has none for NO_DEMAND — no year open or no demand raised, so no chip at all", () => {
    expect(feeChipLabel("NO_DEMAND")).toBeNull();
  });
});

describe("money labels", () => {
  it("keeps UPI in capitals and title-cases the rest", () => {
    expect(paymentModeLabel("UPI")).toBe("UPI");
    expect(paymentModeLabel("CHEQUE")).toBe("Cheque");
  });

  it("reads a cancel reason as a sentence", () => {
    expect(cancelReasonLabel("CASH_NOT_RECEIVED")).toBe("Cash not received");
  });
});
