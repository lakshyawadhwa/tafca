/**
 * Client-side mirrors of the API's class-validator rules.
 *
 * The patterns come from `@ca-practice-os/shared`, the same source the DTOs
 * import, so a rule can't drift between the two sides. These checks are a UX
 * convenience only — the API still validates every request.
 */
import { REGEX } from '@ca-practice-os/shared';

/** Returns an error message, or '' when the value is acceptable. */
export type Validator = (value: string) => string;

/** Optional fields: blank is always allowed, format is checked when present. */
function whenPresent(check: Validator): Validator {
  return (value) => (value.trim() ? check(value.trim()) : '');
}

export const validatePan = whenPresent((v) =>
  REGEX.PAN.test(v.toUpperCase()) ? '' : 'Invalid PAN — 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)',
);

export const validateTan = whenPresent((v) =>
  REGEX.TAN.test(v.toUpperCase()) ? '' : 'Invalid TAN — 4 letters, 5 digits, 1 letter (e.g. ABCD12345E)',
);

export const validateCin = whenPresent((v) =>
  REGEX.CIN.test(v.toUpperCase()) ? '' : 'Invalid CIN — 21 characters (e.g. U12345AB1234ABC123456)',
);

export const validateGstin = whenPresent((v) =>
  REGEX.GSTIN.test(v.toUpperCase()) ? '' : 'Invalid GSTIN — 15 characters (e.g. 27AAPFU0939F1ZV)',
);

export const validateEmail = whenPresent((v) =>
  REGEX.EMAIL.test(v) ? '' : 'Enter a valid email address',
);

/**
 * The API requires E.164 (`+` country code, no spaces). Indian numbers are
 * usually typed as "98765 43210", so say exactly what the field wants.
 */
export const validatePhone = whenPresent((v) =>
  REGEX.E164_PHONE.test(v)
    ? ''
    : 'Include the country code and no spaces (e.g. +919876543210)',
);

export function validateLength(label: string, min: number, max: number): Validator {
  return (value) => {
    const v = value.trim();
    if (v.length < min) return `${label} must be at least ${min} characters`;
    if (v.length > max) return `${label} must be at most ${max} characters`;
    return '';
  };
}

export const validatePassword = validateLength('Password', 8, 128);

/** Runs validators by field name and returns only the fields that failed. */
export function collectErrors(
  checks: Record<string, [string, Validator]>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, [value, check]] of Object.entries(checks)) {
    const message = check(value);
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * Maps an API validation failure back onto form fields.
 *
 * The global exception filter emits `message: ["field: constraint message"]`
 * (see createValidationPipe), so anything the client missed can still be shown
 * next to the right input instead of as a raw toast.
 */
export function parseApiFieldErrors(err: any): Record<string, string> {
  const messages = err?.body?.message;
  if (!Array.isArray(messages)) return {};

  const errors: Record<string, string> = {};
  for (const entry of messages) {
    if (typeof entry !== 'string') continue;
    const separator = entry.indexOf(': ');
    if (separator === -1) continue;
    const field = entry.slice(0, separator);
    // class-validator reports several constraints per field; the first is enough.
    if (!errors[field]) errors[field] = entry.slice(separator + 2);
  }
  return errors;
}
