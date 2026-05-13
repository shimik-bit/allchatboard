// GET /api/integrations/google/sheets/list
//
// Returns up to 50 most-recently-modified spreadsheets the user has
// touched with TaskFlow (per the `drive.file` scope).
//
// Response:
//   { spreadsheets: [{ id, name, url, modifiedAt }, ...] }
// Or:
//   { error: 'not_connected' | 'google_error', details?: string } with non-2xx status

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { getAuthedGoogleClient } from '@/lib/google/connection';
import { listRecentSpreadsheets } from '@/lib/google/sheets';

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

  const authed = await getAuthedGoogleClient(ws.wsId, user.id);
  if (!authed) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  try {
    const spreadsheets = await listRecentSpreadsheets(authed.client);
    return NextResponse.json({ spreadsheets });
  } catch (err: any) {
    console.error('[sheets/list] Google API error:', err);
    return NextResponse.json(
      { error: 'google_error', details: err?.message ?? 'unknown' },
      { status: 502 },
    );
  }
}
