import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTemplate } from '@/lib/reports/templates';
import { sendWhatsAppText } from '@/lib/reports/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;  // Up to 60s for batch processing

/**
 * GET /api/reports/cron
 *
 * Triggered by Vercel Cron every 15 minutes (configured in vercel.json).
 * Finds reports whose next_run_at <= now() and runs them.
 *
 * Auth: Vercel adds an `authorization: Bearer <CRON_SECRET>` header automatically.
 * We verify against process.env.CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  // Auth check - only Vercel cron should call this
  const authHeader = req.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'dev-cron-secret'}`;
  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find due reports (next_run_at in the past, enabled)
  const { data: dueReports, error } = await admin
    .from('scheduled_reports')
    .select('*, workspaces(whatsapp_instance_id, whatsapp_token, name)')
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .lte('next_run_at', new Date().toISOString())
    .limit(50);  // Cap per cron tick

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueReports || dueReports.length === 0) {
    return NextResponse.json({ ok: true, due: 0, message: 'no reports due' });
  }

  const results = [];

  for (const report of dueReports) {
    const startTime = Date.now();
    const ws = (report.workspaces as any) || {};
    const whatsappInstance = ws.whatsapp_instance_id;
    const whatsappToken = ws.whatsapp_token;

    // Skip if workspace has no WhatsApp configured
    if (!whatsappInstance || !whatsappToken) {
      await admin.from('scheduled_report_runs').insert({
        report_id: report.id,
        workspace_id: report.workspace_id,
        success: false,
        error_message: 'Workspace has no WhatsApp configured',
        duration_ms: Date.now() - startTime,
      });
      results.push({ report_id: report.id, success: false, reason: 'no_whatsapp' });
      continue;
    }

    try {
      // 1. Generate the report message using the template
      const template = getTemplate(report.template_type);
      if (!template) {
        throw new Error(`Unknown template: ${report.template_type}`);
      }

      const generated = await template.generate(
        admin,
        report.workspace_id,
        report.template_config || {},
        report.table_ids
      );

      // 2. Send to all recipient phones
      const sentTo: string[] = [];
      const failedTo: string[] = [];

      for (const phone of (report.recipient_phones || [])) {
        const result = await sendWhatsAppText(whatsappInstance, whatsappToken, phone, generated.message);
        if (result.ok) {
          sentTo.push(phone);
        } else {
          failedTo.push(phone);
        }
      }

      // 3. Log the run
      await admin.from('scheduled_report_runs').insert({
        report_id: report.id,
        workspace_id: report.workspace_id,
        success: failedTo.length === 0,
        recipients_sent: sentTo,
        recipients_failed: failedTo,
        message_preview: generated.message.slice(0, 500),
        duration_ms: Date.now() - startTime,
        error_message: failedTo.length > 0 ? `Failed: ${failedTo.join(', ')}` : null,
      });

      // 4. Update next_run_at — call DB function
      const { data: nextRun } = await admin.rpc('compute_next_report_run', {
        p_schedule_time: report.schedule_time,
        p_schedule_days: report.schedule_days,
        p_timezone: report.timezone,
        p_after: new Date(Date.now() + 60 * 1000).toISOString(),  // +1min to avoid re-running
      });

      await admin.from('scheduled_reports')
        .update({
          last_run_at: new Date().toISOString(),
          run_count: (report.run_count || 0) + 1,
          next_run_at: nextRun,
        })
        .eq('id', report.id);

      results.push({
        report_id: report.id,
        name: report.name,
        success: true,
        sent_to: sentTo.length,
        failed: failedTo.length,
        record_count: generated.recordCount,
      });
    } catch (e: any) {
      await admin.from('scheduled_report_runs').insert({
        report_id: report.id,
        workspace_id: report.workspace_id,
        success: false,
        error_message: e?.message || 'Unknown error',
        duration_ms: Date.now() - startTime,
      });

      // Still advance next_run_at so failed reports don't loop forever
      const { data: nextRun } = await admin.rpc('compute_next_report_run', {
        p_schedule_time: report.schedule_time,
        p_schedule_days: report.schedule_days,
        p_timezone: report.timezone,
        p_after: new Date(Date.now() + 60 * 1000).toISOString(),
      });
      await admin.from('scheduled_reports')
        .update({ next_run_at: nextRun })
        .eq('id', report.id);

      results.push({ report_id: report.id, success: false, error: e?.message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
