import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/booking-pages?workspace_id=xxx[&table_id=xxx]   - list
 * POST /api/booking-pages                                    - create
 *
 * The slug must be unique across all workspaces. We auto-generate one
 * from the title if the caller doesn't supply one.
 */

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const tableId = searchParams.get('table_id');

  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  let query = supabase
    .from('booking_pages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (tableId) query = query.eq('table_id', tableId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pages: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, table_id, title, slug, ...rest } = body;

  if (!workspace_id || !table_id || !title?.trim()) {
    return NextResponse.json({ error: 'workspace_id, table_id, title required' }, { status: 400 });
  }

  const finalSlug = (slug || generateSlug(title)).trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(finalSlug)) {
    return NextResponse.json({ error: 'slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 });
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from('booking_pages')
    .select('id')
    .eq('slug', finalSlug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'slug already taken — try a different one' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('booking_pages')
    .insert({
      workspace_id,
      table_id,
      title: title.trim(),
      slug: finalSlug,
      created_by: user.id,
      ...rest,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page: data }, { status: 201 });
}

// Slug from title: keep ascii letters/digits, replace others with hyphen
function generateSlug(title: string): string {
  // Strip Hebrew/Arabic/etc, fall back to a random slug if nothing left
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (ascii && ascii.length >= 3) return ascii.slice(0, 40);

  // Fallback: random short slug
  return 'book-' + Math.random().toString(36).slice(2, 9);
}
