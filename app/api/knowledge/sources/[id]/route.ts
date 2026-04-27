import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/knowledge/sources/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const sourceId = params.id;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: source } = await service
    .from('knowledge_sources').select('workspace_id').eq('id', sourceId).maybeSingle();
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', source.workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allowed = ['title', 'content', 'question', 'answer', 'url', 'tags', 'category', 'is_active'];
  const updates: any = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const { data, error } = await service
    .from('knowledge_sources').update(updates).eq('id', sourceId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

// DELETE /api/knowledge/sources/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sourceId = params.id;
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: source } = await service
    .from('knowledge_sources').select('workspace_id').eq('id', sourceId).maybeSingle();
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', source.workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await service.from('knowledge_sources').delete().eq('id', sourceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
