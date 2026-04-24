import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/list?workspace_id=xxx
 * Returns all tables in a workspace that the user has access to view.
 * Used by the relation field picker.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // RLS will filter to only tables the user can view
  const { data: tables, error } = await supabase
    .from('tables')
    .select('id, name, icon, color, is_archived')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tables });
}
