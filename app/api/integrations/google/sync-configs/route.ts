// GET  /api/integrations/google/sync-configs        - list configs for the workspace
// POST /api/integrations/google/sync-configs        - create or update a config
//
// Each config maps an event_type to a (spreadsheet_id, sheet_tab_name)
// destination. There's at most one config per (workspace, event_type),
// enforced by the unique constraint in the migration.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';

const VALID_EVENT_TYPES = [
  'gg_new_member',
  'gg_member_left',
  'gg_bot_action',
  'gg_spam_detected',
  'attribution_lead',
] as const;

type EventType = (typeof VALID_EVENT_TYPES)[number];

function isEventType(s: any): s is EventType {
  return typeof s === 'string' && (VALID_EVENT_TYPES as readonly string[]).includes(s);
}

// ---- GET: list ----
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 400 });
  }

  // RLS will scope to the workspace via membership
  const { data, error } = await supabase
    .from('google_sheet_sync_configs')
    .select(`
      id,
      event_type,
      spreadsheet_id,
      spreadsheet_name,
      spreadsheet_url,
      sheet_tab_name,
      is_enabled,
      write_headers,
      created_at,
      updated_at,
      last_synced_at,
      last_error,
      last_error_at,
      consecutive_errors
    `)
    .eq('workspace_id', ws.wsId)
    .order('event_type');

  if (error) {
    return NextResponse.json({ error: 'db_failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ configs: data ?? [] });
}

// ---- POST: create or update ----
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  if (!isEventType(body.eventType)) {
    return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 });
  }
  if (typeof body.spreadsheetId !== 'string' || !body.spreadsheetId) {
    return NextResponse.json({ error: 'missing_spreadsheet' }, { status: 400 });
  }

  // Find this user's active connection — required because configs FK it
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from('google_oauth_connections')
    .select('id')
    .eq('workspace_id', ws.wsId)
    .eq('user_id', user.id)
    .is('disconnected_at', null)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  const row = {
    workspace_id: ws.wsId,
    connection_id: conn.id,
    event_type: body.eventType,
    spreadsheet_id: body.spreadsheetId,
    spreadsheet_name:
      typeof body.spreadsheetName === 'string' ? body.spreadsheetName : null,
    spreadsheet_url:
      typeof body.spreadsheetUrl === 'string' ? body.spreadsheetUrl : null,
    sheet_tab_name:
      typeof body.sheetTabName === 'string' && body.sheetTabName
        ? body.sheetTabName
        : 'Sheet1',
    is_enabled: body.isEnabled !== false, // default true
    write_headers: body.writeHeaders !== false, // default true
    // Reset error state on save
    last_error: null,
    last_error_at: null,
    consecutive_errors: 0,
  };

  const { data, error } = await admin
    .from('google_sheet_sync_configs')
    .upsert(row, { onConflict: 'workspace_id,event_type' })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'db_failed', details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ config: data });
}
