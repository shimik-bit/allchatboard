import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/api/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/api-keys?workspace_id=xxx
 *   List all API keys for a workspace (admin only).
 *
 * POST /api/api-keys
 *   Body: { workspace_id, name, can_read, can_create, can_update, can_delete, table_ids?, expires_at?, notes? }
 *   Create a new API key. RETURNS THE PLAIN TOKEN ONCE - never shown again.
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

  // Verify admin/owner
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, can_read, can_create, can_update, can_delete, table_ids, created_at, expires_at, revoked_at, last_used_at, request_count, notes')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also fetch tables for the UI
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name, icon')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  return NextResponse.json({ keys: keys || [], tables: tables || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    workspace_id, name,
    can_read = true, can_create = true, can_update = false, can_delete = false,
    table_ids, expires_at, notes,
  } = body;

  if (!workspace_id || !name?.trim()) {
    return NextResponse.json({ error: 'workspace_id and name are required' }, { status: 400 });
  }

  // Verify admin/owner
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'forbidden - admin/owner only' }, { status: 403 });
  }

  // Generate token
  const { plain, hash, prefix } = generateApiKey();

  const { data: key, error } = await supabase
    .from('api_keys')
    .insert({
      workspace_id,
      name: name.trim(),
      prefix,
      token_hash: hash,
      can_read: !!can_read,
      can_create: !!can_create,
      can_update: !!can_update,
      can_delete: !!can_delete,
      table_ids: Array.isArray(table_ids) && table_ids.length > 0 ? table_ids : null,
      expires_at: expires_at || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select('id, name, prefix, can_read, can_create, can_update, can_delete, table_ids, created_at, expires_at, notes')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the plain token ONLY this once
  return NextResponse.json({
    key,
    plain_token: plain,
    warning: 'Save this token now - it will not be shown again',
  }, { status: 201 });
}
