/**
 * Forms - Public-facing surveys built on tables/fields/records.
 *
 * This module is the central place for the Forms feature's TypeScript types.
 * Code that reads/writes the `forms` table should use these types rather
 * than `any`, so changes to field_settings shape propagate via type errors.
 */

// ---------------------------------------------------------------------------
// Per-field config — what the form builder writes into `forms.field_settings`
// ---------------------------------------------------------------------------

/** Single conditional rule. Multiple are AND'd. */
export type ConditionalRule = {
  field_id: string;
  op: 'equals' | 'not_equals' | 'is_empty' | 'not_empty' | 'contains' | 'gt' | 'lt';
  value?: string | number | boolean | null;
};

export type FieldSettings = {
  /** When false, field is hidden from the public form entirely. */
  visible?: boolean;
  /** Numeric ordering within its section (or globally if no sections). */
  position?: number;
  /** Optional grouping — references a `sections[].id`. */
  section_id?: string;
  /** Display label override (defaults to fields.name when missing). */
  label_override?: string;
  /** Help text shown under the input. */
  help_text?: string;
  /** Placeholder for text inputs. */
  placeholder?: string;
  /** Override fields.is_required for this form specifically. */
  required_override?: boolean;
  /** Conditional visibility — show only if all rules are met. */
  conditional_rules?: {
    show_if: ConditionalRule[];
  };
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  position: number;
};

export type FormTheme = 'cream' | 'purple' | 'dark' | 'minimal';
export type FormStatus = 'draft' | 'published' | 'archived';

// ---------------------------------------------------------------------------
// WhatsApp automation — sent after every successful submission
// ---------------------------------------------------------------------------

export type WhatsappAutomation = {
  /** Master toggle */
  enabled: boolean;
  /**
   * Which WhatsApp instance (whatsapp_instances.id) to send from.
   * null = pick the workspace's first authorized instance automatically.
   */
  instance_id?: string | null;

  /** Send a confirmation message to the form respondent (if phone provided) */
  send_to_respondent?: boolean;
  /** Template body — supports {{field_slug}} and {{contact_*}} placeholders */
  respondent_message?: string;

  /** Send a notification to internal phone numbers */
  send_to_admins?: boolean;
  /** Phone numbers (with country code, no +). E.g. "972501234567" */
  admin_numbers?: string[];
  /** Template body for admins */
  admin_message?: string;
};

// ---------------------------------------------------------------------------
// The row shape as returned from Supabase
// ---------------------------------------------------------------------------

export type FormRow = {
  id: string;
  workspace_id: string;
  table_id: string;
  slug: string;
  title: string;
  description: string | null;
  status: FormStatus;
  field_settings: Record<string, FieldSettings>;
  sections: FormSection[];
  theme: FormTheme;
  brand_color: string | null;
  logo_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  cta_label: string;
  thank_you_title: string;
  thank_you_message: string | null;
  success_redirect_url: string | null;
  notification_emails: string[];
  show_progress_bar: boolean;
  allow_multiple_submissions: boolean;
  require_phone: boolean;
  require_email: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  total_submissions: number;
  total_completed: number;
  last_submission_at: string | null;

  /** WhatsApp automation triggered on every submission. Null = disabled. */
  whatsapp_automation: WhatsappAutomation | null;
};

// ---------------------------------------------------------------------------
// Field types that can be exposed in a public form.
//
// `relation`, `formula`, `user`, and `attachment` are EXCLUDED — these don't
// make sense in a public form (or require special handling). Everything
// else maps cleanly to a public input.
// ---------------------------------------------------------------------------

const PUBLIC_SAFE_FIELD_TYPES = new Set([
  'text',
  'longtext',
  'number',
  'currency',
  'date',
  'datetime',
  'select',
  'multiselect',
  'checkbox',
  'phone',
  'email',
  'url',
  'rating',
  'status',
  'city',
]);

export function isPublicSafeFieldType(type: string): boolean {
  return PUBLIC_SAFE_FIELD_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

/**
 * Convert a title to a URL-safe slug. Hebrew is romanized poorly so we
 * fall back to a random suffix when the result is empty.
 */
export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[\u0590-\u05FF]/g, '') // strip Hebrew
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  if (!slug) {
    // Fallback for all-Hebrew titles
    return `form-${Math.random().toString(36).slice(2, 8)}`;
  }
  return slug;
}

// ---------------------------------------------------------------------------
// Evaluate conditional visibility for a field given current answers.
// Used both at render time (hide fields) and validate time (skip required
// checks for hidden fields).
// ---------------------------------------------------------------------------

export function isFieldVisible(
  fieldId: string,
  fieldSettings: Record<string, FieldSettings>,
  answers: Record<string, any>,
  fieldsByKey: Map<string, { id: string; type: string }>,
): boolean {
  const settings = fieldSettings[fieldId];
  if (!settings) return true;
  if (settings.visible === false) return false;
  const rules = settings.conditional_rules?.show_if;
  if (!rules || rules.length === 0) return true;

  return rules.every((rule) => evaluateRule(rule, answers, fieldsByKey));
}

function evaluateRule(
  rule: ConditionalRule,
  answers: Record<string, any>,
  fieldsByKey: Map<string, { id: string; type: string }>,
): boolean {
  const targetVal = answers[rule.field_id];

  switch (rule.op) {
    case 'equals':
      return String(targetVal ?? '') === String(rule.value ?? '');
    case 'not_equals':
      return String(targetVal ?? '') !== String(rule.value ?? '');
    case 'is_empty':
      return targetVal === undefined || targetVal === null || targetVal === '';
    case 'not_empty':
      return targetVal !== undefined && targetVal !== null && targetVal !== '';
    case 'contains':
      if (Array.isArray(targetVal)) {
        return targetVal.includes(rule.value);
      }
      return String(targetVal ?? '').includes(String(rule.value ?? ''));
    case 'gt':
      return Number(targetVal) > Number(rule.value ?? 0);
    case 'lt':
      return Number(targetVal) < Number(rule.value ?? 0);
    default:
      return true;
  }
}
