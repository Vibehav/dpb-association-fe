/**
 * Client-side validation, mirroring integration doc §8.
 *
 * These exist to give instant feedback, not to enforce anything — the server applies the
 * same rules and answers 400/409 if the client is bypassed. Each function returns an
 * error message or `null`, so callers can show one plain message at a time (the order the
 * functional spec §7.2 asks for).
 */

import { normalisePhone } from "./phone";

export const OTP_LENGTH = 6;
export const PIN_LENGTH = 4;

export function validateName(value: string) {
  return value.trim() ? null : "Enter the member's full name.";
}

export function validatePhone(value: string) {
  // Normalised so a pasted "+91 …" passes, while an 11-digit typo still fails.
  const digits = normalisePhone(value);
  if (!digits) return "Enter a mobile number.";
  if (digits.length !== 10) return "Enter a 10-digit mobile number.";
  return null;
}

/** Required for committee sign-in: first-login and reset codes arrive by email. */
export function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return "Enter an email address.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "Enter a valid email address.";
}

/** WhatsApp is optional — it defaults to the phone server-side when omitted. */
export function validateWhatsApp(value: string) {
  if (!value.trim()) return null;
  return validatePhone(value);
}

export function validatePin(value: string) {
  return /^[0-9]{4}$/.test(value) ? null : "Enter your 4-digit M-PIN.";
}

export function validateOtp(value: string) {
  return new RegExp(`^[0-9]{${OTP_LENGTH}}$`).test(value) ? null : `Enter the ${OTP_LENGTH}-digit code.`;
}

export function validateShopNumber(value: string) {
  return value.trim() ? null : "Enter the shop number.";
}

export function validateBusinessName(value: string) {
  return value.trim() ? null : "Enter the business name.";
}

export function validateLane(value: string) {
  return value.trim() ? null : "Enter the lane or wing.";
}

/** Optional, but must be exactly 4 digits when given. */
export function validateAadhaarLast4(value: string) {
  if (!value.trim()) return null;
  return /^[0-9]{4}$/.test(value.trim()) ? null : "Aadhaar last 4 digits must be 4 numbers.";
}

export function validateConsent(consent: boolean) {
  return consent ? null : "The member must consent before their details can be saved.";
}

// §8's "photo and Aadhaar front are mandatory" rule lives in `media/validation.ts` as
// `imageFieldError`, which also needs the capture state to tell "not captured" apart from
// "upload failed" — a distinction the API now enforces via `media_not_uploaded`.

/** Every new member needs at least one shop link, and it may not be an OWNER link. */
export function validateLinks(links: { shopId: string; role: string }[]) {
  if (links.length === 0) return "Link the member to at least one shop with a role.";
  if (links.some((link) => link.role === "OWNER")) {
    return "The licence holder is set through shop registration or transfer.";
  }
  return null;
}

/** Run checks in order and return the first message, so the user sees one thing at a time. */
export function firstError(...checks: (string | null)[]) {
  return checks.find((message) => message !== null) ?? null;
}
