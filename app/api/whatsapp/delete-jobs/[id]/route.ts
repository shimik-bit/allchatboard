import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET    /api/whatsapp/delete-jobs/[id]  → job + targets
 * DELETE /api/whatsapp/delete-jobs/[id]  → cancel pending/running
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: job } = await supabase.from('delete_jobs').select('*').eq('id', params.id).single();
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: targets } = await supabase
    .from('delete_targets')
    .select('id, group_id, green_message_id, position, status, error, deleted_at, whatsapp_groups(group_name)')
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
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: updated, error } = await supabase
    .from('delete_jobs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', params.id)
    .in('status', ['pending', 'running'])
    .select('id, status')
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || 'cannot cancel — job already finished' },
      { status: 400 }
    );
  }
  return NextResponse.json({ cancelled: true, job: updated });
}
