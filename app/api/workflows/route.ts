import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows?workspace_id=xxx  - list
 * POST /api/workflows                  - create
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get recent runs (last 30)
  const { data: runs } = await supabase
    .from('workflow_runs')
    .select('id, workflow_id, ran_at, success, error_message, duration_ms')
    .eq('workspace_id', workspaceId)
    .order('ran_at', { ascending: false })
    .limit(30);

  return NextResponse.json({
    workflows: data || [],
    recent_runs: runs || [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, name, description, trigger_type, trigger_config, actions, enabled } = body;

  if (!workspace_id || !name?.trim() || !trigger_type) {
    return NextResponse.json({ error: 'workspace_id, name, trigger_type required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      workspace_id,
      name: name.trim(),
      description: description || null,
      trigger_type,
      trigger_config: trigger_config || {},
      actions: actions || [],
      enabled: enabled !== false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflow: data }, { status: 201 });
}
