import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText } from '@/lib/reports/whatsapp';
import { applyFieldMapping, renderTemplate, type FieldMapping } from '@/lib/automations/field-mapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET/POST /api/workflows/scheduled-cron
 *
 * Polled by Vercel Cron every 5 minutes. Processes pending entries from
 * scheduled_workflow_jobs whose run_at has passed.
 *
 * For each pending job:
 *   1. Mark as 'running' (optimistic lock via attempts)
 *   2. Re-fetch the latest record data (in case it changed since scheduling)
 *   3. Re-fetch the workflow definition (in case it changed)
 *   4. Execute the workflow's actions against the record
 *   5. Mark as 'completed' or 'failed'
 *   6. Log to workflow_runs (same as normal dispatch)
 *
 * Auth: Vercel Cron sends Bearer with CRON_SECRET. Manual calls also accepted
 * with the same secret for testing.
 */

async function handler(req: NextRequest) {
  // Auth check - allow Vercel cron header OR explicit Bearer
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

  // Fetch up to 100 pending jobs whose run_at has passed
  const { data: jobs, error: fetchErr } = await admin.rpc('get_pending_workflow_jobs', { p_limit: 100 });
  if (fetchErr) {
    return NextResponse.json({ error: 'fetch failed: ' + fetchErr.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const results: any[] = [];

  for (const job of jobs) {
    processed++;

    // Optimistic lock: mark as running
    const { error: lockErr } = await admin
      .from('scheduled_workflow_jobs')
      .update({ status: 'running', attempts: (job.attempts || 0) + 1 })
      .eq('id', job.id)
      .eq('status', 'pending'); // only if still pending

    if (lockErr) {
      results.push({ job_id: job.id, error: 'lock failed: ' + lockErr.message });
      continue;
    }

    try {
      // Re-fetch the workflow (it may have been disabled or modified)
      const { data: wf } = await admin
        .from('workflows')
        .select('*, workspaces(whatsapp_instance_id, whatsapp_token)')
        .eq('id', job.workflow_id)
        .single();

      if (!wf || !wf.enabled) {
        await admin
          .from('scheduled_workflow_jobs')
          .update({ status: 'cancelled', error_message: 'workflow disabled or deleted' })
          .eq('id', job.id);
        results.push({ job_id: job.id, status: 'cancelled', reason: 'wf_disabled' });
        continue;
      }

      // Re-fetch the record (it may have been updated since scheduling)
      const { data: record } = await admin
        .from('records')
        .select('id, data')
        .eq('id', job.record_id)
        .single();

      if (!record) {
        await admin
          .from('scheduled_workflow_jobs')
          .update({ status: 'cancelled', error_message: 'record deleted' })
          .eq('id', job.id);
        results.push({ job_id: job.id, status: 'cancelled', reason: 'record_deleted' });
        continue;
      }

      // Execute all actions
      const startedAt = Date.now();
      const actionResults: any[] = [];
      let overallSuccess = true;
      let lastError: string | undefined;

      for (let i = 0; i < (wf.actions || []).length; i++) {
        const action = wf.actions[i];
        try {
          const result = await executeAction(admin, wf, action, {
            workspace_id: job.workspace_id,
            table_id: job.table_id,
            record_id: job.record_id,
            new_data: record.data,
            ws: wf.workspaces,
          });
          actionResults.push({ index: i, type: action.type, success: true, output: result });
        } catch (e: any) {
          actionResults.push({ index: i, type: action.type, success: false, error: e?.message });
          overallSuccess = false;
          lastError = e?.message;
        }
      }

      // Mark job as completed/failed
      await admin
        .from('scheduled_workflow_jobs')
        .update({
          status: overallSuccess ? 'completed' : 'failed',
          executed_at: new Date().toISOString(),
          error_message: lastError || null,
        })
        .eq('id', job.id);

      // Log to workflow_runs (same as immediate dispatch)
      await admin.from('workflow_runs').insert({
        workflow_id: wf.id,
        workspace_id: job.workspace_id,
        trigger_record_id: job.record_id,
        success: overallSuccess,
        actions_executed: actionResults,
        duration_ms: Date.now() - startedAt,
        error_message: lastError || null,
      });

      // Update workflow stats
      await admin.from('workflows').update({
        run_count: (wf.run_count || 0) + 1,
        last_run_at: new Date().toISOString(),
        last_error: lastError || null,
      }).eq('id', wf.id);

      if (overallSuccess) succeeded++; else failed++;
      results.push({ job_id: job.id, workflow: wf.name, success: overallSuccess, actions: actionResults.length });
    } catch (e: any) {
      // Catch-all: mark as failed
      await admin
        .from('scheduled_workflow_jobs')
        .update({
          status: 'failed',
          executed_at: new Date().toISOString(),
          error_message: e?.message || 'unknown error',
        })
        .eq('id', job.id);
      failed++;
      results.push({ job_id: job.id, error: e?.message });
    }
  }

  return NextResponse.json({ ok: true, processed, succeeded, failed, results });
}

export const GET = handler;
export const POST = handler;

// ===========================================================================
// ACTION EXECUTION (mirrors /api/workflows/dispatch executeAction)
// ===========================================================================
async function executeAction(
  admin: any,
  workflow: any,
  action: any,
  ctx: { workspace_id: string; table_id: string; record_id: string; new_data: any; ws: any }
) {
  const config = action.config || {};

  switch (action.type) {
    case 'send_whatsapp':
    case 'notify_user': {
      // 'notify_user' uses a hardcoded phone in config; 'send_whatsapp' uses a field on the record
      const phone = action.type === 'notify_user'
        ? config.phone
        : ctx.new_data?.[config.phone_field || 'phone'];

      const messageTemplate = config.message_template || config.message || '';
      if (!phone) throw new Error(`${action.type}: no phone resolved`);
      if (!ctx.ws?.whatsapp_instance_id) throw new Error(`${action.type}: workspace has no WhatsApp`);

      const message = renderTemplate(messageTemplate, ctx.new_data || {});
      const result = await sendWhatsAppText(
        ctx.ws.whatsapp_instance_id,
        ctx.ws.whatsapp_token,
        phone,
        message
      );
      if (!result.ok) throw new Error('whatsapp send failed: ' + result.error);
      return { sent_to: phone };
    }

    case 'update_field': {
      const fieldSlug = config.field_slug;
      const value = config.value;
      if (!fieldSlug) throw new Error('update_field: field_slug missing');
      const newData = { ...ctx.new_data, [fieldSlug]: value };
      const { error } = await admin
        .from('records')
        .update({ data: newData })
        .eq('id', ctx.record_id);
      if (error) throw new Error(error.message);
      return { field: fieldSlug, value };
    }

    case 'create_record': {
      const targetTableId = config.target_table_id;
      const mapping: FieldMapping = config.field_mapping || {};
      if (!targetTableId) throw new Error('create_record: target_table_id missing');
      const targetData = applyFieldMapping(ctx.new_data || {}, mapping);
      const { data: newRecord, error } = await admin
        .from('records')
        .insert({
          table_id: targetTableId,
          workspace_id: ctx.workspace_id,
          data: targetData,
          source: 'manual',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return { new_record_id: newRecord.id };
    }

    default:
      throw new Error(`scheduled cron: unsupported action type: ${action.type}`);
  }
}
