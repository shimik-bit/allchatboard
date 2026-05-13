// POST /api/integrations/google/sheets/create
//
// Creates a new spreadsheet in the user's Drive.
//
// Body: { title: string, tabName?: string }
// Response: { id, name, url, modifiedAt }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { getAuthedGoogleClient } from '@/lib/google/connection';
import { createSpreadsheet } from '@/lib/google/sheets';

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
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const tabName =
    typeof body.tabName === 'string' && body.tabName.trim()
      ? body.tabName.trim()
      : 'Sheet1';

  if (!title) {
    return NextResponse.json({ error: 'missing_title' }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: 'title_too_long' }, { status: 400 });
  }

  const authed = await getAuthedGoogleClient(ws.wsId, user.id);
  if (!authed) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  try {
    const sheet = await createSpreadsheet(authed.client, title, tabName);
    return NextResponse.json(sheet);
  } catch (err: any) {
    console.error('[sheets/create] Google API error:', err);
    return NextResponse.json(
      { error: 'google_error', details: err?.message ?? 'unknown' },
      { status: 502 },
    );
  }
}
