import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/groups?workspace_id=xxx
 *   List all groups (with their gg_* settings) in a workspace.
 *
 * PATCH /api/groupguard/groups
 *   Body: { id, gg_enabled?, gg_detections?, gg_manual_tag_threshold?, gg_ai_sensitivity? }
 *   Update GroupGuard settings on a single group.
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

  // Load groups with GG settings + recent stats
  const { data: groups, error } = await supabase
    .from('whatsapp_groups')
    .select(`
      id,
      green_api_chat_id,
      group_name,
      is_active,
      gg_enabled,
      gg_is_admin,
      gg_detections,
      gg_manual_tag_threshold,
      gg_ai_sensitivity,
      gg_participants_count,
      gg_enabled_at,
      gg_notify_admins,
      gg_admin_phones,
      gg_notify_message
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Per-group stats - last 7 days actions count
  const groupIds = (groups || []).map((g) => g.id);
  let stats: Record<string, { kicks: number; deletes: number; reports: number }> = {};

  if (groupIds.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: actions } = await supabase
      .from('gg_actions_log')
      .select('group_id, action_type')
      .in('group_id', groupIds)
      .gte('created_at', sevenDaysAgo)
      .eq('was_successful', true);

    for (const id of groupIds) {
      stats[id] = { kicks: 0, deletes: 0, reports: 0 };
    }
    for (const a of actions || []) {
      if (!stats[a.group_id]) continue;
      if (a.action_type === 'kick') stats[a.group_id].kicks++;
      else if (a.action_type === 'delete_message') stats[a.group_id].deletes++;
      else if (a.action_type === 'warn') stats[a.group_id].reports++;
    }
  }

  return NextResponse.json({
    groups: groups || [],
    stats,
    canEdit: membership.role === 'owner' || membership.role === 'admin',
  });
}


export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  // Look up workspace and verify admin/owner role
  const { data: group } = await supabase
    .from('whatsapp_groups')
    .select('workspace_id')
    .eq('id', body.id)
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
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Build update patch (only allowed fields)
  const patch: Record<string, unknown> = {};
  if (typeof body.gg_enabled === 'boolean') {
    patch.gg_enabled = body.gg_enabled;
    if (body.gg_enabled) patch.gg_enabled_at = new Date().toISOString();
  }
  if (typeof body.gg_is_admin === 'boolean') {
    patch.gg_is_admin = body.gg_is_admin;
  }
  if (body.gg_detections && typeof body.gg_detections === 'object') {
    patch.gg_detections = body.gg_detections;
  }
  if (typeof body.gg_manual_tag_threshold === 'number' && body.gg_manual_tag_threshold >= 1) {
    patch.gg_manual_tag_threshold = Math.min(20, Math.floor(body.gg_manual_tag_threshold));
  }
  if (['low', 'medium', 'high'].includes(body.gg_ai_sensitivity)) {
    patch.gg_ai_sensitivity = body.gg_ai_sensitivity;
  }
  if (typeof body.gg_notify_admins === 'boolean') {
    patch.gg_notify_admins = body.gg_notify_admins;
  }
  if (Array.isArray(body.gg_admin_phones)) {
    // Sanitize: only digits, max 20 phones, each up to 20 chars
    const phones = body.gg_admin_phones
      .filter((p: unknown): p is string => typeof p === 'string')
      .map((p: string) => p.replace(/\D/g, '').substring(0, 20))
      .filter((p: string) => p.length >= 8)
      .slice(0, 20);
    patch.gg_admin_phones = phones;
  }
  if (typeof body.gg_notify_message === 'string' || body.gg_notify_message === null) {
    const msg = typeof body.gg_notify_message === 'string'
      ? body.gg_notify_message.trim().substring(0, 1000)
      : null;
    patch.gg_notify_message = msg && msg.length > 0 ? msg : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('whatsapp_groups')
    .update(patch)
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
