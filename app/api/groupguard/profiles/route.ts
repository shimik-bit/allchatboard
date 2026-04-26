import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/profiles?workspace_id=xxx&q=&page=&sort=
 *   List profiles in a workspace, optionally filtered by full-text search.
 *
 * Query params:
 *   workspace_id - required
 *   q            - search query (full-text on name/profession/business/skills/interests)
 *   page         - 0-indexed
 *   sort         - 'recent' | 'active' | 'complete' (default: recent)
 *   group_id     - filter to members of a specific group
 */

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const q = (searchParams.get('q') || '').trim();
  const page = Math.max(0, Number(searchParams.get('page') || 0));
  const sort = searchParams.get('sort') || 'recent';
  const groupId = searchParams.get('group_id');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Build base query
  let query;

  if (groupId) {
    // Filter to members of a specific group via the gg_member_groups join
    query = supabase
      .from('gg_member_profiles')
      .select(`
        id, phone, display_name, full_name, profession, specialization,
        business_name, business_type, websites, city, skills, interests,
        bio, completeness_pct, message_count, groups_count,
        first_seen_at, last_seen_at, last_extracted_at,
        gg_member_groups!inner(group_id)
      `, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('gg_member_groups.group_id', groupId);
  } else {
    query = supabase
      .from('gg_member_profiles')
      .select(`
        id, phone, display_name, full_name, profession, specialization,
        business_name, business_type, websites, city, skills, interests,
        bio, completeness_pct, message_count, groups_count,
        first_seen_at, last_seen_at, last_extracted_at
      `, { count: 'exact' })
      .eq('workspace_id', workspaceId);
  }

  // Apply search
  if (q) {
    // Use websearch_to_tsquery for natural language input
    query = query.textSearch('search_vector', q, {
      type: 'websearch',
      config: 'simple',
    });
  }

  // Sorting
  if (sort === 'active') {
    query = query.order('message_count', { ascending: false });
  } else if (sort === 'complete') {
    query = query.order('completeness_pct', { ascending: false });
  } else {
    query = query.order('last_seen_at', { ascending: false });
  }

  // Pagination
  query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const { data: profiles, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profiles: profiles || [],
    page,
    page_size: PAGE_SIZE,
    total: count ?? 0,
    total_pages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
