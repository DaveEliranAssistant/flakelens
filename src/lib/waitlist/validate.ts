import { WAITLIST_CONSENT_ERROR, WAITLIST_EMAIL_ERROR } from "@/lib/waitlist/messages";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Postgres text cannot hold NUL, so these must fail validation, not the insert.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export type WaitlistFields = {
  email?: string;
  consent?: string;
};

export type WaitlistValidation =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; signup: { email: string; consent: true } }
  | { ok: false; fields: WaitlistFields };

export function normalizeEmail(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function validateWaitlistInput(input: unknown): WaitlistValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, fields: { email: WAITLIST_EMAIL_ERROR, consent: WAITLIST_CONSENT_ERROR } };
  }
  const record = input as Record<string, unknown>;
  if (typeof record.company_website === "string" && record.company_website.trim().length > 0) {
    return { ok: true, honeypot: true };
  }

  const fields: WaitlistFields = {};
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : "";
  if (email.length === 0 || email.length > 254 || CONTROL_CHARS.test(email) || !EMAIL_PATTERN.test(email)) {
    fields.email = WAITLIST_EMAIL_ERROR;
  }
  if (record.consent !== true) fields.consent = WAITLIST_CONSENT_ERROR;
  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return { ok: true, honeypot: false, signup: { email, consent: true } };
}
