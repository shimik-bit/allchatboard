import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolvePhoneCountry } from '@/lib/utils/phone-country';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/groups/[id]/report
 *
 * Aggregations across all members of a group, used to render the
 * "דוח קבוצה" modal. Returns breakdowns by:
 *   - Country (derived from phone prefix via resolvePhoneCountry)
 *   - Profession (from gg_member_profiles.profession)
 *   - Business type / industry (from gg_member_profiles.business_type)
 *   - City (from gg_member_profiles.city)
 *   - Languages (from gg_member_profiles.languages — array column)
 *   - Profile completeness distribution (bucketed: 0%, 1-25%, 26-50%, 51-75%, 76-100%)
 *
 * Plus headline numbers: total members, members with extracted profile,
 * members with avatar, top members by message count.
 *
 * All breakdowns return arrays of {key, count} sorted by count desc, with
 * an "אחר" / "Other" tail bucket when there are too many distinct values
 * to display individually (caller can choose how to render).
 *
 * The endpoint is intentionally heavy on derivation (country lookup,
 * language array unnest) rather than asking the DB to do it via Postgres
 * features, because the data set per group is bounded (typically <2k
 * members) and doing it in TS keeps the SQL simple + reusable. If a
 * group ever grows past ~20k members this would need a SQL function.
 */

type Bucket = { key: string; count: number; meta?: Record<string, unknown> };

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const groupId = params.id;
  if (!groupId) {
    return NextResponse.json({ error: 'group id required' }, { status: 400 });
  }

  // Verify the user has access to this group's workspace.
  const { data: group, error: groupErr } = await supabase
    .from('whatsapp_groups')
    .select('id, workspace_id, group_name')
    .eq('id', groupId)
    .single();
  if (groupErr || !group) {
    return NextResponse.json({ error: 'group not found' }, { status: 404 });
  }

  // RLS will reject if the user isn't a member, but membership check is
  // explicit here too so we return a clean 403 rather than an empty result.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', group.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Pull all member profiles for this group via the link table.
  // Selecting only the fields we actually aggregate on, plus a few we
  // need for the "top members" preview — keeps the payload tight even
  // for 2k-member groups.
  const { data: rows, error: rowsErr } = await supabase
    .from('gg_member_groups')
    .select(`
      profile_id,
      message_count,
      gg_member_profiles!inner (
        id,
        phone,
        display_name,
        full_name,
        profession,
        business_name,
        business_type,
        city,
        languages,
        completeness_pct,
        avatar_url,
        last_seen_at
      )
    `)
    .eq('group_id', groupId);

  if (rowsErr) {
    console.error('[group-report] query failed:', rowsErr);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  // Flatten the nested join result. Supabase types it as `gg_member_profiles`
  // being either an object or array of objects depending on PostgREST mood;
  // normalize to a single object.
  type FlatRow = {
    profile_id: string;
    group_message_count: number;
    phone: string | null;
    display_name: string | null;
    full_name: string | null;
    profession: string | null;
    business_name: string | null;
    business_type: string | null;
    city: string | null;
    languages: string[] | null;
    completeness_pct: number | null;
    avatar_url: string | null;
    last_seen_at: string | null;
  };

  const members: FlatRow[] = (rows || []).map((r: any) => {
    const p = Array.isArray(r.gg_member_profiles)
      ? r.gg_member_profiles[0]
      : r.gg_member_profiles;
    return {
      profile_id: r.profile_id,
      group_message_count: r.message_count || 0,
      phone: p?.phone ?? null,
      display_name: p?.display_name ?? null,
      full_name: p?.full_name ?? null,
      profession: p?.profession ?? null,
      business_name: p?.business_name ?? null,
      business_type: p?.business_type ?? null,
      city: p?.city ?? null,
      languages: p?.languages ?? null,
      completeness_pct: p?.completeness_pct ?? 0,
      avatar_url: p?.avatar_url ?? null,
      last_seen_at: p?.last_seen_at ?? null,
    };
  });

  // ============================================================================
  // Aggregations
  // ============================================================================

  // Country: derive from phone prefix. Members with no resolvable country
  // (junk phone, missing data) bucket into "לא ידוע".
  const countryCounts = new Map<string, { count: number; flag: string; nameEn: string }>();
  for (const m of members) {
    const c = resolvePhoneCountry(m.phone);
    const key = c?.name || 'לא ידוע';
    const existing = countryCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      countryCounts.set(key, {
        count: 1,
        flag: c?.flag || '🏳️',
        nameEn: c?.nameEn || 'Unknown',
      });
    }
  }
  const countries: Bucket[] = Array.from(countryCounts.entries())
    .map(([key, v]) => ({ key, count: v.count, meta: { flag: v.flag, nameEn: v.nameEn } }))
    .sort((a, b) => b.count - a.count);

  // Profession: group by raw profession string. Profiles where extraction
  // didn't run (profession=null) bucket into "טרם נסרק" so the report
  // accurately reflects coverage.
  const professions = bucketByField(
    members,
    (m) => m.profession,
    'טרם נסרק',
  );

  // Industry / business type — same as profession but on business_type
  const industries = bucketByField(
    members,
    (m) => m.business_type,
    'לא צוין',
  );

  // Cities
  const cities = bucketByField(
    members,
    (m) => m.city,
    'לא צוין',
  );

  // Languages — array column, so each member can contribute multiple keys.
  const langCounts = new Map<string, number>();
  let langTotal = 0;
  for (const m of members) {
    if (!m.languages || m.languages.length === 0) continue;
    for (const lang of m.languages) {
      const key = (lang || '').trim();
      if (!key) continue;
      langCounts.set(key, (langCounts.get(key) || 0) + 1);
      langTotal++;
    }
  }
  const languages: Bucket[] = Array.from(langCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // Completeness distribution — bucket the percentages so the chart isn't
  // a histogram of 100 individual buckets. Aligned to natural quartile-ish
  // ranges that match how a person reads "how good is this group's data?".
  const completenessBuckets = {
    'לא נסרק (0%)': 0,
    'התחלה (1-25%)': 0,
    'חלקי (26-50%)': 0,
    'טוב (51-75%)': 0,
    'מלא (76-100%)': 0,
  };
  for (const m of members) {
    const pct = m.completeness_pct ?? 0;
    if (pct === 0) completenessBuckets['לא נסרק (0%)']++;
    else if (pct <= 25) completenessBuckets['התחלה (1-25%)']++;
    else if (pct <= 50) completenessBuckets['חלקי (26-50%)']++;
    else if (pct <= 75) completenessBuckets['טוב (51-75%)']++;
    else completenessBuckets['מלא (76-100%)']++;
  }
  const completenessDistribution: Bucket[] = Object.entries(completenessBuckets).map(
    ([key, count]) => ({ key, count }),
  );

  // Top 10 members by activity in this group — a quick "who drives this group"
  // overview at the top of the report.
  const topActive = [...members]
    .sort((a, b) => b.group_message_count - a.group_message_count)
    .slice(0, 10)
    .map((m) => ({
      profile_id: m.profile_id,
      name: m.full_name || m.display_name || m.phone || 'לא ידוע',
      phone: m.phone,
      avatar_url: m.avatar_url,
      profession: m.profession,
      message_count: m.group_message_count,
      completeness_pct: m.completeness_pct,
    }));

  // Headline numbers
  const totalMembers = members.length;
  const withProfile = members.filter((m) => (m.completeness_pct || 0) > 0).length;
  const withAvatar = members.filter((m) => m.avatar_url).length;
  const avgCompleteness =
    totalMembers > 0
      ? Math.round(
          members.reduce((sum, m) => sum + (m.completeness_pct || 0), 0) / totalMembers,
        )
      : 0;

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.group_name,
    },
    summary: {
      total_members: totalMembers,
      with_extracted_profile: withProfile,
      with_avatar: withAvatar,
      avg_completeness_pct: avgCompleteness,
    },
    breakdowns: {
      countries,
      professions,
      industries,
      cities,
      languages,
      completeness_distribution: completenessDistribution,
    },
    top_active: topActive,
  });
}

// ============================================================================
// Helpers
// ============================================================================

function bucketByField<T>(
  items: T[],
  getField: (item: T) => string | null | undefined,
  nullLabel: string,
): Bucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const val = (getField(item) || '').trim();
    const key = val || nullLabel;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
