import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/api-keys/logs?workspace_id=xxx&key_id=xxx&limit=50
 * Returns recent API request logs for monitoring.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const keyId = searchParams.get('key_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  let query = supabase
    .from('api_request_logs')
    .select('id, api_key_id, method, path, status_code, duration_ms, ip_address, error_message, created_at, api_keys(name, prefix)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (keyId) {
    query = query.eq('api_key_id', keyId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data || [] });
}
