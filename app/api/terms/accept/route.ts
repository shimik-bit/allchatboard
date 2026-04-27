/**
 * POST /api/terms/accept
 * ============================================================================
 * Records user acceptance of the current terms version.
 * Captures IP + user agent for legal audit trail.
 *
 * Auth: required.
 * Body: optional { version?: string } - defaults to CURRENT_TERMS_VERSION.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CURRENT_TERMS_VERSION } from '@/lib/terms/version';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createClient();

  // 1. Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse optional version (defaults to current)
  let version = CURRENT_TERMS_VERSION;
  try {
    const body = await req.json();
    if (typeof body?.version === 'string' && body.version.length <= 50) {
      version = body.version;
    }
  } catch {
    // body is optional
  }

  // 3. Capture IP and user agent for legal record
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null;
  const userAgent = req.headers.get('user-agent')?.substring(0, 500) || null;

  // 4. Insert acceptance record
  // Using upsert with ignoreDuplicates would be ideal, but we want to
  // succeed silently if already exists - just check first.
  const { data: existing } = await supabase
    .from('terms_acceptances')
    .select('id, accepted_at')
    .eq('user_id', user.id)
    .eq('terms_version', version)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      success: true,
      already_accepted: true,
      accepted_at: existing.accepted_at,
      version,
    });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('terms_acceptances')
    .insert({
      user_id: user.id,
      terms_version: version,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select('id, accepted_at')
    .single();

  if (insertErr) {
    console.error('[terms/accept] insert error:', insertErr);
    return NextResponse.json(
      { error: 'Failed to record acceptance' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    already_accepted: false,
    accepted_at: inserted.accepted_at,
    version,
  });
}
