import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/knowledge/sources?workspace_id=xxx
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: sources } = await service
    .from('knowledge_sources')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ sources: sources || [] });
}

// POST /api/knowledge/sources
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, source_type, title, content, question, answer, url, file_name, tags, category } = body;

  if (!workspace_id || !source_type || !title) {
    return NextResponse.json({ error: 'workspace_id, source_type, title required' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get bot id
  const { data: bot } = await service
    .from('knowledge_bots').select('id')
    .eq('workspace_id', workspace_id).maybeSingle();

  // Check sources limit
  const { count } = await service
    .from('knowledge_sources').select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id);
  
  const { data: limit } = await service
    .rpc('get_workspace_limit', { p_workspace_id: workspace_id, p_limit_key: 'knowledge_sources_max' });

  if (count !== null && limit !== null && count >= Number(limit)) {
    return NextResponse.json({
      error: `הגעת למגבלת המקורות (${limit}). שדרג את התוכנית להוספה נוספת.`
    }, { status: 403 });
  }

  const { data, error } = await service
    .from('knowledge_sources')
    .insert({
      workspace_id, bot_id: bot?.id, source_type, title,
      content, question, answer, url, file_name,
      tags: tags || [], category,
      created_by: user.id,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}
