import { REGEX } from '@ca-practice-os/shared';

/**
 * Validation functions wrapping shared REGEX constants.
 * Returns error message string or null if valid.
 * Used for blur-based validation on form fields.
 */

export function validatePAN(value: string): string | null {
  if (!value) return null;
  if (!REGEX.PAN.test(value)) {
    return 'Invalid PAN format. Expected: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)';
  }
  return null;
}

export function validateTAN(value: string): string | null {
  if (!value) return null;
  if (!REGEX.TAN.test(value)) {
    return 'Invalid TAN format. Expected: 4 letters, 5 digits, 1 letter (e.g., ABCD12345E)';
  }
  return null;
}

export function validateCIN(value: string): string | null {
  if (!value) return null;
  if (!REGEX.CIN.test(value)) {
    return 'Invalid CIN format. Expected: U/L + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits (e.g., U12345AB1234ABC123456)';
  }
  return null;
}

export function validateGSTIN(value: string): string | null {
  if (!value) return null;
  if (!REGEX.GSTIN.test(value)) {
    return 'Invalid GSTIN format. Expected: 15 characters (e.g., 27AAPFU0939F1ZV)';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value) return null;
  if (!REGEX.EMAIL.test(value)) {
    return 'Invalid email format';
  }
  return null;
}

export function validateRequired(value: string | null | undefined, fieldName: string): string | null {
  if (!value || !value.trim()) {
    return `${fieldName} is required`;
  }
  return null;
}
