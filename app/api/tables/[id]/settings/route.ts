import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/[id]/settings
 *   Returns the table's settings JSONB plus the table's basic info and field list.
 *   Used by the /dashboard/tables/[id]/settings page.
 *
 * PATCH /api/tables/[id]/settings
 *   Body: { settings: { ... } }
 *   Updates the table's settings JSONB.
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: table, error } = await supabase
    .from('tables')
    .select('id, name, slug, icon, color, description, settings, workspace_id')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!table) return NextResponse.json({ error: 'table not found' }, { status: 404 });

  // Get fields so the UI can show field-pickers (e.g. "which field is the phone?")
  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, slug, type, position, config')
    .eq('table_id', params.id)
    .order('position', { ascending: true });

  return NextResponse.json({
    table,
    fields: fields || [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { settings } = body;

  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'settings object required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tables')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, settings')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
