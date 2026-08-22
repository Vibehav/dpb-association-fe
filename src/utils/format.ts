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

/** "OWNER_RUN" → "Owner Run". For rendering server enums. */
export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** "RENTER" → "Renter". Enum labels that are a single word. */
export function roleLabel(role: string) {
  return titleCase(role);
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
