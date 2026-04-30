/**
 * PATCH /api/escalations/[id]
 *
 * Status transitions for an escalation. Supported actions:
 *   - 'take'    → status='in_progress', assigned_to_user_id=current user
 *   - 'resolve' → status='resolved',    resolved_by_user_id, resolved_at, resolution_note
 *   - 'dismiss' → status='dismissed',   resolved_by_user_id, resolved_at
 *
 * Body: { action: 'take' | 'resolve' | 'dismiss', note?: string }
 *
 * RLS handles auth: the user must be a workspace member (or agency-managed)
 * for the escalation's workspace. We don't double-check here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, note } = body as { action?: string; note?: string | null };

  // Build the patch based on action. We keep this declarative rather than
  // letting clients send arbitrary fields — protects against accidental
  // (or malicious) status flipping that bypasses the proper transition.
  let patch: Record<string, any> = {};
  switch (action) {
    case 'take':
      patch = {
        status: 'in_progress',
        assigned_to_user_id: user.id,
        assigned_at: new Date().toISOString(),
      };
      break;
    case 'resolve':
      patch = {
        status: 'resolved',
        resolved_by_user_id: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: note?.trim() || null,
      };
      break;
    case 'dismiss':
      patch = {
        status: 'dismissed',
        resolved_by_user_id: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: note?.trim() || null,
      };
      break;
    default:
      return NextResponse.json(
        { error: `invalid action: ${action}` },
        { status: 400 }
      );
  }

  const { data: updated, error } = await supabase
    .from('escalations')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, escalation: updated });
}
