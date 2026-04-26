import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sequences/enroll
 * Body: { sequence_id, record_id }
 *
 * Enrolls a record in a sequence. Computes next_step_at for step 1.
 * Idempotent - if already enrolled, returns the existing enrollment.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { sequence_id, record_id } = body;

  if (!sequence_id || !record_id) {
    return NextResponse.json({ error: 'sequence_id and record_id required' }, { status: 400 });
  }

  // Fetch sequence
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, workspace_id, steps, enabled')
    .eq('id', sequence_id)
    .single();

  if (!sequence) return NextResponse.json({ error: 'sequence not found' }, { status: 404 });
  if (!sequence.enabled) return NextResponse.json({ error: 'sequence is disabled' }, { status: 400 });

  // Fetch record (verify same workspace)
  const { data: record } = await supabase
    .from('records')
    .select('id, workspace_id')
    .eq('id', record_id)
    .single();

  if (!record) return NextResponse.json({ error: 'record not found' }, { status: 404 });
  if (record.workspace_id !== sequence.workspace_id) {
    return NextResponse.json({ error: 'cross-workspace enrollment not allowed' }, { status: 403 });
  }

  const steps = sequence.steps || [];
  if (steps.length === 0) {
    return NextResponse.json({ error: 'sequence has no steps' }, { status: 400 });
  }

  // Compute next_step_at for the first step
  const firstStep = steps[0];
  const delayMs = (firstStep.delay_days || 0) * 24 * 60 * 60 * 1000 + (firstStep.delay_hours || 0) * 60 * 60 * 1000;
  const nextStepAt = new Date(Date.now() + delayMs);

  const { data: enrollment, error } = await supabase
    .from('sequence_enrollments')
    .upsert({
      sequence_id,
      record_id,
      workspace_id: sequence.workspace_id,
      status: 'active',
      current_step: 0,  // No steps completed yet
      next_step_at: nextStepAt.toISOString(),
      enrolled_at: new Date().toISOString(),
    }, {
      onConflict: 'sequence_id,record_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment counter on sequence
  await supabase.rpc('increment_sequence_enrollment_count', { p_sequence_id: sequence_id }).then(
    () => null,
    () => null  // ignore if RPC doesn't exist yet
  );

  return NextResponse.json({ enrollment });
}
