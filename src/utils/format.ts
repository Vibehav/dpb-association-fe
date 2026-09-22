/**
 * Display formatting. There is deliberately no money formatter — v1 has no money
 * (integration doc §11), and the old `money()` helper only existed to render mock figures.
 */

const IST = "Asia/Kolkata";

/** "SK" from "Suresh Kumar". Used for avatars. */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Record text is stored and shown in capitals — names, business names, lanes, addresses
 * and shop numbers. Applied as the user types (see `Field`'s `uppercase` prop) so what is
 * on screen is exactly what is sent. Numeric fields and email addresses are excluded:
 * digits have no case, and an uppercased email reads as shouting.
 */
export function upperCase(value: string) {
  return value.toUpperCase();
}

/** "OWNER_RUN" → "Owner Run". For rendering server enums. */
export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * ID proof in the words a collector uses, in capitals like the rest of the record.
 *
 * Not `titleCase`, which mangles three of the five: it gives "Pan" and "Voter Id", and it
 * keeps the API's American "License". Note the deliberate split — `DRIVING_LICENSE` is the
 * wire value and must stay American, while "DRIVING LICENCE" is what an Indian collector
 * reads. Changing either one to match the other breaks something.
 *
 * Typed `string` rather than `IdProofType`, like `tenancyLabel`, so a sixth value added
 * server-side degrades to readable text instead of rendering `undefined`.
 */
export function idProofLabel(type: string) {
  switch (type) {
    case "AADHAAR":
      return "AADHAAR";
    case "DRIVING_LICENSE":
      return "DRIVING LICENCE";
    case "PASSPORT":
      return "PASSPORT";
    case "VOTER_ID":
      return "VOTER ID";
    case "PAN":
      return "PAN CARD";
    default:
      return titleCase(type).toUpperCase();
  }
}

/** "PASSPORT ••••4567", or just the label when the last four were never recorded. */
export function idProofSummary(type: string, last4: string | null) {
  const label = idProofLabel(type);
  return last4 ? `${label} ••••${last4}` : label;
}

/** "RENTER" → "Renter". Enum labels that are a single word. */
export function roleLabel(role: string) {
  return titleCase(role);
}

/**
 * Tenancy in the design's own words (prototype `rentedOptions`).
 *
 * Not `titleCase`, which turned `OWNER_RUN` into the slightly robotic "Owner Run".
 */
export function tenancyLabel(tenancy: string) {
  if (tenancy === "OWNER_RUN") return "Run by owner";
  if (tenancy === "RENTED_OUT") return "Rented out";
  return titleCase(tenancy);
}

/**
 * ISO date or instant → "22 Aug 2026".
 *
 * `formerHolderTill` arrives as `YYYY-MM-DD`; `addedOn` as an ISO instant in UTC. Both
 * are presented in IST (integration doc §11).
 */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST
  }).format(date);
}

/** ISO instant → "22 Aug 2026, 3:04 pm" in IST. */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST
  }).format(date);
}

/** "6 of 1,024 shops shown" — the count line from the design. */
export function countLine(shown: number, total: number, noun: string, pluralNoun = `${noun}s`) {
  const label = total === 1 ? noun : pluralNoun;
  return `${shown.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} ${label} shown`;
}
