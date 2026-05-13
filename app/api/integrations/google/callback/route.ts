// GET /api/integrations/google/callback?code=...&state=...
//
// Google redirects the user back here after they consent (or decline). We:
//   1. Validate the user is still the one who initiated the flow
//   2. Exchange the code for tokens
//   3. Fetch the user's Google profile (email + picture)
//   4. Encrypt the tokens and upsert into google_oauth_connections
//   5. Redirect back to the settings page with a success flag
//
// Security:
//   * We DON'T trust `state` for auth — it only carries flow context. The
//     real authentication is the Supabase session cookie.
//   * We verify the userId in `state` matches the current session's user,
//     to prevent a user being redirected mid-flow to another user's session.
//   * Tokens are encrypted with TOKEN_ENCRYPTION_KEY before persistence.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  decodeState,
  encryptToken,
  exchangeCodeForTokens,
} from '@/lib/google/oauth';

function redirectWith(reqUrl: URL, path: string, params: Record<string, string>): NextResponse {
  const url = new URL(path, reqUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateRaw = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  // ---- 1. User declined / Google returned an error ----
  if (error) {
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: error,
    });
  }

  if (!code || !stateRaw) {
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: 'missing_params',
    });
  }

  // ---- 2. Decode + validate state ----
  let state;
  try {
    state = decodeState(stateRaw);
  } catch {
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: 'invalid_state',
    });
  }

  // Make sure the user finishing the flow is the same user who started it.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (user.id !== state.userId) {
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: 'user_mismatch',
    });
  }

  // Confirm the user is still a member of the workspace they started in
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', state.workspaceId)
    .not('accepted_at', 'is', null)
    .maybeSingle();

  if (!membership) {
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: 'no_workspace_access',
    });
  }

  // ---- 3. Exchange code for tokens ----
  let tokens, profile;
  try {
    const result = await exchangeCodeForTokens(code);
    tokens = result.tokens;
    profile = result.profile;
  } catch (err) {
    console.error('[google/callback] Token exchange failed:', err);
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: 'exchange_failed',
    });
  }

  // ---- 4. Store encrypted tokens ----
  // Use admin client to bypass RLS — we're acting on behalf of the user
  // but writing to a row keyed by their user_id. We've already verified
  // identity above.
  const admin = createAdminClient();

  const row = {
    user_id: user.id,
    workspace_id: state.workspaceId,
    google_email: profile.email,
    google_user_id: profile.googleUserId,
    google_picture_url: profile.pictureUrl ?? null,
    access_token_encrypted: encryptToken(tokens.accessToken),
    refresh_token_encrypted: tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null,
    token_expires_at: tokens.expiresAt.toISOString(),
    granted_scopes: tokens.grantedScopes,
    connected_at: new Date().toISOString(),
    disconnected_at: null, // clears soft-delete on reconnect
  };

  // If reconnecting and Google didn't issue a new refresh_token, we need
  // to keep the old one rather than null it out.
  if (!tokens.refreshToken) {
    const { data: existing } = await admin
      .from('google_oauth_connections')
      .select('refresh_token_encrypted')
      .eq('workspace_id', state.workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing?.refresh_token_encrypted) {
      row.refresh_token_encrypted = existing.refresh_token_encrypted;
    }
  }

  const { error: upsertErr } = await admin
    .from('google_oauth_connections')
    .upsert(row, { onConflict: 'workspace_id,user_id' });

  if (upsertErr) {
    console.error('[google/callback] DB upsert failed:', upsertErr);
    return redirectWith(req.nextUrl, '/dashboard/settings/integrations', {
      google: 'error',
      reason: 'db_failed',
    });
  }

  // ---- 5. Done — back to settings with success flag ----
  const returnTo = state.returnTo ?? '/dashboard/settings/integrations';
  return redirectWith(req.nextUrl, returnTo, {
    google: 'connected',
    email: profile.email,
  });
}
