import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/prefixes?workspace_id=xxx
 * POST /api/groupguard/prefixes
 *   Body: { workspace_id, prefix, country_name?, action? ('warn'|'delete'|'kick') }
 * DELETE /api/groupguard/prefixes?id=xxx
 * PATCH /api/groupguard/prefixes
 *   Body: { id, is_active?, action? }
 */

async function requireAdmin(req: NextRequest, workspaceId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized', status: 401, supabase: null, user: null };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return { error: 'forbidden', status: 403, supabase: null, user: null };
  }

  return { error: null, status: 200, supabase, user };
}


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

  const { data: rules, error } = await supabase
    .from('gg_phone_prefix_rules')
    .select('id, prefix, country_name, action, is_active, created_at')
    .eq('workspace_id', workspaceId)
    .order('prefix');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rules: rules || [],
    canEdit: membership.role === 'owner' || membership.role === 'admin',
  });
}


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.workspace_id || !body?.prefix) {
    return NextResponse.json({ error: 'workspace_id and prefix required' }, { status: 400 });
  }

  const auth = await requireAdmin(req, body.workspace_id);
  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Validate prefix - digits only, 1-4 chars
  const prefix = String(body.prefix).replace(/\D/g, '');
  if (prefix.length < 1 || prefix.length > 4) {
    return NextResponse.json({ error: 'prefix must be 1-4 digits' }, { status: 400 });
  }

  const action = ['warn', 'delete', 'kick'].includes(body.action) ? body.action : 'kick';

  const { data, error } = await auth.supabase
    .from('gg_phone_prefix_rules')
    .insert({
      workspace_id: body.workspace_id,
      prefix,
      country_name: body.country_name || null,
      action,
      is_active: true,
      created_by: auth.user!.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'prefix already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}


export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Get the rule's workspace
  const { data: rule } = await supabase
    .from('gg_phone_prefix_rules')
    .select('workspace_id')
    .eq('id', body.id)
    .single();
  if (!rule) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const auth = await requireAdmin(req, rule.workspace_id);
  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (['warn', 'delete', 'kick'].includes(body.action)) patch.action = body.action;
  if (typeof body.country_name === 'string') patch.country_name = body.country_name;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('gg_phone_prefix_rules')
    .update(patch)
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}


export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: rule } = await supabase
    .from('gg_phone_prefix_rules')
    .select('workspace_id')
    .eq('id', id)
    .single();
  if (!rule) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const auth = await requireAdmin(req, rule.workspace_id);
  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await auth.supabase
    .from('gg_phone_prefix_rules')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
