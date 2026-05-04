import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET    /api/whatsapp/broadcasts/[id]  → job + targets (for status pages)
 * DELETE /api/whatsapp/broadcasts/[id]  → cancel a pending or running job
 *
 * Cancellation semantics:
 *   - Pending jobs are flipped to 'cancelled' immediately
 *   - Running jobs are also flipped to 'cancelled'; the dispatcher will see
 *     the new status on its next iteration and stop processing more targets.
 *     Already-sent messages stay sent (we can't unsend); the user can create
 *     a delete job from the resulting broadcast row to clean those up.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: job, error } = await supabase
    .from('broadcast_jobs')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !job) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { data: targets } = await supabase
    .from('broadcast_targets')
    .select(
      'id, group_id, position, status, green_message_id, error, sent_at, whatsapp_groups(group_name)'
    )
    .eq('job_id', params.id)
    .order('position', { ascending: true });

  return NextResponse.json({ job, targets: targets || [] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Auth handled by RLS update policy (admin/owner only)
  const { data: updated, error } = await supabase
    .from('broadcast_jobs')
    .update({
      status: 'cancelled',
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .in('status', ['pending', 'running']) // can't cancel done/failed
    .select('id, status')
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || 'cannot cancel — job already finished or not found' },
      { status: 400 }
    );
  }
  return NextResponse.json({ cancelled: true, job: updated });
}
