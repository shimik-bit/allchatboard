import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groups?workspace_id=xxx
 *   List all WhatsApp groups in a workspace.
 *
 * POST /api/groups
 *   Body: { id, target_table_id?, target_workspace_id?, default_assignee_phone_id?, is_active?, auto_create_record?, auto_reply_enabled?, notes?, classification_hint? }
 *   Update a group's routing config (id is required, all other fields are optional patches).
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

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Load groups
  const { data: groups, error } = await supabase
    .from('whatsapp_groups')
    .select('id, green_api_chat_id, group_name, is_active, classification_hint, target_table_id, target_workspace_id, default_assignee_phone_id, auto_create_record, auto_reply_enabled, notes, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Load tables for the dropdown
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name, icon, color')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  // Load authorized phones for assignee dropdown
  const { data: phones } = await supabase
    .from('authorized_phones')
    .select('id, display_name, job_title, phone_number')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  return NextResponse.json({ groups: groups || [], tables: tables || [], phones: phones || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    id,
    target_table_id,
    target_workspace_id,
    default_assignee_phone_id,
    is_active,
    auto_create_record,
    auto_reply_enabled,
    notes,
    classification_hint,
  } = body;

  if (!id) {
    return NextResponse.json({ error: 'group id required' }, { status: 400 });
  }

  // Verify the group exists and the user is admin/owner of its workspace
  const { data: group } = await supabase
    .from('whatsapp_groups')
    .select('id, workspace_id')
    .eq('id', id)
    .single();

  if (!group) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', group.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'forbidden - admin/owner only' }, { status: 403 });
  }

  // Build patch
  const patch: any = {};
  if (target_table_id !== undefined) patch.target_table_id = target_table_id || null;
  if (target_workspace_id !== undefined) patch.target_workspace_id = target_workspace_id || null;
  if (default_assignee_phone_id !== undefined) patch.default_assignee_phone_id = default_assignee_phone_id || null;
  if (is_active !== undefined) patch.is_active = !!is_active;
  if (auto_create_record !== undefined) patch.auto_create_record = !!auto_create_record;
  if (auto_reply_enabled !== undefined) patch.auto_reply_enabled = !!auto_reply_enabled;
  if (notes !== undefined) patch.notes = notes || null;
  if (classification_hint !== undefined) patch.classification_hint = classification_hint || null;

  const { data: updated, error } = await supabase
    .from('whatsapp_groups')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: updated });
}
