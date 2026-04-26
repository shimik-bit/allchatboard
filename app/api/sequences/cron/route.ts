import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText } from '@/lib/reports/whatsapp';
import { renderTemplate } from '@/lib/automations/field-mapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/sequences/cron
 *
 * Triggered by Supabase pg_cron every 10 minutes.
 * Finds enrollments with next_step_at <= now() and processes the next step.
 *
 * Per enrollment:
 *   1. Fetch sequence + record
 *   2. Check exit conditions (status changed, replied, etc.) → exit if matched
 *   3. Render template with record data
 *   4. Send WhatsApp via Green API
 *   5. Compute next_step_at for the step after; or mark completed
 */
export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-cron-secret'}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find due enrollments
  const { data: dueEnrollments, error } = await admin
    .from('sequence_enrollments')
    .select(`
      id, sequence_id, record_id, workspace_id,
      current_step, steps_completed, enrolled_at,
      sequences (id, name, steps, exit_on_reply, exit_on_status_change, exit_on_unsubscribe, enabled),
      records (id, table_id, data),
      workspaces (whatsapp_instance_id, whatsapp_token)
    `)
    .eq('status', 'active')
    .not('next_step_at', 'is', null)
    .lte('next_step_at', new Date().toISOString())
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueEnrollments || dueEnrollments.length === 0) {
    return NextResponse.json({ ok: true, due: 0 });
  }

  const results: any[] = [];

  for (const enr of dueEnrollments) {
    const result = await processEnrollment(admin, enr);
    results.push(result);
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

async function processEnrollment(admin: any, enr: any) {
  const sequence = enr.sequences;
  const record = enr.records;
  const ws = enr.workspaces;

  // Validate
  if (!sequence || !sequence.enabled) {
    await admin.from('sequence_enrollments').update({
      status: 'exited',
      exit_reason: 'sequence_disabled',
      completed_at: new Date().toISOString(),
    }).eq('id', enr.id);
    return { id: enr.id, action: 'sequence_disabled' };
  }

  if (!record) {
    await admin.from('sequence_enrollments').update({
      status: 'exited',
      exit_reason: 'record_deleted',
      completed_at: new Date().toISOString(),
    }).eq('id', enr.id);
    return { id: enr.id, action: 'record_deleted' };
  }

  const steps = sequence.steps || [];
  const stepIndex = enr.current_step;  // 0-indexed - which step to send NOW

  if (stepIndex >= steps.length) {
    // All steps done
    await admin.from('sequence_enrollments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      next_step_at: null,
    }).eq('id', enr.id);
    return { id: enr.id, action: 'completed' };
  }

  // Check exit conditions on the record's current state
  const exitReason = checkExitConditions(record, sequence);
  if (exitReason) {
    await admin.from('sequence_enrollments').update({
      status: 'exited',
      exit_reason: exitReason,
      completed_at: new Date().toISOString(),
      next_step_at: null,
    }).eq('id', enr.id);
    return { id: enr.id, action: 'exited', reason: exitReason };
  }

  const step = steps[stepIndex];

  // Check per-step condition
  if (step.condition && !evaluateCondition(record.data || {}, step.condition)) {
    // Skip this step, advance to next
    return advanceEnrollment(admin, enr, stepIndex, steps, { skipped: true });
  }

  // Send the message
  if (!ws?.whatsapp_instance_id || !ws?.whatsapp_token) {
    await admin.from('sequence_enrollments').update({
      status: 'failed',
      exit_reason: 'no_whatsapp_configured',
      completed_at: new Date().toISOString(),
    }).eq('id', enr.id);
    return { id: enr.id, action: 'failed', reason: 'no_whatsapp' };
  }

  const phoneFieldSlug = step.phone_field || 'phone';
  const phone = record.data?.[phoneFieldSlug];

  if (!phone) {
    // Skip step if no phone available
    return advanceEnrollment(admin, enr, stepIndex, steps, { skipped: true, reason: 'no_phone' });
  }

  const message = renderTemplate(step.message_template || '', record.data || {});

  let sent = false;
  let messageId: string | undefined;
  try {
    const result = await sendWhatsAppText(ws.whatsapp_instance_id, ws.whatsapp_token, phone, message);
    sent = result.ok;
    if (result.ok) messageId = result.message_id;
  } catch (e: any) {
    sent = false;
  }

  // Advance to next step
  return advanceEnrollment(admin, enr, stepIndex, steps, {
    skipped: false,
    sent,
    messageId,
    sentTo: phone,
  });
}

async function advanceEnrollment(
  admin: any,
  enr: any,
  currentStepIndex: number,
  steps: any[],
  outcome: { skipped: boolean; sent?: boolean; messageId?: string; sentTo?: string; reason?: string }
) {
  const newStepIndex = currentStepIndex + 1;
  const stepsCompleted = [
    ...(enr.steps_completed || []),
    {
      step: currentStepIndex + 1,  // 1-indexed for humans
      sent_at: new Date().toISOString(),
      success: outcome.sent ?? !outcome.skipped,
      skipped: outcome.skipped,
      reason: outcome.reason,
      message_id: outcome.messageId,
      sent_to: outcome.sentTo,
    },
  ];

  if (newStepIndex >= steps.length) {
    // Last step - mark completed
    await admin.from('sequence_enrollments').update({
      current_step: newStepIndex,
      steps_completed: stepsCompleted,
      status: 'completed',
      completed_at: new Date().toISOString(),
      next_step_at: null,
    }).eq('id', enr.id);
    return { id: enr.id, action: 'sent_and_completed', step: currentStepIndex + 1 };
  }

  // Compute next_step_at based on next step's delay
  const nextStep = steps[newStepIndex];
  const delayMs = (nextStep.delay_days || 0) * 24 * 60 * 60 * 1000 + (nextStep.delay_hours || 0) * 60 * 60 * 1000;
  const nextStepAt = new Date(Date.now() + delayMs);

  await admin.from('sequence_enrollments').update({
    current_step: newStepIndex,
    steps_completed: stepsCompleted,
    next_step_at: nextStepAt.toISOString(),
  }).eq('id', enr.id);

  return { id: enr.id, action: 'sent', step: currentStepIndex + 1, next_at: nextStepAt };
}

function checkExitConditions(record: any, sequence: any): string | null {
  const data = record.data || {};

  // Status change exit
  if (sequence.exit_on_status_change && Array.isArray(sequence.exit_on_status_change)) {
    const currentStatus = data.status;
    if (currentStatus && sequence.exit_on_status_change.includes(currentStatus)) {
      return 'status_changed';
    }
  }

  // Unsubscribe exit
  if (sequence.exit_on_unsubscribe && data._unsubscribed) {
    return 'unsubscribed';
  }

  // Reply exit - we'd need to check if the record had a recent inbound message
  // This requires querying wa_messages; for MVP we use a flag set by the webhook
  if (sequence.exit_on_reply && data._replied_after_enrollment) {
    return 'replied';
  }

  return null;
}

function evaluateCondition(data: Record<string, any>, condition: any): boolean {
  if (!condition || !condition.field) return true;
  const value = data[condition.field];
  switch (condition.operator) {
    case '==': return value === condition.value;
    case '!=': return value !== condition.value;
    case 'is_empty': return value === undefined || value === null || value === '';
    case 'is_not_empty': return value !== undefined && value !== null && value !== '';
    case 'contains': return String(value || '').includes(String(condition.value || ''));
    default: return true;
  }
}
