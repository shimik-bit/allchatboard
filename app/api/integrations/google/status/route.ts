// GET /api/integrations/google/status
//
// Returns the current user's Google connection for their active workspace,
// without exposing any encrypted token material.
//
// Response shape:
//   { connected: false }
//   { connected: true, email: "...", pictureUrl: "...", connectedAt: "...",
//     expiresAt: "...", scopes: [...] }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    return NextResponse.json({ connected: false });
  }

  const { data } = await supabase
    .from('google_oauth_connections')
    .select(`
      google_email,
      google_picture_url,
      connected_at,
      token_expires_at,
      granted_scopes,
      last_used_at,
      disconnected_at
    `)
    .eq('workspace_id', ws.wsId)
    .eq('user_id', user.id)
    .is('disconnected_at', null)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: data.google_email,
    pictureUrl: data.google_picture_url,
    connectedAt: data.connected_at,
    expiresAt: data.token_expires_at,
    scopes: data.granted_scopes,
    lastUsedAt: data.last_used_at,
  });
}
