/**
 * System Alerts — central library for triggering and dispatching critical alerts.
 *
 * Public API:
 *   triggerAlert(opts) — call this from anywhere a critical error occurs.
 *                        Records the alert + dispatches notifications.
 *
 *   dispatchPendingAlerts() — call from cron to retry failed deliveries.
 *
 * Notification channels:
 *   1. Dashboard (always — just sits in DB)
 *   2. WhatsApp (for severity='fatal' only — paging the operator)
 *   3. Email (for severity='fatal' AND 'error')
 */

import { createAdminClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/groupguard/green-api-client';

export type AlertSeverity = 'fatal' | 'error' | 'warning';
export type AlertSource =
  | 'whatsapp'
  | 'cardcom'
  | 'ai'
  | 'database'
  | 'cron'
  | 'webhook'
  | 'auth'
  | 'other';

export interface TriggerAlertOpts {
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  details?: string;
  workspaceId?: string;
  /**
   * Stable identifier for the underlying issue. Triggering the same dedupe_key
   * within 30 minutes will increment occurrence_count instead of creating
   * a new alert. Recommended format: "subsystem_specific_id" e.g.
   * "whatsapp_disconnect_7107597263" or "cardcom_recurring_fail_workspace_xxx".
   */
  dedupeKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Records a critical alert and dispatches notifications.
 *
 * Always returns — never throws. Failure to dispatch the notification is
 * logged but doesn't propagate, because the *caller* is in the middle of
 * its own error-handling and we don't want to compound the failure.
 */
export async function triggerAlert(opts: TriggerAlertOpts): Promise<string | null> {
  try {
    const admin = createAdminClient();

    // Insert alert via the deduplicating RPC
    const { data: alertId, error } = await admin.rpc('trigger_system_alert', {
      p_severity: opts.severity,
      p_source: opts.source,
      p_title: opts.title,
      p_details: opts.details || null,
      p_workspace_id: opts.workspaceId || null,
      p_dedupe_key: opts.dedupeKey || null,
      p_metadata: opts.metadata || {},
    });

    if (error || !alertId) {
      console.error('[system-alerts] failed to record alert', error);
      return null;
    }

    // Fire-and-forget the dispatcher. We don't await — this gives the caller
    // their response back immediately, and the notification happens in the
    // background. If the runtime kills us, the cron job will pick up the
    // un-dispatched alert later.
    dispatchAlert(alertId).catch((e) => {
      console.error('[system-alerts] dispatch error', e);
    });

    return alertId;
  } catch (e) {
    console.error('[system-alerts] triggerAlert threw', e);
    return null;
  }
}

/**
 * Sends notifications for a single alert across all configured channels.
 * Each channel is independent — a failure in WhatsApp doesn't block email.
 */
async function dispatchAlert(alertId: string): Promise<void> {
  const admin = createAdminClient();

  // Load the alert
  const { data: alert } = await admin
    .from('system_alerts')
    .select('*')
    .eq('id', alertId)
    .single();

  if (!alert) return;

  // Skip if we've already dispatched (this can happen if the cron job picks
  // up an alert that was just dispatched in real-time)
  if (alert.notified_whatsapp_at && alert.notified_email_at) return;

  // Load admin recipient settings
  const { data: setting } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'admin_alert_recipients')
    .single();

  const recipients = setting?.value || {};
  const enabledChannels: string[] = recipients.enabled_channels || [];

  // ===== Channel 1: WhatsApp (for severity=fatal) =====
  if (
    alert.severity === 'fatal' &&
    enabledChannels.includes('whatsapp') &&
    recipients.whatsapp_phone &&
    !alert.notified_whatsapp_at
  ) {
    try {
      await sendWhatsAppAlert(recipients.whatsapp_phone, alert);
      await admin
        .from('system_alerts')
        .update({ notified_whatsapp_at: new Date().toISOString() })
        .eq('id', alertId);
    } catch (e: any) {
      await recordDispatchFailure(alertId, 'whatsapp', e?.message || String(e));
    }
  }

  // ===== Channel 2: Email (for fatal + error) =====
  if (
    (alert.severity === 'fatal' || alert.severity === 'error') &&
    enabledChannels.includes('email') &&
    recipients.email &&
    !alert.notified_email_at
  ) {
    try {
      await sendEmailAlert(recipients.email, alert);
      await admin
        .from('system_alerts')
        .update({ notified_email_at: new Date().toISOString() })
        .eq('id', alertId);
    } catch (e: any) {
      await recordDispatchFailure(alertId, 'email', e?.message || String(e));
    }
  }
}

/**
 * Send the alert message via WhatsApp using the platform's own Green API
 * instance. We grab the first active instance for the admin's workspace —
 * that way we're using bandwidth the admin already pays for.
 */
async function sendWhatsAppAlert(phoneNumber: string, alert: any): Promise<void> {
  const admin = createAdminClient();

  // Find ANY authorized instance to send from. We don't care which workspace —
  // this is a system-level message. Sort by created_at to get a stable
  // primary instance.
  const { data: instance } = await admin
    .from('whatsapp_instances')
    .select('provider_instance_id, provider_token')
    .eq('state', 'authorized')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!instance?.provider_instance_id || !instance?.provider_token) {
    throw new Error('no authorized WhatsApp instance available to send alert');
  }

  // Format message - use plain text only, WhatsApp doesn't render markdown well
  const severityEmoji = {
    fatal: '🚨',
    error: '⚠️',
    warning: 'ℹ️',
  }[alert.severity as AlertSeverity];

  const occurrenceNote =
    alert.occurrence_count > 1
      ? `\n📊 קרה ${alert.occurrence_count} פעמים בחצי שעה האחרונה`
      : '';

  const message =
    `${severityEmoji} *התראת מערכת*\n\n` +
    `*${alert.title}*\n\n` +
    (alert.details ? `${alert.details.slice(0, 500)}\n` : '') +
    occurrenceNote +
    `\n\n📍 ${alert.source} · ${new Date(alert.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;

  // Build chat ID (Green API format: phone@c.us, no leading + or 00)
  const chatId = `${phoneNumber.replace(/[^\d]/g, '')}@c.us`;

  const result = await sendMessage(
    {
      idInstance: String(instance.provider_instance_id),
      apiTokenInstance: instance.provider_token,
    } as any,
    chatId,
    message
  );

  if (!result.ok) {
    throw new Error(`Green API failed: ${(result as any).error || 'unknown'}`);
  }
}

/**
 * Send the alert via Resend (https://resend.com).
 *
 * We use Resend because:
 *   - Simple HTTP API, no SDK needed
 *   - 3000 free emails/month (plenty for ops alerts)
 *   - Fast deliverability
 *
 * Requires RESEND_API_KEY env var. If not set, this throws and the alert
 * is recorded as "email failed" — but the dashboard entry still exists.
 */
async function sendEmailAlert(emailAddress: string, alert: any): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const severityLabel = {
    fatal: '[FATAL]',
    error: '[ERROR]',
    warning: '[WARNING]',
  }[alert.severity as AlertSeverity];

  const subject = `${severityLabel} ${alert.title}`;

  // HTML body — keep it plain so it renders in any client
  const occurrenceLine =
    alert.occurrence_count > 1
      ? `<p><strong>Repeated:</strong> ${alert.occurrence_count} times in the last 30 minutes</p>`
      : '';

  const detailsBlock = alert.details
    ? `<pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;white-space:pre-wrap;">${escapeHtml(alert.details)}</pre>`
    : '';

  const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1 style="color:#dc2626;font-size:20px;margin:0 0 16px 0;">
    ${escapeHtml(severityLabel)} ${escapeHtml(alert.title)}
  </h1>
  <p><strong>Source:</strong> ${escapeHtml(alert.source)}</p>
  <p><strong>When:</strong> ${new Date(alert.created_at).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })} (Israel time)</p>
  ${occurrenceLine}
  ${detailsBlock}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
  <p style="color:#666;font-size:12px;">
    This alert was sent automatically by the TaskFlow AI monitoring system.
    To unsubscribe, update your preferences in
    <a href="https://taskflow-ai.com/dashboard/admin/alerts">the admin dashboard</a>.
  </p>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TaskFlow Alerts <alerts@taskflow-ai.com>',
      to: [emailAddress],
      subject,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Resend API ${res.status}: ${errorText.slice(0, 200)}`);
  }
}

/**
 * Re-tries dispatching for any alerts that haven't been delivered yet.
 * Called by the daily cron. Picks up alerts that:
 *   - Were created in the last 24 hours
 *   - Have severity that warrants notification
 *   - Haven't been notified yet on at least one channel
 *   - Have fewer than 5 prior attempts (give up after that)
 */
export async function dispatchPendingAlerts(): Promise<{ dispatched: number; skipped: number }> {
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from('system_alerts')
    .select('id, severity, notified_whatsapp_at, notified_email_at, notification_attempts')
    .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .lt('notification_attempts', 5)
    .or('notified_whatsapp_at.is.null,notified_email_at.is.null');

  if (!pending) return { dispatched: 0, skipped: 0 };

  let dispatched = 0;
  let skipped = 0;

  for (const alert of pending) {
    // Filter: warnings don't trigger notifications, just sit on dashboard
    if (alert.severity === 'warning') {
      skipped++;
      continue;
    }
    try {
      await dispatchAlert(alert.id);
      dispatched++;
    } catch (e) {
      console.error('[system-alerts] retry failed for', alert.id, e);
      await admin
        .from('system_alerts')
        .update({ notification_attempts: alert.notification_attempts + 1 })
        .eq('id', alert.id);
    }
  }

  return { dispatched, skipped };
}

async function recordDispatchFailure(
  alertId: string,
  channel: string,
  errorMsg: string
): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc('increment_alert_attempts', { p_alert_id: alertId }).then(() => {}).catch(() => {});
  await admin
    .from('system_alerts')
    .update({ notification_error: `${channel}: ${errorMsg.slice(0, 500)}` })
    .eq('id', alertId);
  console.error(`[system-alerts] ${channel} dispatch failed for ${alertId}: ${errorMsg}`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
