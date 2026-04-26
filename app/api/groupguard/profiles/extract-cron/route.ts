import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { extractProfileForMember } from '@/lib/groupguard/profile-extractor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // up to 60 seconds

/**
 * POST /api/groupguard/profiles/extract-cron
 *   Auth: Bearer ${CRON_SECRET}
 *   Processes the next batch of profiles needing extraction.
 *
 * GET /api/groupguard/profiles/extract-cron
 *   Manual trigger for testing - same auth.
 *
 * Strategy: pick the most-active members who haven't been extracted recently.
 * Process up to 5 profiles per run to stay within timeout.
 */

const BATCH_SIZE = 5;

async function handleExtraction() {
  const supabase = createAdminClient();
  const startedAt = Date.now();

  // Find profiles needing extraction:
  // - Have at least 5 messages
  // - Either never extracted, or extracted more than 6 hours ago
  // - Active in the last 30 days
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from('gg_member_profiles')
    .select('id, phone, message_count, last_extracted_at')
    .gte('message_count', 5)
    .gte('last_seen_at', thirtyDaysAgo)
    .or(`last_extracted_at.is.null,last_extracted_at.lt.${sixHoursAgo}`)
    .order('message_count', { ascending: false })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[GG][cron] failed to find candidates:', error);
    return { ok: false, error: error.message };
  }

  if (!candidates || candidates.length === 0) {
    return {
      ok: true,
      processed: 0,
      duration_ms: Date.now() - startedAt,
      message: 'no candidates',
    };
  }

  // Process each candidate
  const results = [];
  for (const c of candidates) {
    try {
      const updated = await extractProfileForMember(supabase, c.id);
      results.push({ id: c.id, phone: c.phone, updated });
    } catch (err) {
      console.error('[GG][cron] extraction failed for', c.id, err);
      results.push({ id: c.id, phone: c.phone, updated: false, error: String(err) });
    }
  }

  return {
    ok: true,
    processed: results.length,
    updated: results.filter((r) => r.updated).length,
    duration_ms: Date.now() - startedAt,
    results,
  };
}


function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.warn('[GG][cron] CRON_SECRET not set');
    return false;
  }
  return authHeader === `Bearer ${expectedSecret}`;
}


export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await handleExtraction();
  return NextResponse.json(result);
}


export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await handleExtraction();
  return NextResponse.json(result);
}
