// Google OAuth helpers — wrappers around `googleapis` that:
//   * Build the consent URL with the right scopes + state
//   * Exchange the auth code for tokens
//   * Refresh expired access tokens
//   * Hand back an authenticated client to call Sheets/Drive APIs
//
// All token persistence happens elsewhere (api routes); this module is pure.

import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { decryptToken, encryptToken } from './encryption';

// ----------------------------------------------------------------------------
// Scopes
// ----------------------------------------------------------------------------
// We request the minimum needed. `drive.file` is non-sensitive — it only
// gives the app access to files it created or that the user explicitly
// opened with the app. This means we DON'T need Google's app verification
// process for Drive. `spreadsheets` IS sensitive and will require
// verification before we exit "test mode", but we already need it to edit
// existing sheets the customer points us at.
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

// ----------------------------------------------------------------------------
// Client factories
// ----------------------------------------------------------------------------

/** Build a fresh OAuth2Client with our app credentials but no user tokens. */
export function buildOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, or GOOGLE_OAUTH_REDIRECT_URI env vars.',
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate the consent URL the user should be redirected to.
 *
 * @param state Opaque value Google will echo back; we use it to identify
 *              the workspace + user that initiated the flow + a CSRF nonce.
 */
export function buildConsentUrl(state: string): string {
  const oauth2 = buildOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',        // Required to get a refresh_token
    prompt: 'consent',             // Force re-prompt so we always get refresh_token,
                                   // even if the user previously authorized us
    scope: [...GOOGLE_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

// ----------------------------------------------------------------------------
// Token exchange + refresh
// ----------------------------------------------------------------------------

export type GoogleProfile = {
  email: string;
  googleUserId: string;
  pictureUrl?: string;
};

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;        // May be missing if Google reuses a previous one
  expiresAt: Date;
  grantedScopes: string[];
};

/**
 * Exchange the `code` returned to our callback URL for an access + refresh
 * token pair, and fetch the user's profile so we know whose Google account
 * we're connected to.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ tokens: TokenSet; profile: GoogleProfile }> {
  const oauth2 = buildOAuthClient();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Google did not return an access_token.');
  }
  if (!tokens.expiry_date) {
    throw new Error('Google did not return an expiry_date.');
  }

  // Use the freshly-issued tokens to call the userinfo endpoint
  oauth2.setCredentials(tokens);
  const oauth2v2 = google.oauth2({ version: 'v2', auth: oauth2 });
  const { data: profile } = await oauth2v2.userinfo.get();

  if (!profile.email || !profile.id) {
    throw new Error('Google userinfo response missing email or id.');
  }

  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: new Date(tokens.expiry_date),
      grantedScopes: tokens.scope ? tokens.scope.split(' ') : [...GOOGLE_SCOPES],
    },
    profile: {
      email: profile.email,
      googleUserId: profile.id,
      pictureUrl: profile.picture ?? undefined,
    },
  };
}

/**
 * Use a refresh_token to mint a fresh access_token. Called by the worker
 * (PR #3) when it detects an about-to-expire token before making a Sheets
 * API call.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Token refresh did not return access_token/expiry_date.');
  }

  return {
    accessToken: credentials.access_token,
    expiresAt: new Date(credentials.expiry_date),
  };
}

// ----------------------------------------------------------------------------
// Authenticated client builder (used by the sync worker in PR #3)
// ----------------------------------------------------------------------------

/**
 * Build an OAuth2Client populated with a user's stored tokens, ready to
 * call Sheets / Drive APIs. The caller is responsible for refreshing first
 * if the token is expired (we don't do it here to avoid hidden network
 * calls in what should be a pure factory).
 */
export function buildClientFromCredentials(creds: Credentials): OAuth2Client {
  const oauth2 = buildOAuthClient();
  oauth2.setCredentials(creds);
  return oauth2;
}

// ----------------------------------------------------------------------------
// State token (CSRF + flow context)
// ----------------------------------------------------------------------------
// `state` is base64-encoded JSON: { workspaceId, userId, nonce, returnTo }.
// We don't sign it because the callback already verifies the user via the
// Supabase session cookie — the state is purely to remember which workspace
// the user was on when they clicked Connect.

export type OAuthState = {
  workspaceId: string;
  userId: string;
  nonce: string;
  returnTo?: string;
};

export function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

export function decodeState(encoded: string): OAuthState {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed.workspaceId || !parsed.userId || !parsed.nonce) {
      throw new Error('State missing required fields');
    }
    return parsed;
  } catch (err) {
    throw new Error(`Invalid OAuth state: ${err}`);
  }
}

// ----------------------------------------------------------------------------
// Convenience re-exports
// ----------------------------------------------------------------------------
export { encryptToken, decryptToken };
