// GET /api/integrations/google/sync-worker
//
// Cron-triggered worker that drains the google_sheet_sync_queue and
// appends events to their configured Sheets.
//
// Schedule (vercel.json): every minute. Each invocation:
//   1. Find all distinct (workspace, config) pairs with pending rows
//   2. For each, claim up to 50 rows (BATCH_SIZE), mark them processing
//   3. Group by event_type and convert to sheet rows via the schema
//   4. If the sheet is empty and write_headers=true, write headers first
//   5. Append all rows in one Sheets API call (atomic for the batch)
//   6. On success: delete the rows, update last_synced_at
//   7. On failure: mark rows as 'failed', increment attempts, log error.
//      After 5 attempts a row is marked 'dead' and stays for ops review.
//
// Why per-config batches? Because each config has a different destination
// sheet and a different OAuth token. We can't append cross-config in one
// API call.
//
// Why claim-then-process instead of just deleting after success? Because
// if the worker crashes mid-batch, we'd lose events. The claim makes the
// processing visible (status='processing') so we can recover stuck rows
// if needed.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { buildClientFromCredentials, decryptToken, encryptToken, refreshAccessToken } from '@/lib/google/oauth';
import { getSchema } from '@/lib/google/event-schemas';

export const maxDuration = 60; // seconds

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

type ConfigRow = {
  id: string;
  workspace_id: string;
  connection_id: string;
  event_type: string;
  spreadsheet_id: string;
  sheet_tab_name: string;
  write_headers: boolean;
};

type ConnectionRow = {
  id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string;
  disconnected_at: string | null;
};

type QueueRow = {
  id: number;
  payload: Record<string, any>;
  attempts: number;
};

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  // Auth: same pattern as our other crons — Bearer token from CRON_SECRET
  const cronSecret = req.headers.get('authorization');
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const admin = createAdminClient();

  // Find all configs that have pending rows in the queue. We process each
  // config independently. distinct/group-by isn't easy via the Supabase JS
  // client, so we fetch a slice of pending rows and dedupe in JS.
  const { data: pendingPeek, error: peekErr } = await admin
    .from('google_sheet_sync_queue')
    .select('config_id')
    .in('status', ['pending', 'failed'])
    .limit(200);

  if (peekErr) {
    return NextResponse.json({ error: 'peek_failed', details: peekErr.message }, { status: 500 });
  }

  const configIds = Array.from(new Set((pendingPeek ?? []).map((r: { config_id: string }) => r.config_id)));
  if (configIds.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, configs: 0, durationMs: Date.now() - startedAt });
  }

  // Fetch all relevant configs in one go
  const { data: configs, error: cfgErr } = await admin
    .from('google_sheet_sync_configs')
    .select('id, workspace_id, connection_id, event_type, spreadsheet_id, sheet_tab_name, write_headers, is_enabled')
    .in('id', configIds);

  if (cfgErr || !configs) {
    return NextResponse.json({ error: 'cfg_lookup_failed' }, { status: 500 });
  }

  const stats = {
    configs: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const config of configs) {
    if (!config.is_enabled) {
      stats.skipped++;
      continue;
    }
    try {
      const result = await processConfig(admin, config as ConfigRow);
      stats.configs++;
      stats.processed += result.processed;
      stats.failed += result.failed;
    } catch (err) {
      console.error(`[sync-worker] processConfig failed for config ${config.id}:`, err);
      stats.failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    ...stats,
    durationMs: Date.now() - startedAt,
  });
}

// ----------------------------------------------------------------------------
// Per-config processing
// ----------------------------------------------------------------------------
async function processConfig(admin: any, config: ConfigRow): Promise<{ processed: number; failed: number }> {
  // ---- 1. Get the OAuth connection ----
  const { data: conn } = await admin
    .from('google_oauth_connections')
    .select('id, user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, disconnected_at')
    .eq('id', config.connection_id)
    .maybeSingle();

  if (!conn || conn.disconnected_at) {
    // Connection is gone. Disable this config and mark queued rows as dead.
    await admin
      .from('google_sheet_sync_configs')
      .update({
        is_enabled: false,
        last_error: 'OAuth connection no longer active',
        last_error_at: new Date().toISOString(),
      })
      .eq('id', config.id);
    return { processed: 0, failed: 0 };
  }

  // ---- 2. Get a valid access token (refresh if needed) ----
  const accessToken = await ensureFreshToken(admin, conn as ConnectionRow);
  if (!accessToken) {
    // Token refresh failed; ensureFreshToken already marked the connection
    // as disconnected.
    return { processed: 0, failed: 0 };
  }

  // ---- 3. Claim a batch of pending rows ----
  // We use a single UPDATE ... RETURNING via .update().select() — this is
  // an atomic claim that prevents a parallel worker invocation from
  // grabbing the same rows.
  const { data: claimed, error: claimErr } = await admin
    .from('google_sheet_sync_queue')
    .update({ status: 'processing', last_attempt_at: new Date().toISOString() })
    .eq('config_id', config.id)
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('enqueued_at', { ascending: true })
    .limit(BATCH_SIZE)
    .select('id, payload, attempts');

  if (claimErr) {
    console.error(`[sync-worker] Claim failed for config ${config.id}:`, claimErr);
    return { processed: 0, failed: 0 };
  }

  const batch = (claimed ?? []) as QueueRow[];
  if (batch.length === 0) {
    return { processed: 0, failed: 0 };
  }

  // ---- 4. Convert payloads → sheet rows via the schema ----
  const schema = getSchema(config.event_type);
  if (!schema) {
    // Unknown event_type — mark all dead
    const ids = batch.map((r) => r.id);
    await admin
      .from('google_sheet_sync_queue')
      .update({
        status: 'dead',
        last_error: `Unknown event_type: ${config.event_type}`,
      })
      .in('id', ids);
    return { processed: 0, failed: batch.length };
  }

  const rows = batch.map((r) => {
    try {
      return schema.toRow(r.payload);
    } catch (err) {
      console.error(`[sync-worker] toRow failed for queue row ${r.id}:`, err);
      return null;
    }
  });

  // Filter out rows whose mapping failed; mark them dead
  const goodRows: any[][] = [];
  const goodIds: number[] = [];
  const badIds: number[] = [];
  batch.forEach((r, i) => {
    const row = rows[i];
    if (row === null) {
      badIds.push(r.id);
    } else {
      goodRows.push(row);
      goodIds.push(r.id);
    }
  });
  if (badIds.length > 0) {
    await admin
      .from('google_sheet_sync_queue')
      .update({ status: 'dead', last_error: 'Payload mapping failed' })
      .in('id', badIds);
  }
  if (goodRows.length === 0) {
    return { processed: 0, failed: badIds.length };
  }

  // ---- 5. Build OAuth2Client and call Sheets API ----
  const oauthClient = buildClientFromCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauthClient });

  try {
    // If write_headers is on AND this is the first write to this sheet,
    // prepend headers. We detect "first write" by checking if row 1 is
    // empty.
    if (config.write_headers) {
      await ensureHeadersWritten(sheets, config, schema.headers);
    }

    // Append all rows in one call
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheet_id,
      range: `${config.sheet_tab_name}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: goodRows },
    });

    // ---- 6. Success: delete the queue rows + update config ----
    await admin.from('google_sheet_sync_queue').delete().in('id', goodIds);

    await admin
      .from('google_sheet_sync_configs')
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
        last_error_at: null,
        consecutive_errors: 0,
      })
      .eq('id', config.id);

    return { processed: goodRows.length, failed: badIds.length };
  } catch (err: any) {
    // ---- 7. Failure: bump attempts, mark failed/dead ----
    console.error(`[sync-worker] Sheets append failed for config ${config.id}:`, err);

    const message = err?.message ?? 'unknown error';
    const newAttempts = (batch[0]?.attempts ?? 0) + 1;
    const finalStatus = newAttempts >= MAX_ATTEMPTS ? 'dead' : 'failed';

    await admin
      .from('google_sheet_sync_queue')
      .update({
        status: finalStatus,
        attempts: newAttempts,
        last_error: String(message).slice(0, 500),
      })
      .in('id', goodIds);

    await admin
      .from('google_sheet_sync_configs')
      .update({
        last_error: String(message).slice(0, 500),
        last_error_at: new Date().toISOString(),
        consecutive_errors: ((batch[0]?.attempts ?? 0) + 1),
      })
      .eq('id', config.id);

    return { processed: 0, failed: goodRows.length + badIds.length };
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function ensureFreshToken(admin: any, conn: ConnectionRow): Promise<string | null> {
  const expiresAt = new Date(conn.token_expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    return decryptToken(conn.access_token_encrypted);
  }

  if (!conn.refresh_token_encrypted) {
    // Can't refresh — mark dead
    await admin
      .from('google_oauth_connections')
      .update({ disconnected_at: new Date().toISOString() })
      .eq('id', conn.id);
    return null;
  }

  try {
    const refreshToken = decryptToken(conn.refresh_token_encrypted);
    const refreshed = await refreshAccessToken(refreshToken);
    await admin
      .from('google_oauth_connections')
      .update({
        access_token_encrypted: encryptToken(refreshed.accessToken),
        token_expires_at: refreshed.expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', conn.id);
    return refreshed.accessToken;
  } catch (err) {
    console.error(`[sync-worker] Refresh failed for connection ${conn.id}:`, err);
    await admin
      .from('google_oauth_connections')
      .update({ disconnected_at: new Date().toISOString() })
      .eq('id', conn.id);
    await admin
      .from('google_sheet_sync_configs')
      .update({ is_enabled: false })
      .eq('connection_id', conn.id);
    return null;
  }
}

async function ensureHeadersWritten(
  sheets: any,
  config: ConfigRow,
  headers: string[],
): Promise<void> {
  // Check if row 1 is empty
  const peek = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheet_id,
    range: `${config.sheet_tab_name}!A1:Z1`,
  });
  const firstRow = peek.data.values?.[0];
  if (firstRow && firstRow.some((v: any) => v !== null && v !== '')) {
    // Row 1 already has content — assume headers are there
    return;
  }

  // Write headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheet_id,
    range: `${config.sheet_tab_name}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  });
}
