// Helper that returns a usable access_token for a given workspace/user,
// transparently refreshing it if it's expired or about to expire.
//
// Usage:
//   const token = await getValidAccessToken(workspaceId, userId);
//   if (!token) { ... no connection / disconnected ... }
//   const sheets = google.sheets({ version: 'v4', auth: oauthClient });
//
// This is the only path that other code should use to talk to Google APIs
// — it centralises the encryption, refresh, and DB update logic.

import { createAdminClient } from '@/lib/supabase/server';
import {
  buildClientFromCredentials,
  decryptToken,
  encryptToken,
  refreshAccessToken,
} from './oauth';
import type { OAuth2Client } from 'google-auth-library';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Refresh if expiring in <5 min

export type ActiveConnection = {
  connectionId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  googleEmail: string;
};

/**
 * Look up a connection, refresh the access token if needed, and return it
 * along with the connection metadata. Returns null if there is no active
 * connection for this user in this workspace.
 *
 * Always uses the admin client (RLS-bypassing) because callers are usually
 * background jobs / API routes that have already verified authorization
 * via their own session check.
 */
export async function getActiveConnection(
  workspaceId: string,
  userId: string,
): Promise<ActiveConnection | null> {
  const admin = createAdminClient();

  const { data: conn, error } = await admin
    .from('google_oauth_connections')
    .select(`
      id,
      access_token_encrypted,
      refresh_token_encrypted,
      token_expires_at,
      google_email
    `)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .is('disconnected_at', null)
    .maybeSingle();

  if (error || !conn) return null;

  let accessToken = decryptToken(conn.access_token_encrypted);
  const refreshToken = conn.refresh_token_encrypted
    ? decryptToken(conn.refresh_token_encrypted)
    : null;
  let expiresAt = new Date(conn.token_expires_at);

  // Refresh if expired or about to expire
  const aboutToExpire = expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
  if (aboutToExpire) {
    if (!refreshToken) {
      // We can't refresh without a refresh_token. The user has to reconnect.
      // This shouldn't happen normally because the callback always stores
      // one, but if Google's response was odd or our DB was corrupted...
      console.warn(
        `[google] Access token expired but no refresh_token for connection ${conn.id}. Returning null.`,
      );
      return null;
    }
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;

      // Persist the new token + bump last_refreshed_at
      await admin
        .from('google_oauth_connections')
        .update({
          access_token_encrypted: encryptToken(accessToken),
          token_expires_at: expiresAt.toISOString(),
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', conn.id);
    } catch (err) {
      // Refresh failure usually means the user revoked access at Google.
      // Mark the connection as disconnected so the UI prompts re-auth.
      console.error(`[google] Refresh failed for connection ${conn.id}:`, err);
      await admin
        .from('google_oauth_connections')
        .update({ disconnected_at: new Date().toISOString() })
        .eq('id', conn.id);
      // Also disable dependent sync configs (mirrors disconnect endpoint)
      await admin
        .from('google_sheet_sync_configs')
        .update({ is_enabled: false })
        .eq('connection_id', conn.id);
      return null;
    }
  }

  // Touch last_used_at so the user sees activity in the UI
  await admin
    .from('google_oauth_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', conn.id);

  return {
    connectionId: conn.id,
    accessToken,
    refreshToken,
    expiresAt,
    googleEmail: conn.google_email,
  };
}

/**
 * Convenience: get a connection AND build a ready-to-use OAuth2Client.
 * Most callers want this.
 */
export async function getAuthedGoogleClient(
  workspaceId: string,
  userId: string,
): Promise<{ client: OAuth2Client; connection: ActiveConnection } | null> {
  const connection = await getActiveConnection(workspaceId, userId);
  if (!connection) return null;

  const client = buildClientFromCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken ?? undefined,
    expiry_date: connection.expiresAt.getTime(),
  });

  return { client, connection };
}
