/**
 * Server-side validation for form submissions.
 *
 * The client renderer also does some validation, but this is the source
 * of truth: we never trust what came through the wire. Specifically we
 * enforce:
 *
 *   1. Required fields are present (and not just empty strings).
 *   2. require_phone / require_email at the form level.
 *   3. Select / multiselect values match the field's option allowlist.
 *   4. Email and URL formats are well-formed.
 *   5. Phone is digits/+/-/() etc (loose format — we don't enforce E.164
 *      here because some forms accept local 050-1234567 format).
 *   6. Number is within min/max from field.config when set.
 *   7. Rating is within 0..max (default 5) from field.config.
 *   8. Date / datetime are parseable.
 *   9. URL scheme is http/https only (no javascript:, data:, etc.).
 *  10. Conditional visibility is re-evaluated on the server — hidden
 *      fields don't need to be present, and required-checks skip them.
 *      This prevents a malicious client from "lying" about a condition
 *      and bypassing required checks.
 *
 * Returns either { ok: true, sanitized } where `sanitized` is the
 * cleaned answers map (only including visible+valid values), or
 * { ok: false, errors } where errors is a list of `{ field_id, message }`.
 */

import type { FormRow } from './types';
import { isFieldVisible } from './types';

export type Field = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_required: boolean;
  config: any;
};

export type ValidationError = {
  field_id: string | null;
  field_name?: string;
  code:
    | 'required'
    | 'invalid_email'
    | 'invalid_phone'
    | 'invalid_url'
    | 'invalid_number'
    | 'invalid_date'
    | 'out_of_range'
    | 'invalid_option'
    | 'invalid_rating'
    | 'too_long';
  message: string;
};

export type ValidationResult =
  | { ok: true; sanitized: Record<string, any> }
  | { ok: false; errors: ValidationError[] };

const MAX_STRING_LEN = 5000;

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public email validator — reusable across the codebase. */
export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

/**
 * Phone validation: minimum 6 digits anywhere in the input, allow common
 * separators. We don't enforce E.164 because Israeli forms typically take
 * "050-1234567" and we don't want to reject that.
 */
export function isValidPhone(v: string): boolean {
  const digits = v.replace(/[^\d]/g, '');
  return digits.length >= 6 && digits.length <= 20;
}

/**
 * URL validation that explicitly rejects javascript: and data: schemes
 * to prevent stored-XSS via the URL field.
 */
function isValidUrl(v: string): boolean {
  try {
    const url = new URL(v);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDate(v: string): boolean {
  // HTML date inputs produce YYYY-MM-DD; datetime-local produces YYYY-MM-DDTHH:MM
  // Both parse cleanly via Date.parse
  const t = Date.parse(v);
  return Number.isFinite(t);
}

// ---------------------------------------------------------------------------
// Option allowlist for select / multiselect
// ---------------------------------------------------------------------------

function getAllowedOptions(config: any): Set<string> {
  const options = config?.options;
  if (!Array.isArray(options)) return new Set();
  return new Set(
    options
      .map((o: any) => (o && typeof o === 'object' ? o.value ?? o.label : o))
      .filter((v: any) => v !== undefined && v !== null)
      .map((v: any) => String(v)),
  );
}

// ---------------------------------------------------------------------------
// Per-type validators
// ---------------------------------------------------------------------------

type ValidateOne = (
  rawValue: any,
  field: Field,
) => { value: any; error: ValidationError | null };

const validators: Record<string, ValidateOne> = {
  text: (raw, field) => coerceString(raw, field),
  longtext: (raw, field) => coerceString(raw, field),
  city: (raw, field) => coerceString(raw, field),

  email: (raw, field) => {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null, error: null };
    if (!EMAIL_RE.test(s)) {
      return {
        value: null,
        error: errFor(field, 'invalid_email', 'כתובת אימייל לא תקינה'),
      };
    }
    return { value: s.slice(0, 200), error: null };
  },

  phone: (raw, field) => {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null, error: null };
    if (!isValidPhone(s)) {
      return {
        value: null,
        error: errFor(field, 'invalid_phone', 'מספר טלפון לא תקין'),
      };
    }
    return { value: s.slice(0, 50), error: null };
  },

  url: (raw, field) => {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null, error: null };
    if (!isValidUrl(s)) {
      return {
        value: null,
        error: errFor(field, 'invalid_url', 'כתובת אינטרנט לא תקינה'),
      };
    }
    return { value: s.slice(0, MAX_STRING_LEN), error: null };
  },

  number: (raw, field) => coerceNumber(raw, field),
  currency: (raw, field) => coerceNumber(raw, field),

  date: (raw, field) => {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null, error: null };
    if (!isValidDate(s)) {
      return {
        value: null,
        error: errFor(field, 'invalid_date', 'תאריך לא תקין'),
      };
    }
    return { value: s, error: null };
  },

  datetime: (raw, field) => {
    const s = String(raw ?? '').trim();
    if (!s) return { value: null, error: null };
    if (!isValidDate(s)) {
      return {
        value: null,
        error: errFor(field, 'invalid_date', 'תאריך/שעה לא תקין'),
      };
    }
    return { value: s, error: null };
  },

  select: (raw, field) => {
    if (raw === null || raw === undefined || raw === '') {
      return { value: null, error: null };
    }
    const s = String(raw);
    const allowed = getAllowedOptions(field.config);
    if (allowed.size > 0 && !allowed.has(s)) {
      return {
        value: null,
        error: errFor(field, 'invalid_option', `ערך לא חוקי בשדה ${field.name}`),
      };
    }
    return { value: s, error: null };
  },

  status: (raw, field) => validators.select(raw, field),

  multiselect: (raw, field) => {
    if (raw === null || raw === undefined || raw === '') {
      return { value: null, error: null };
    }
    if (!Array.isArray(raw)) {
      return {
        value: null,
        error: errFor(field, 'invalid_option', `${field.name}: ערך לא תקין`),
      };
    }
    const allowed = getAllowedOptions(field.config);
    const cleaned: string[] = [];
    for (const item of raw) {
      const s = String(item);
      if (allowed.size > 0 && !allowed.has(s)) {
        return {
          value: null,
          error: errFor(field, 'invalid_option', `${field.name}: ערך לא חוקי "${s}"`),
        };
      }
      cleaned.push(s.slice(0, MAX_STRING_LEN));
    }
    if (cleaned.length === 0) return { value: null, error: null };
    return { value: cleaned, error: null };
  },

  checkbox: (raw) => ({ value: Boolean(raw), error: null }),

  rating: (raw, field) => {
    if (raw === null || raw === undefined || raw === '') {
      return { value: null, error: null };
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return {
        value: null,
        error: errFor(field, 'invalid_rating', `${field.name}: ערך לא תקין`),
      };
    }
    const max = Number(field.config?.max ?? 5);
    if (n > max) {
      return {
        value: null,
        error: errFor(
          field,
          'invalid_rating',
          `${field.name}: ערך חורג מהמקסימום (${max})`,
        ),
      };
    }
    return { value: Math.round(n), error: null };
  },
};

function coerceString(raw: any, field: Field) {
  if (raw === null || raw === undefined) return { value: null, error: null };
  const s = String(raw);
  if (s.length > MAX_STRING_LEN) {
    return {
      value: null,
      error: errFor(field, 'too_long', `${field.name}: הטקסט ארוך מדי`),
    };
  }
  if (s.trim() === '') return { value: null, error: null };
  return { value: s, error: null };
}

function coerceNumber(raw: any, field: Field) {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, error: null };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return {
      value: null,
      error: errFor(field, 'invalid_number', `${field.name}: לא מספר חוקי`),
    };
  }
  const min = field.config?.min;
  const max = field.config?.max;
  if (typeof min === 'number' && n < min) {
    return {
      value: null,
      error: errFor(
        field,
        'out_of_range',
        `${field.name}: ערך נמוך מהמינימום (${min})`,
      ),
    };
  }
  if (typeof max === 'number' && n > max) {
    return {
      value: null,
      error: errFor(
        field,
        'out_of_range',
        `${field.name}: ערך גבוה מהמקסימום (${max})`,
      ),
    };
  }
  return { value: n, error: null };
}

function errFor(
  field: Field,
  code: ValidationError['code'],
  message: string,
): ValidationError {
  return { field_id: field.id, field_name: field.name, code, message };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function validateSubmission(
  form: FormRow,
  fields: Field[],
  answers: Record<string, any>,
  contact: { phone: string | null; email: string | null },
): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitized: Record<string, any> = {};

  // Build a quick id→field index for conditional eval
  const fieldsByKey = new Map<string, { id: string; type: string }>();
  fields.forEach((f) => fieldsByKey.set(f.id, { id: f.id, type: f.type }));

  // Pass 1: per-field validation. We don't enforce 'required' yet — we need
  // to know which fields are visible (conditional) first, which depends on
  // the answers we're cleaning right now. Two-pass approach is necessary.
  for (const field of fields) {
    const raw = answers[field.id];
    const validator = validators[field.type];
    if (!validator) {
      // Type not whitelisted for public forms; skip silently
      continue;
    }
    const result = validator(raw, field);
    if (result.error) {
      errors.push(result.error);
    } else if (
      result.value !== null &&
      result.value !== undefined &&
      result.value !== ''
    ) {
      sanitized[field.id] = result.value;
    }
  }

  // If we hit any per-field errors, stop here. Returning a partial sanitized
  // map would let a submission with bad values still write to the DB if we
  // ignored the errors.
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Pass 2: required-field enforcement. Use sanitized as the source of truth
  // for conditional eval — that way conditions reference cleaned values, not
  // raw client input.
  for (const field of fields) {
    // Check visibility (form-level + conditional rules)
    const visible = isFieldVisible(
      field.id,
      form.field_settings,
      sanitized,
      fieldsByKey,
    );
    if (!visible) {
      // Field is hidden → drop any value that snuck through, and skip the
      // required check (you can't be required if you're not shown).
      delete sanitized[field.id];
      continue;
    }

    // Determine effective required: form-level override beats field-level
    const settings = form.field_settings[field.id];
    const required =
      settings?.required_override !== undefined
        ? Boolean(settings.required_override)
        : field.is_required;

    if (required) {
      const value = sanitized[field.id];
      const isEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        errors.push({
          field_id: field.id,
          field_name: field.name,
          code: 'required',
          message: `${settings?.label_override || field.name}: שדה חובה`,
        });
      }
    }
  }

  // Form-level required checks for contact
  if (form.require_phone && !contact.phone) {
    errors.push({
      field_id: null,
      code: 'required',
      message: 'מספר טלפון הוא שדה חובה',
    });
  }
  if (form.require_email && !contact.email) {
    errors.push({
      field_id: null,
      code: 'required',
      message: 'כתובת אימייל היא שדה חובה',
    });
  }
  // Validate contact format
  if (contact.email && !EMAIL_RE.test(contact.email)) {
    errors.push({
      field_id: null,
      code: 'invalid_email',
      message: 'כתובת אימייל לא תקינה',
    });
  }
  if (contact.phone && !isValidPhone(contact.phone)) {
    errors.push({
      field_id: null,
      code: 'invalid_phone',
      message: 'מספר טלפון לא תקין',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, sanitized };
}
