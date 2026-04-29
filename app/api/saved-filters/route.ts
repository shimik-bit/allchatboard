import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/saved-filters?table_id=xxx
 *
 * Returns the current user's saved filters for the given table.
 * RLS enforces that users only see their own filters — no extra check needed here.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tableId = req.nextUrl.searchParams.get('table_id');
  if (!tableId) {
    return NextResponse.json({ error: 'table_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_filters')
    .select('id, name, filters, icon, position, is_pinned, created_at, updated_at')
    .eq('table_id', tableId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filters: data || [] });
}

/**
 * POST /api/saved-filters
 *
 * Body: { table_id, workspace_id, name, filters, icon?, is_pinned? }
 *
 * Creates a new saved filter for the current user.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { table_id, workspace_id, name, filters, icon, is_pinned } = body;

  if (!table_id || !workspace_id || !name) {
    return NextResponse.json(
      { error: 'table_id, workspace_id, name are required' },
      { status: 400 }
    );
  }

  // Validate filters shape — minimum sanity check
  if (filters && (typeof filters !== 'object' || !Array.isArray(filters.conditions))) {
    return NextResponse.json({ error: 'invalid filters format' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_filters')
    .insert({
      user_id: user.id,
      workspace_id,
      table_id,
      name: name.trim().slice(0, 80),
      filters: filters || { operator: 'and', conditions: [] },
      icon: icon || null,
      is_pinned: is_pinned !== false, // default true
    })
    .select()
    .single();

  if (error) {
    // Friendly error for unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'כבר יש לך פילטר בשם הזה. בחר שם אחר.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filter: data });
}
