import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/ai-usage?workspace_id=xxx
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Summary
  const { data: summary } = await service
    .from('workspace_ai_usage_summary')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  // Last 7 days breakdown by feature
  const { data: byFeature } = await service
    .from('ai_usage_log')
    .select('feature, cost_ils, charged_ils, tokens_input, tokens_output, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  // Daily breakdown (last 30 days)
  const { data: daily } = await service
    .rpc('get_ai_usage_daily', { p_workspace_id: workspaceId, p_days: 30 })
    .returns<any[]>();

  return NextResponse.json({
    summary,
    by_feature: byFeature || [],
    daily: daily || [],
  });
}
