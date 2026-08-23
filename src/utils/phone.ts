/** Phone helpers. The API stores and expects bare 10-digit numbers; `+91` is UI only. */

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Reduce anything a user might type or paste to the 10 digits the API wants.
 *
 * Only **recognised country/trunk prefixes** are stripped, and only at their exact expected
 * length. An earlier version took "the last 10 digits of anything longer than 10", which
 * quietly turned a typo into a different, entirely valid-looking number:
 * `98200000001` (one digit too many) became `8200000001`. Now that input stays 11 digits
 * long and fails validation, which is the only safe outcome for a field that is hard-unique
 * and used to identify a person.
 */
export function normalisePhone(value: string) {
  const digits = digitsOnly(value);

  if (digits.length === 14 && digits.startsWith("0091")) return digits.slice(4);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);

  return digits;
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

/**
 * `tel:` target for the dialer.
 *
 * Normalises first: prefixing a number that already carries its country code produced
 * `tel:+91919820000000`.
 */
export function dialerUrl(value: string) {
  return `tel:+91${normalisePhone(value)}`;
}

/** `wa.me` target — WhatsApp wants the country code with no `+`. */
export function whatsAppUrl(value: string) {
  return `https://wa.me/91${normalisePhone(value)}`;
}
