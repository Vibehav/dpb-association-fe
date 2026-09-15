import { countLine, formatDate, formatDateTime, initials, roleLabel, tenancyLabel, titleCase } from "../format";

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
