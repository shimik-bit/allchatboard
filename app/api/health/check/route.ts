import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getInstanceState } from '@/lib/instances/green-api-client';
import { triggerAlert, dispatchPendingAlerts } from '@/lib/system-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/health/check
 *
 * Periodic health check that runs once per day via Vercel cron.
 *
 * Tasks performed:
 *   1. Check every active WhatsApp instance — if state != 'authorized',
 *      fire a system alert. This catches scenarios like:
 *      - User logged out from their phone
 *      - Green API session expired
 *      - QR code needs re-scanning
 *      - Account was banned
 *
 *   2. Re-dispatch any unsent alert notifications (alerts whose WhatsApp/email
 *      delivery previously failed get a retry).
 *
 * Auth: Vercel Cron sends Bearer CRON_SECRET. Manual calls accepted with
 * the same secret for testing.
 */

async function handler(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron');

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const stats = {
    instances_checked: 0,
    instances_unhealthy: 0,
    pending_alerts_dispatched: 0,
    errors: [] as string[],
  };

  // ===== Task 1: Check WhatsApp instance health =====
  try {
    const { data: instances } = await admin
      .from('whatsapp_instances')
      .select('id, id_instance, api_token_instance, workspace_id, name, is_active')
      .eq('is_active', true);

    if (instances) {
      for (const inst of instances) {
        stats.instances_checked++;

        if (!inst.id_instance || !inst.api_token_instance) {
          // Misconfigured instance — alert
          await triggerAlert({
            severity: 'error',
            source: 'whatsapp',
            title: `מופע WhatsApp ללא הגדרות תקינות (${inst.name || inst.id})`,
            details: `Instance row ${inst.id} is_active=true but missing credentials.`,
            workspaceId: inst.workspace_id,
            dedupeKey: `whatsapp_misconfigured_${inst.id}`,
          });
          stats.instances_unhealthy++;
          continue;
        }

        try {
          const state = await getInstanceState(
            String(inst.id_instance),
            inst.api_token_instance
          );

          // 'authorized' is the only healthy state.
          // Other states: 'notAuthorized' (logged out), 'starting',
          //               'sleepMode', 'blocked', 'unknown' (API call failed)
          if (state !== 'authorized') {
            const severity = state === 'blocked' ? 'fatal' : 'error';
            const stateMessages: Record<string, string> = {
              notAuthorized: 'יצא מהחשבון - יש לסרוק QR מחדש',
              blocked: 'החשבון נחסם על ידי WhatsApp ⚠️',
              starting: 'במצב הפעלה (starting) - אם נמשך זמן רב, בעיה',
              sleepMode: 'במצב שינה - שלח הודעה כדי להעיר',
              unknown: 'קריאת API נכשלה - ייתכן שChannel Token פג',
            };

            await triggerAlert({
              severity,
              source: 'whatsapp',
              title: `מופע WhatsApp לא פעיל: ${inst.name || inst.id_instance}`,
              details:
                `Instance ID: ${inst.id_instance}\n` +
                `Status: ${state}\n` +
                `${stateMessages[state] || ''}\n\n` +
                `Workspace ID: ${inst.workspace_id}\n` +
                `Action needed: כנס ל-AllChat ובדוק את המופע.`,
              workspaceId: inst.workspace_id,
              dedupeKey: `whatsapp_disconnect_${inst.id_instance}`,
              metadata: { state, instance_id: inst.id_instance },
            });
            stats.instances_unhealthy++;
          }
        } catch (e: any) {
          // API call itself failed — likely a transient network issue,
          // but worth flagging if it persists (dedupe handles the noise).
          await triggerAlert({
            severity: 'warning',
            source: 'whatsapp',
            title: `שגיאה בבדיקת מופע WhatsApp ${inst.name || inst.id_instance}`,
            details: `Error: ${e?.message || String(e)}`,
            workspaceId: inst.workspace_id,
            dedupeKey: `whatsapp_check_error_${inst.id_instance}`,
          });
          stats.errors.push(`${inst.id}: ${e?.message}`);
        }
      }
    }
  } catch (e: any) {
    stats.errors.push(`instance check: ${e?.message}`);
  }

  // ===== Task 2: Retry any failed notification dispatches =====
  try {
    const result = await dispatchPendingAlerts();
    stats.pending_alerts_dispatched = result.dispatched;
  } catch (e: any) {
    stats.errors.push(`dispatch retry: ${e?.message}`);
  }

  return NextResponse.json({ ok: true, stats });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
