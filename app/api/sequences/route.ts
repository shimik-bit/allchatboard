import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sequences?workspace_id=xxx  - list
 * POST /api/sequences                  - create
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('sequences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Include active enrollment counts
  const { data: counts } = await supabase
    .from('sequence_enrollments')
    .select('sequence_id, status')
    .eq('workspace_id', workspaceId);

  const activeCountBySequence: Record<string, number> = {};
  for (const e of counts || []) {
    if (e.status === 'active') {
      activeCountBySequence[e.sequence_id] = (activeCountBySequence[e.sequence_id] || 0) + 1;
    }
  }

  return NextResponse.json({
    sequences: (data || []).map((s: any) => ({
      ...s,
      active_enrollments: activeCountBySequence[s.id] || 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, name, description, steps, exit_on_reply, exit_on_status_change, exit_on_unsubscribe, enabled } = body;

  if (!workspace_id || !name?.trim()) {
    return NextResponse.json({ error: 'workspace_id and name required' }, { status: 400 });
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: 'at least one step required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sequences')
    .insert({
      workspace_id,
      name: name.trim(),
      description: description || null,
      steps,
      exit_on_reply: exit_on_reply !== false,
      exit_on_status_change: exit_on_status_change || [],
      exit_on_unsubscribe: exit_on_unsubscribe !== false,
      enabled: enabled !== false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sequence: data }, { status: 201 });
}
