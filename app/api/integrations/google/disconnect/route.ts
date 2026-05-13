// POST /api/integrations/google/disconnect
//
// Revokes the user's Google integration for the current workspace.
//
// What we do:
//   1. Look up the connection row
//   2. Try to revoke the token at Google's end (best-effort; if it fails
//      we still proceed because the user wants out)
//   3. Mark the row as disconnected_at = now() (soft delete — keeps audit)
//   4. Disable all sync configs that depend on this connection
//      so the queue worker stops trying to push to dead destinations

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { decryptToken } from '@/lib/google/oauth';

export async function POST() {
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

  // ---- 1. Find the connection ----
  const { data: conn } = await admin
    .from('google_oauth_connections')
    .select('id, refresh_token_encrypted, access_token_encrypted')
    .eq('workspace_id', ws.wsId)
    .eq('user_id', user.id)
    .is('disconnected_at', null)
    .maybeSingle();

  if (!conn) {
    // Already disconnected or never connected — idempotent success
    return NextResponse.json({ ok: true, alreadyDisconnected: true });
  }

  // ---- 2. Best-effort revoke at Google ----
  try {
    const tokenToRevoke = conn.refresh_token_encrypted
      ? decryptToken(conn.refresh_token_encrypted)
      : decryptToken(conn.access_token_encrypted);

    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // We don't check the response — even a 400 ("token already invalid")
    // is fine for our purposes.
  } catch (err) {
    console.warn('[google/disconnect] Token revoke failed (continuing):', err);
  }

  // ---- 3. Soft-delete the connection ----
  const { error: updateErr } = await admin
    .from('google_oauth_connections')
    .update({ disconnected_at: new Date().toISOString() })
    .eq('id', conn.id);

  if (updateErr) {
    return NextResponse.json(
      { error: 'db_failed', details: updateErr.message },
      { status: 500 },
    );
  }

  // ---- 4. Disable all sync configs that pointed to this connection ----
  // We don't delete them — the user may reconnect with the same Google
  // account and want their old sheet mappings back.
  await admin
    .from('google_sheet_sync_configs')
    .update({ is_enabled: false })
    .eq('connection_id', conn.id);

  return NextResponse.json({ ok: true });
}
