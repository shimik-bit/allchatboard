import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/knowledge/bot?workspace_id=xxx
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

  // Get or create bot
  const { data: bot, error: botError } = await service
    .rpc('get_or_create_knowledge_bot', { p_workspace_id: workspaceId });

  if (botError) return NextResponse.json({ error: botError.message }, { status: 500 });

  // Get stats
  const { data: stats } = await service
    .rpc('get_knowledge_bot_stats', { p_workspace_id: workspaceId });

  // Get instances for dedicated mode dropdown
  const { data: instances } = await service
    .from('whatsapp_instances')
    .select('id, provider_instance_id, state, is_primary')
    .eq('workspace_id', workspaceId)
    .eq('state', 'authorized');

  return NextResponse.json({ bot, stats, instances: instances || [] });
}

// PATCH /api/knowledge/bot
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, ...updates } = body;
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Allowed fields
  const allowedFields = [
    'is_enabled', 'bot_name', 'bot_persona', 'greeting_message', 'fallback_message',
    'routing_mode', 'dedicated_instance_id', 'ai_provider', 'ai_model',
    'ai_temperature', 'ai_max_tokens', 'collect_lead_after_n_questions', 'human_handoff_keywords'
  ];
  const cleanUpdates: any = {};
  for (const k of allowedFields) {
    if (k in updates) cleanUpdates[k] = updates[k];
  }

  const { data, error } = await service
    .from('knowledge_bots')
    .update(cleanUpdates)
    .eq('workspace_id', workspace_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bot: data });
}
