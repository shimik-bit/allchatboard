import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as adminClient } from '@supabase/supabase-js';
import { getTemplate } from '@/lib/reports/templates';
import { sendWhatsAppText } from '@/lib/reports/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/reports/run/[id] - manually trigger a report (for testing).
 * Sends to the configured recipients immediately.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Fetch report (RLS ensures user has access)
  const { data: report } = await supabase
    .from('scheduled_reports')
    .select('*, workspaces(whatsapp_instance_id, whatsapp_token)')
    .eq('id', params.id)
    .single();

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ws = (report.workspaces as any) || {};
  if (!ws.whatsapp_instance_id || !ws.whatsapp_token) {
    return NextResponse.json({ error: 'WhatsApp not configured for this workspace' }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const template = getTemplate(report.template_type);
    if (!template) throw new Error(`Unknown template: ${report.template_type}`);

    // Use admin client for query (we already verified access above via RLS)
    const admin = adminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const generated = await template.generate(
      admin,
      report.workspace_id,
      report.template_config || {},
      report.table_ids
    );

    const sentTo: string[] = [];
    const failedTo: string[] = [];

    for (const phone of (report.recipient_phones || [])) {
      const result = await sendWhatsAppText(ws.whatsapp_instance_id, ws.whatsapp_token, phone, generated.message);
      if (result.ok) sentTo.push(phone);
      else failedTo.push(phone);
    }

    await supabase.from('scheduled_report_runs').insert({
      report_id: report.id,
      workspace_id: report.workspace_id,
      success: failedTo.length === 0,
      recipients_sent: sentTo,
      recipients_failed: failedTo,
      message_preview: generated.message.slice(0, 500),
      duration_ms: Date.now() - startedAt,
    });

    await supabase.from('scheduled_reports')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (report.run_count || 0) + 1,
      })
      .eq('id', report.id);

    return NextResponse.json({
      ok: true,
      sent_to: sentTo,
      failed: failedTo,
      message_preview: generated.message,
    });
  } catch (e: any) {
    await supabase.from('scheduled_report_runs').insert({
      report_id: report.id,
      workspace_id: report.workspace_id,
      success: false,
      error_message: e?.message || 'Unknown error',
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
