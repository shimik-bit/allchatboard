import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { backfillWorkspaceAvatars } from '@/lib/groupguard/avatar-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/groupguard/profiles/avatars-backfill
 *
 * Fetches WhatsApp avatars for profiles in the workspace that don't have
 * one yet. Triggered by the "טען תמונות פרופיל חסרות" button in the
 * Members tab.
 *
 * Why this exists separate from the AI extractor: avatars don't require
 * an LLM, just a phone number + Green API. Tying avatar fetching to AI
 * extraction means workspaces with many members but few text messages
 * (like the one that prompted this fix — 901 profiles, 0 with avatars
 * because most members never sent enough messages to trigger AI
 * extraction) end up with a sea of placeholder "?" avatars even when
 * Green API would happily return real pictures.
 *
 * Up to 200 profiles per call (the Vercel maxDuration constraint —
 * ~250ms per Green API call × 200 = ~50s, with margin). Caller can
 * re-invoke for larger backfills.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { workspace_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.workspace_id) {
    return NextResponse.json(
      { error: 'workspace_id required' },
      { status: 400 },
    );
  }

  // Membership check — any member can trigger; this is a read-only operation
  // against external Green API and a write to the workspace's own profiles.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', body.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Use service client to bypass RLS for the bulk update path.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const result = await backfillWorkspaceAvatars({
    supabase: admin,
    workspaceId: body.workspace_id,
    maxProfiles: 200,
    onlyMissing: !body.force,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
