/**
 * Display formatting.
 *
 * Money arrives from the server already computed (v2 Phase 1) — these only *render* it. The
 * old `money()` helper was removed in v1 because it rendered mock figures; `formatMoney` here
 * renders real ones and nothing else.
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

/**
 * What to show as a shop's title. Falls back to the shop number when no trading name is on
 * file — optional since client revision v1, because registration often happens before the
 * name is settled.
 *
 * The fallback is not cosmetic: a card with a blank title reads as a loading failure, and the
 * shop number is the shop's actual identity (unique, case-insensitive, always present) where
 * the name never was. Use this everywhere a shop is named, so a nameless shop looks the same
 * in every list.
 */
export function shopTitle(shop: { shopNumber: string; businessName: string | null }) {
  return shop.businessName?.trim() || shop.shopNumber;
}

/**
 * True when the shop has no trading name on record. Prefer the `BusinessName` component for
 * rendering; this is for the cases that need the fact rather than the text.
 */
export function hasNoBusinessName(shop: { businessName: string | null }) {
  return !shop.businessName?.trim();
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

// ---------------------------------------------------------------------------
// money (v2 Phase 1)
// ---------------------------------------------------------------------------

/**
 * 482500 → "₹4,82,500" — Indian digit grouping (functional spec §1). Whole rupees: the API
 * refuses paise, so there is nothing after the point to show.
 *
 * Built by hand rather than `toLocaleString("en-IN")`: Hermes on Android has shipped without
 * full ICU, where that silently falls back to Western grouping ("482,500"), and on a receipt
 * the grouping is not cosmetic.
 */
export function formatMoney(amount: number | null | undefined) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const negative = amount < 0;
  const digits = String(Math.trunc(Math.abs(amount)));
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}` : lastThree;
  return `${negative ? "-" : ""}₹${grouped}`;
}

/** "CHEQUE" → "Cheque", but "UPI" stays "UPI". As the receipt prints it. */
export function paymentModeLabel(mode: string) {
  return mode === "UPI" ? "UPI" : titleCase(mode);
}

/** Purpose as the collection form offers it. Receipts use the server's `purposeLabel`. */
export function purposeLabel(purpose: string) {
  if (purpose === "ANNUAL_FEE") return "Annual fee";
  if (purpose === "ONE_OFF") return "One-off";
  if (purpose === "EVENT_DONATION") return "Event donation";
  return titleCase(purpose);
}

/** "CASH_NOT_RECEIVED" → "Cash not received". */
export function cancelReasonLabel(reason: string) {
  const words = reason.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The fee chip's words. `NO_DEMAND` has none on purpose — no fee year is open, or the demand
 * isn't raised, and a "₹0" or "Due" chip there would be invented.
 */
export function feeChipLabel(status: string): string | null {
  if (status === "PAID") return "Fee paid";
  if (status === "PARTIAL") return "Part paid";
  if (status === "PENDING") return "Due";
  return null;
}

// ---------------------------------------------------------------------------
// dates people pick, and events (v2 Phase 2)
// ---------------------------------------------------------------------------

/** India has no daylight saving: IST is always UTC+05:30. */
const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Today in India as `YYYY-MM-DD` — what a spending's date and an event's status are measured
 * against on the server. Worked out by offset rather than `Intl`, which Hermes may lack.
 */
export function todayIso(now: Date = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → a local `Date` at midnight — the value a date picker shows. */
export function isoToDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A date picker's `Date` → `YYYY-MM-DD`, read in the phone's own calendar. */
export function dateToIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "08 Oct 2026 – 18 Oct 2026", or one date when there is no end (or it ends the same day). */
export function eventDates(startsOn: string, endsOn: string | null) {
  if (!endsOn || endsOn === startsOn) return formatDate(startsOn);
  return `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
}

/** The status chip's words. */
export function eventStatusLabel(status: string) {
  if (status === "ACTIVE") return "Active";
  if (status === "OPEN") return "Open";
  if (status === "CLOSED") return "Closed";
  return titleCase(status);
}

/** "NOT_PAID" → "Not paid". Same shape as the receipt cancel reasons. */
export function voidReasonLabel(reason: string) {
  return cancelReasonLabel(reason);
}
