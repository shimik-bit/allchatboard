/**
 * Agency client management API
 *
 * POST   /api/agency/clients       - link a client workspace to the current agency
 * DELETE /api/agency/clients/{id}  - unlink (the [id] route is a separate file)
 *
 * The "current agency" is whichever workspace the cookie says is active,
 * verified to be type='agency'. Only owners/admins of the agency can link/unlink.
 *
 * Two ways to add a client:
 *   1. By client_workspace_id (UUID) - if you already know it
 *   2. By client_workspace_code (e.g. "JOE") - friendlier for the UI
 *
 * The client workspace must exist AND be of type='client' OR 'standalone'.
 * (You can't link an agency-type workspace as a client; doesn't make sense.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_WS_COOKIE = 'tf_active_workspace';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const agencyWsId = cookies().get(ACTIVE_WS_COOKIE)?.value;
  if (!agencyWsId) {
    return NextResponse.json({ error: 'no active workspace' }, { status: 400 });
  }

  // Verify the active workspace is an agency and the user has permission
  const { data: agency } = await supabase
    .from('workspaces')
    .select('id, type')
    .eq('id', agencyWsId)
    .single();

  if (!agency || (agency as any).type !== 'agency') {
    return NextResponse.json(
      { error: 'current workspace is not an agency' },
      { status: 400 }
    );
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', agencyWsId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'only owners and admins can manage clients' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    client_workspace_id,
    client_workspace_code,
    nickname,
    can_view = true,
    can_edit = true,
    can_manage_members = false,
    can_view_finances = true,
  } = body;

  // Resolve the target workspace from id or code
  let targetWsId: string | null = null;
  if (client_workspace_id) {
    targetWsId = client_workspace_id;
  } else if (client_workspace_code) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id, type')
      .eq('workspace_code', String(client_workspace_code).toUpperCase())
      .single();
    if (!ws) {
      return NextResponse.json(
        { error: 'workspace not found by that code' },
        { status: 404 }
      );
    }
    targetWsId = ws.id;
  }

  if (!targetWsId) {
    return NextResponse.json(
      { error: 'either client_workspace_id or client_workspace_code is required' },
      { status: 400 }
    );
  }

  // Validate target workspace type — can't link an agency as a client
  const { data: targetWs } = await supabase
    .from('workspaces')
    .select('id, type, name')
    .eq('id', targetWsId)
    .single();

  if (!targetWs) {
    return NextResponse.json(
      { error: 'target workspace not found' },
      { status: 404 }
    );
  }
  if ((targetWs as any).type === 'agency') {
    return NextResponse.json(
      { error: 'cannot link an agency workspace as a client' },
      { status: 400 }
    );
  }

  // Insert the link. The DB will reject duplicates via the unique constraint
  // (one_agency_per_client), so we surface that as a friendly error.
  const { data: link, error } = await supabase
    .from('agency_clients')
    .insert({
      agency_workspace_id: agencyWsId,
      client_workspace_id: targetWsId,
      nickname: nickname?.trim() || null,
      can_view,
      can_edit,
      can_manage_members,
      can_view_finances,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'this workspace is already managed by an agency' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark the client workspace as type='client' if it was standalone.
  // We use upsert-style logic: only change type if it's currently standalone.
  // If the workspace was already 'client' (under a different agency...
  // wait, the unique constraint prevents that scenario. So 'client' here
  // would mean stale data, which we leave alone.)
  if ((targetWs as any).type === 'standalone') {
    await supabase
      .from('workspaces')
      .update({ type: 'client' })
      .eq('id', targetWsId);
  }

  return NextResponse.json({ ok: true, link });
}
