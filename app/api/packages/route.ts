import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/packages?category=customers&q=search_term
 *
 * Returns published table packages, optionally filtered by category or search.
 * Each package contains a structure with one or more tables.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q')?.trim();

  let query = supabase
    .from('table_packages')
    .select('id, slug, name, description, category, icon, color, structure, position')
    .eq('is_published', true)
    .order('category')
    .order('position');

  if (category) {
    query = query.eq('category', category);
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by category for the UI
  const grouped: Record<string, any[]> = {};
  for (const pkg of data || []) {
    if (!grouped[pkg.category]) grouped[pkg.category] = [];
    grouped[pkg.category].push(pkg);
  }

  return NextResponse.json({ packages: data || [], grouped });
}
