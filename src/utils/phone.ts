/** Phone helpers. The API stores and expects bare 10-digit numbers; `+91` is UI only. */

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Normalise anything a user might type or paste into the 10 digits the API wants.
 * Handles a leading `+91`, `0091`, or a domestic `0`.
 */
export function normalisePhone(value: string) {
  const digits = digitsOnly(value);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidPhone(value: string) {
  return /^[0-9]{10}$/.test(digitsOnly(value));
}

/** "9820000000" → "+91 9820000000" (integration doc §11). */
export function formatPhone(value: string | null | undefined) {
  if (!value) return "";
  const digits = digitsOnly(value);
  return digits.length === 10 ? `+91 ${digits}` : value;
}

/** `tel:` target for the dialer. */
export function dialerUrl(value: string) {
  return `tel:+91${digitsOnly(value)}`;
}

/** `wa.me` target — WhatsApp wants the country code with no `+`. */
export function whatsAppUrl(value: string) {
  return `https://wa.me/91${digitsOnly(value)}`;
}
