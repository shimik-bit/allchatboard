/**
 * API key middleware - shared logic for all /api/v1/* endpoints
 *
 * Usage:
 *   const auth = await authenticateApiRequest(req);
 *   if (!auth.ok) return auth.errorResponse;
 *   const { workspace_id, can_create, table_ids } = auth.key;
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

// We use the service role for API requests (bypasses RLS), but we enforce
// permissions ourselves based on the api_keys table.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type ApiKey = {
  id: string;
  workspace_id: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  table_ids: string[] | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type AuthResult =
  | { ok: true; key: ApiKey; admin: ReturnType<typeof adminClient> }
  | { ok: false; errorResponse: NextResponse };

/**
 * Validate the Bearer token from the Authorization header.
 * Returns the api_key record if valid, otherwise an error response.
 */
export async function authenticateApiRequest(req: NextRequest): Promise<AuthResult> {
  // 1. Extract bearer token
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { error: 'missing_authorization', message: 'Authorization header required: Bearer <token>' },
        { status: 401 }
      ),
    };
  }
  const token = match[1];

  // 2. Hash + lookup
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const admin = adminClient();

  const { data: rows } = await admin.rpc('api_key_lookup', { p_token_hash: tokenHash });
  const key = rows?.[0] as ApiKey | undefined;

  if (!key) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { error: 'invalid_token', message: 'API key not found, expired, or revoked' },
        { status: 401 }
      ),
    };
  }

  return { ok: true, key, admin };
}

/**
 * Log an API request to the audit table.
 * Fire-and-forget — does not block the response.
 */
export function logApiRequest(opts: {
  admin: ReturnType<typeof adminClient>;
  apiKeyId: string;
  workspaceId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  errorMessage?: string | null;
}) {
  // Don't await - log asynchronously
  Promise.all([
    opts.admin.from('api_request_logs').insert({
      api_key_id: opts.apiKeyId,
      workspace_id: opts.workspaceId,
      method: opts.method,
      path: opts.path,
      status_code: opts.statusCode,
      duration_ms: opts.durationMs,
      ip_address: opts.ipAddress || null,
      user_agent: opts.userAgent || null,
      error_message: opts.errorMessage || null,
    }),
    // Update last_used_at and increment request_count atomically
    opts.admin.rpc('increment_api_key_usage', { p_key_id: opts.apiKeyId }).then(
      () => null,
      // If RPC missing, fall back to plain update (don't crash)
      () => opts.admin.from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', opts.apiKeyId)
    ),
  ]).catch(() => {
    // Swallow errors - logging should never break the request
  });
}

/**
 * Check if the API key has access to a specific table.
 * If table_ids is null, all tables in the workspace are allowed.
 */
export async function checkTableAccess(
  admin: ReturnType<typeof adminClient>,
  key: ApiKey,
  tableId: string
): Promise<{ ok: true } | { ok: false; errorResponse: NextResponse }> {
  // Check whitelist first
  if (key.table_ids !== null && !key.table_ids.includes(tableId)) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { error: 'forbidden_table', message: 'API key does not have access to this table' },
        { status: 403 }
      ),
    };
  }

  // Verify table belongs to the key's workspace
  const { data: table } = await admin
    .from('tables')
    .select('id, workspace_id')
    .eq('id', tableId)
    .single();

  if (!table) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { error: 'table_not_found', message: 'Table does not exist' },
        { status: 404 }
      ),
    };
  }

  if (table.workspace_id !== key.workspace_id) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { error: 'forbidden_workspace', message: 'Table belongs to a different workspace' },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

/**
 * Generate a fresh API key. Returns both plain (return to user once) and hash (store).
 * Format: acb_live_<32 random chars>
 */
export function generateApiKey(): { plain: string; hash: string; prefix: string } {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let random = '';
  // Use crypto.getRandomValues for cryptographic strength
  const bytes = new Uint8Array(32);
  // Node's crypto module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require('node:crypto');
  const buf = randomBytes(32);
  for (let i = 0; i < 32; i++) {
    random += chars[buf[i] % chars.length];
  }
  const plain = `acb_live_${random}`;
  const hash = createHash('sha256').update(plain).digest('hex');
  // Prefix shows the first 12 chars + last 4 (for UI display)
  const prefix = `${plain.slice(0, 12)}…${plain.slice(-4)}`;
  return { plain, hash, prefix };
}
