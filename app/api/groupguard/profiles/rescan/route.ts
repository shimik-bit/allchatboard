import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extractProfileForMember } from '@/lib/groupguard/profile-extractor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/groupguard/profiles/rescan
 *
 * User-triggered version of the cron extraction. The cron at
 * /api/groupguard/profiles/extract-cron requires CRON_SECRET (only Vercel
 * can call it), and runs every 6 hours. This endpoint is for the "Refresh
 * profiles now" button so a logged-in user with workspace access can kick
 * off a batch on demand.
 *
 * Body:
 *   { workspace_id: string }            - required, must be a workspace member
 *   { profile_id?: string }             - optional, scan just this one profile
 *
 * Behavior:
 *   - With profile_id: extract that one profile (used by single-profile refresh)
 *   - Without:         extract up to BATCH_SIZE most-active stale profiles in the
 *                      workspace (same selection logic as the cron, scoped here)
 *
 * Stays under 60s by capping the batch at 5 and running them sequentially —
 * matches the cron behavior exactly so the two paths produce identical
 * results.
 */

const BATCH_SIZE = 5;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { workspace_id?: string; profile_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { workspace_id: workspaceId, profile_id: profileId } = body;
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify the caller is a workspace member — same check used by the
  // profiles list route. Without this, anyone could trigger expensive AI
  // extractions against any workspace.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Switch to admin client for the actual extraction work — extraction
  // reads gg_member_profiles + wa_messages and writes back to the
  // profiles table; using admin avoids RLS getting in the way of bulk work.
  const admin = createAdminClient();
  const startedAt = Date.now();

  // ── Single-profile mode ───────────────────────────────────────────────
  if (profileId) {
    // Sanity-check the profile actually belongs to this workspace before
    // we let the user trigger an extraction on it.
    const { data: prof } = await admin
      .from('gg_member_profiles')
      .select('id, workspace_id, phone')
      .eq('id', profileId)
      .single();
    if (!prof || prof.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'profile not found' }, { status: 404 });
    }

    try {
      const updated = await extractProfileForMember(admin, profileId);
      return NextResponse.json({
        ok: true,
        mode: 'single',
        processed: 1,
        updated: updated ? 1 : 0,
        duration_ms: Date.now() - startedAt,
      });
    } catch (err) {
      console.error('[GG][rescan] single failed for', profileId, err);
      return NextResponse.json({
        ok: false,
        error: String(err),
      }, { status: 500 });
    }
  }

  // ── Batch mode ────────────────────────────────────────────────────────
  // Mirror the cron's candidate-selection logic but scoped to this workspace.
  // The cron's 6-hour staleness check is intentionally relaxed here to 1 hour
  // so the manual button feels useful — if a user just clicked rescan and
  // saw nothing change, waiting 6 hours to retry is bad UX. 1 hour still
  // protects against runaway repeated clicks burning OpenAI tokens.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await admin
    .from('gg_member_profiles')
    .select('id, phone, message_count')
    .eq('workspace_id', workspaceId)
    .gte('message_count', 5)
    .gte('last_seen_at', thirtyDaysAgo)
    .or(`last_extracted_at.is.null,last_extracted_at.lt.${oneHourAgo}`)
    .order('message_count', { ascending: false })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[GG][rescan] failed to find candidates:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: 'batch',
      processed: 0,
      updated: 0,
      duration_ms: Date.now() - startedAt,
      message: 'no_candidates',
    });
  }

  let updatedCount = 0;
  for (const c of candidates) {
    try {
      const updated = await extractProfileForMember(admin, c.id);
      if (updated) updatedCount++;
    } catch (err) {
      console.error('[GG][rescan] extraction failed for', c.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'batch',
    processed: candidates.length,
    updated: updatedCount,
    duration_ms: Date.now() - startedAt,
  });
}
