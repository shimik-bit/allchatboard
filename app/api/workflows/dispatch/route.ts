import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText } from '@/lib/reports/whatsapp';
import { applyFieldMapping, renderTemplate, type FieldMapping } from '@/lib/automations/field-mapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/workflows/dispatch
 *
 * Called by the records DB trigger via pg_net on every INSERT/UPDATE.
 * Body: { event_type, workspace_id, table_id, record_id, changed_fields, old_data, new_data }
 *
 * For each enabled workflow in the workspace:
 *   1. Check if its trigger matches this event
 *   2. If yes, execute its actions sequentially
 *   3. Log the run
 */
export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-cron-secret'}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const event = await req.json();
  const { event_type, workspace_id, table_id, record_id, changed_fields, old_data, new_data } = event;

  if (!workspace_id || !table_id || !record_id) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find matching workflows
  const { data: workflows } = await admin
    .from('workflows')
    .select('*, workspaces(whatsapp_instance_id, whatsapp_token)')
    .eq('workspace_id', workspace_id)
    .eq('enabled', true);

  if (!workflows || workflows.length === 0) {
    return NextResponse.json({ ok: true, fired: 0 });
  }

  const fired: any[] = [];

  for (const wf of workflows) {
    if (!matchesTrigger(wf, event_type, table_id, changed_fields, old_data, new_data)) continue;

    const startedAt = Date.now();
    const actionResults: any[] = [];
    let overallSuccess = true;
    let lastError: string | undefined;

    for (let i = 0; i < (wf.actions || []).length; i++) {
      const action = wf.actions[i];
      try {
        const result = await executeAction(admin, wf, action, {
          workspace_id, table_id, record_id, new_data, ws: wf.workspaces,
        });
        actionResults.push({ index: i, type: action.type, success: true, output: result });
      } catch (e: any) {
        actionResults.push({ index: i, type: action.type, success: false, error: e?.message });
        overallSuccess = false;
        lastError = e?.message;
        // Continue other actions even if one fails
      }
    }

    // Log the run
    await admin.from('workflow_runs').insert({
      workflow_id: wf.id,
      workspace_id,
      trigger_record_id: record_id,
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

    fired.push({ workflow_id: wf.id, name: wf.name, success: overallSuccess });
  }

  return NextResponse.json({ ok: true, fired: fired.length, results: fired });
}

// ===========================================================================
// TRIGGER MATCHING
// ===========================================================================
function matchesTrigger(
  workflow: any,
  eventType: string,
  tableId: string,
  changedFields: any,
  oldData: any,
  newData: any
): boolean {
  const trigger = workflow.trigger_type;
  const config = workflow.trigger_config || {};

  // All triggers require matching table
  if (config.table_id && config.table_id !== tableId) return false;

  switch (trigger) {
    case 'record_created':
      return eventType === 'record_created';

    case 'field_changed': {
      if (eventType !== 'record_updated') return false;
      const fieldSlug = config.field_slug;
      if (!fieldSlug) return false;
      // Field must have actually changed
      if (!changedFields || !(fieldSlug in changedFields)) return false;
      // If specific to_value is configured, check it
      if (config.to_value !== undefined && config.to_value !== null) {
        return newData?.[fieldSlug] === config.to_value;
      }
      return true;
    }

    default:
      return false;
  }
}

// ===========================================================================
// ACTION EXECUTION
// ===========================================================================
async function executeAction(
  admin: any,
  workflow: any,
  action: any,
  ctx: { workspace_id: string; table_id: string; record_id: string; new_data: any; ws: any }
) {
  const config = action.config || {};

  switch (action.type) {
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
          source: 'manual',  // workflow-created
          conversion_links: {
            originated_from: {
              table_id: ctx.table_id,
              record_id: ctx.record_id,
              at: new Date().toISOString(),
              by_workflow: workflow.id,
            },
          },
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return { new_record_id: newRecord.id };
    }

    case 'update_field': {
      // Update the record that triggered the workflow
      const fieldSlug = config.field_slug;
      const value = config.value;
      if (!fieldSlug) throw new Error('update_field: field_slug missing');

      // To avoid infinite loop (this update would trigger the workflow again),
      // we set a flag in the record. The trigger SQL function should ignore
      // updates that come from workflows themselves, but for now just update.
      const newData = { ...ctx.new_data, [fieldSlug]: value };
      const { error } = await admin
        .from('records')
        .update({ data: newData })
        .eq('id', ctx.record_id);
      if (error) throw new Error(error.message);
      return { field: fieldSlug, value };
    }

    case 'send_whatsapp': {
      const phoneField = config.phone_field || 'phone';
      const phone = ctx.new_data?.[phoneField];
      const messageTemplate = config.message_template || '';

      if (!phone) throw new Error('send_whatsapp: no phone in record');
      if (!ctx.ws?.whatsapp_instance_id) throw new Error('send_whatsapp: workspace has no WhatsApp');

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

    case 'start_sequence': {
      const sequenceId = config.sequence_id;
      if (!sequenceId) throw new Error('start_sequence: sequence_id missing');

      // Fetch sequence and compute first step time
      const { data: seq } = await admin
        .from('sequences')
        .select('steps, enabled')
        .eq('id', sequenceId)
        .single();

      if (!seq || !seq.enabled) throw new Error('sequence not found or disabled');

      const firstStep = (seq.steps || [])[0];
      const delayMs = (firstStep?.delay_days || 0) * 86400_000 + (firstStep?.delay_hours || 0) * 3600_000;
      const nextStepAt = new Date(Date.now() + delayMs);

      const { error } = await admin
        .from('sequence_enrollments')
        .upsert({
          sequence_id: sequenceId,
          record_id: ctx.record_id,
          workspace_id: ctx.workspace_id,
          status: 'active',
          current_step: 0,
          next_step_at: nextStepAt.toISOString(),
          enrolled_at: new Date().toISOString(),
        }, { onConflict: 'sequence_id,record_id' });

      if (error) throw new Error(error.message);
      return { enrolled_in: sequenceId };
    }

    case 'notify_user': {
      const phone = config.phone;
      const messageTemplate = config.message || '';
      if (!phone) throw new Error('notify_user: phone missing');
      if (!ctx.ws?.whatsapp_instance_id) throw new Error('notify_user: no whatsapp');

      const message = renderTemplate(messageTemplate, ctx.new_data || {});
      const result = await sendWhatsAppText(
        ctx.ws.whatsapp_instance_id,
        ctx.ws.whatsapp_token,
        phone,
        message
      );
      if (!result.ok) throw new Error('notification failed: ' + result.error);
      return { notified: phone };
    }

    default:
      throw new Error(`unknown action type: ${action.type}`);
  }
}
