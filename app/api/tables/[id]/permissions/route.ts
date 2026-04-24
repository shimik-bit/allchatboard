import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/tables/[id]/permissions
 *   Returns the table's access_mode and the per-member permission overrides.
 *   Owners/admins see everyone; others see only what affects them.
 *
 * POST /api/tables/[id]/permissions
 *   Body: {
 *     access_mode?: 'open' | 'view_only' | 'restricted',
 *     members?: Array<{ member_id: string; permission: 'view' | 'edit' | 'none' }>
 *   }
 *   Replaces all per-member overrides with the provided list.
 *   Send empty array to clear overrides. Owners/admins only.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Get the table (RLS will reject if user can't see it)
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('id, name, access_mode, workspace_id')
    .eq('id', params.id)
    .single();

  if (tableErr || !table) {
    return NextResponse.json({ error: 'table not found' }, { status: 404 });
  }

  // Get permission overrides
  const { data: perms } = await supabase
    .from('table_member_permissions')
    .select('id, member_id, permission, created_at')
    .eq('table_id', params.id);

  // Get all workspace members so the UI can show who's missing from the list
  const { data: members } = await supabase
    .from('workspace_members')
    .select('id, user_id, display_name, role, whatsapp_phone')
    .eq('workspace_id', table.workspace_id);

  return NextResponse.json({
    table: { id: table.id, name: table.name, access_mode: table.access_mode },
    permissions: perms || [],
    members: members || [],
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { access_mode, members } = body as {
    access_mode?: 'open' | 'view_only' | 'restricted';
    members?: Array<{ member_id: string; permission: 'view' | 'edit' | 'none' }>;
  };

  // Verify user is owner/admin of the workspace owning this table
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('id, workspace_id')
    .eq('id', params.id)
    .single();

  if (tableErr || !table) {
    return NextResponse.json({ error: 'table not found' }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', table.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'forbidden - only workspace owner/admin can change permissions' },
      { status: 403 }
    );
  }

  // Update access_mode if provided
  if (access_mode) {
    if (!['open', 'view_only', 'restricted'].includes(access_mode)) {
      return NextResponse.json({ error: 'invalid access_mode' }, { status: 400 });
    }
    const { error: updErr } = await supabase
      .from('tables')
      .update({ access_mode })
      .eq('id', params.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  // Replace member overrides if provided
  if (Array.isArray(members)) {
    // Validate all entries
    for (const m of members) {
      if (!m.member_id || !['view', 'edit', 'none'].includes(m.permission)) {
        return NextResponse.json(
          { error: 'invalid member permission entry' },
          { status: 400 }
        );
      }
    }

    // Delete all existing overrides for this table
    await supabase
      .from('table_member_permissions')
      .delete()
      .eq('table_id', params.id);

    // Insert new ones (skip empty array - already cleared)
    if (members.length > 0) {
      const rows = members.map((m) => ({
        table_id: params.id,
        member_id: m.member_id,
        permission: m.permission,
        created_by: user.id,
      }));
      const { error: insErr } = await supabase
        .from('table_member_permissions')
        .insert(rows);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
