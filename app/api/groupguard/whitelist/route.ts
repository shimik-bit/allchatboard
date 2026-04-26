import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/whitelist?workspace_id=xxx
 * POST /api/groupguard/whitelist
 *   Body: { workspace_id, phone, display_name?, reason?, group_id? (null=all groups) }
 * DELETE /api/groupguard/whitelist?id=xxx
 */

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: entries, error } = await supabase
    .from('gg_whitelist')
    .select('id, phone, display_name, reason, group_id, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    entries: entries || [],
    canEdit: membership.role === 'owner' || membership.role === 'admin',
  });
}


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.workspace_id || !body?.phone) {
    return NextResponse.json({ error: 'workspace_id and phone required' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', body.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Normalize phone - digits only, no @c.us
  const phone = String(body.phone).replace(/\D/g, '');
  if (phone.length < 7) {
    return NextResponse.json({ error: 'invalid phone' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('gg_whitelist')
    .insert({
      workspace_id: body.workspace_id,
      phone,
      display_name: body.display_name || null,
      reason: body.reason || null,
      group_id: body.group_id || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'phone already in whitelist' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}


export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Get workspace_id from the entry
  const { data: entry } = await supabase
    .from('gg_whitelist')
    .select('workspace_id')
    .eq('id', id)
    .single();
  if (!entry) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', entry.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('gg_whitelist').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
