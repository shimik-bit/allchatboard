// POST /api/integrations/google/sheets/resolve
//
// User pastes a Google Sheets URL — we extract the id, verify it's
// accessible with the user's token, and return its metadata + tab list
// for the picker UI.
//
// Body: { url: string }  OR  { spreadsheetId: string }
// Response: { spreadsheet: { id, name, url, ... }, tabs: [...] }
//   or 404 if the URL is malformed / inaccessible

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { getAuthedGoogleClient } from '@/lib/google/connection';
import {
  extractSpreadsheetIdFromUrl,
  getSpreadsheetInfo,
  listSheetTabs,
} from '@/lib/google/sheets';

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
  let id: string | null = null;
  if (typeof body.spreadsheetId === 'string' && body.spreadsheetId.trim()) {
    id = body.spreadsheetId.trim();
  } else if (typeof body.url === 'string') {
    id = extractSpreadsheetIdFromUrl(body.url.trim());
  }

  if (!id) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const authed = await getAuthedGoogleClient(ws.wsId, user.id);
  if (!authed) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  const info = await getSpreadsheetInfo(authed.client, id);
  if (!info) {
    // 404 because either the sheet doesn't exist, or the user doesn't have
    // access. With drive.file scope, "no access" is the most likely cause —
    // they need to either own it or share it with their TaskFlow Google
    // account, OR we need to first create it via /sheets/create.
    return NextResponse.json(
      {
        error: 'inaccessible',
        message:
          'Sheet not found or not accessible. Note: with our limited Drive access we can only see sheets that TaskFlow created or that you explicitly granted access to.',
      },
      { status: 404 },
    );
  }

  try {
    const tabs = await listSheetTabs(authed.client, id);
    return NextResponse.json({ spreadsheet: info, tabs });
  } catch (err: any) {
    console.error('[sheets/resolve] listTabs failed:', err);
    return NextResponse.json(
      { error: 'google_error', details: err?.message ?? 'unknown' },
      { status: 502 },
    );
  }
}
