// Sends WhatsApp messages triggered by a form submission.
//
// Used as a fire-and-forget call from /api/forms/[slug]/submit. We don't
// want a failing WhatsApp send to fail the whole submission, so any error
// is logged and swallowed.

import { createAdminClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/groupguard/green-api-client';
import type { FormRow, WhatsappAutomation } from './types';

// ---------------------------------------------------------------------------
// Template rendering — {{placeholder}} substitution
// ---------------------------------------------------------------------------

/**
 * Renders a message template, replacing {{placeholders}} with values.
 *
 * Supported placeholders:
 *   {{contact_name}}, {{contact_phone}}, {{contact_email}}
 *   {{form_title}}, {{submitted_at}}
 *   {{<field_slug>}}    -- any field by its slug
 *
 * Unknown placeholders are replaced with empty string. We intentionally
 * don't error — better to send a slightly empty message than no message.
 */
export function renderTemplate(
  template: string,
  context: {
    form: FormRow;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    /** Map of field_slug → value (already coerced to display-friendly string) */
    fieldValues: Map<string, string>;
  },
): string {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key) => {
    switch (key) {
      case 'contact_name':
        return context.contactName ?? '';
      case 'contact_phone':
        return context.contactPhone ?? '';
      case 'contact_email':
        return context.contactEmail ?? '';
      case 'form_title':
        return context.form.title;
      case 'submitted_at':
        return new Date().toLocaleString('he-IL');
      default: {
        return context.fieldValues.get(key) ?? '';
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a phone string into Green API's chatId format ({phone}@c.us).
 * Strips non-digits, then prepends 972 if it looks like an Israeli local
 * format starting with 0.
 */
export function toWhatsAppChatId(phone: string): string | null {
  let digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) {
    digits = '972' + digits.slice(1);
  }
  if (digits.length < 7 || digits.length > 15) return null;
  return `${digits}@c.us`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Sends all configured WhatsApp messages for a successful submission.
 * Never throws — all errors are logged. Returns a summary object so the
 * caller could log it, but the result is not used in the submit flow.
 */
export async function dispatchFormWhatsAppMessages(params: {
  form: FormRow;
  workspaceId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** record.data — keyed by field_id */
  recordData: Record<string, any>;
  /** field metadata so we can build slug→value map */
  fields: { id: string; slug: string; type: string; config: any }[];
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const stats = { sent: 0, skipped: 0, failed: 0 };
  const automation = params.form.whatsapp_automation;
  if (!automation || !automation.enabled) {
    return stats;
  }

  try {
    // 1. Build field_slug → display-string map for template substitution
    const fieldValues = new Map<string, string>();
    for (const field of params.fields) {
      const raw = params.recordData[field.id];
      if (raw === undefined || raw === null) continue;
      let display = '';
      if (Array.isArray(raw)) {
        // Translate option values to labels for select/multiselect
        const options = field.config?.options ?? [];
        display = raw
          .map((v) => {
            const opt = options.find((o: any) => (o.value ?? o.label ?? o) === v);
            return opt?.label ?? String(v);
          })
          .join(', ');
      } else if (field.type === 'select' || field.type === 'status') {
        const options = field.config?.options ?? [];
        const opt = options.find((o: any) => (o.value ?? o.label ?? o) === raw);
        display = opt?.label ?? String(raw);
      } else if (field.type === 'checkbox') {
        display = raw ? 'כן' : 'לא';
      } else {
        display = String(raw);
      }
      fieldValues.set(field.slug, display);
    }

    // 2. Resolve which WhatsApp instance to use
    const creds = await resolveInstanceCreds(
      params.workspaceId,
      automation.instance_id ?? null,
    );
    if (!creds) {
      console.warn(
        '[forms-whatsapp] no usable WhatsApp instance for workspace',
        params.workspaceId,
      );
      stats.skipped++;
      return stats;
    }

    const renderCtx = {
      form: params.form,
      contactName: params.contactName,
      contactPhone: params.contactPhone,
      contactEmail: params.contactEmail,
      fieldValues,
    };

    // 3. Send to respondent
    if (automation.send_to_respondent && params.contactPhone) {
      const chatId = toWhatsAppChatId(params.contactPhone);
      if (chatId && automation.respondent_message) {
        const body = renderTemplate(automation.respondent_message, renderCtx).trim();
        if (body) {
          const result = await sendMessage(creds, chatId, body);
          if (result.ok) stats.sent++;
          else {
            console.warn('[forms-whatsapp] respondent send failed:', result.error);
            stats.failed++;
          }
        }
      }
    } else if (automation.send_to_respondent) {
      // Want to send but no phone available — skip silently
      stats.skipped++;
    }

    // 4. Send to admins
    if (
      automation.send_to_admins &&
      automation.admin_numbers &&
      automation.admin_numbers.length > 0 &&
      automation.admin_message
    ) {
      const body = renderTemplate(automation.admin_message, renderCtx).trim();
      if (body) {
        for (const number of automation.admin_numbers) {
          const chatId = toWhatsAppChatId(number);
          if (!chatId) {
            stats.skipped++;
            continue;
          }
          const result = await sendMessage(creds, chatId, body);
          if (result.ok) stats.sent++;
          else {
            console.warn('[forms-whatsapp] admin send failed:', result.error);
            stats.failed++;
          }
        }
      }
    }
  } catch (err) {
    console.error('[forms-whatsapp] unexpected error:', err);
    stats.failed++;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Instance resolution
// ---------------------------------------------------------------------------

async function resolveInstanceCreds(
  workspaceId: string,
  preferredInstanceId: string | null,
): Promise<{ instanceId: string; apiToken: string } | null> {
  const admin = createAdminClient();

  // Try the specifically-configured instance first
  if (preferredInstanceId) {
    const { data } = await admin
      .from('whatsapp_instances')
      .select('provider_instance_id, provider_token, state, workspace_id')
      .eq('id', preferredInstanceId)
      .maybeSingle();
    if (
      data &&
      data.workspace_id === workspaceId &&
      data.provider_instance_id &&
      data.provider_token
    ) {
      return {
        instanceId: data.provider_instance_id,
        apiToken: data.provider_token,
      };
    }
  }

  // Fall back to the first authorized instance for this workspace
  const { data: instances } = await admin
    .from('whatsapp_instances')
    .select('provider_instance_id, provider_token, state')
    .eq('workspace_id', workspaceId)
    .order('authorized_at', { ascending: false, nullsFirst: false })
    .limit(5);

  for (const row of instances ?? []) {
    if (row.provider_instance_id && row.provider_token) {
      return {
        instanceId: row.provider_instance_id,
        apiToken: row.provider_token,
      };
    }
  }

  return null;
}
