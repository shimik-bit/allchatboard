// DELETE /api/integrations/google/sync-configs/[id]
//
// Removes a single sync config. Also deletes any queued events for that
// config (cascade via FK).

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Defence in depth: even though RLS would block cross-workspace deletes
  // via the regular client, we use admin client and re-verify ownership.
  const { data: existing } = await admin
    .from('google_sheet_sync_configs')
    .select('id, workspace_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!existing || existing.workspace_id !== ws.wsId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await admin
    .from('google_sheet_sync_configs')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json(
      { error: 'db_failed', details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
