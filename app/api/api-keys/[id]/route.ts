import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/api-keys/[id] - revoke (sets revoked_at, doesn't delete)
 * DELETE /api/api-keys/[id] - permanently delete
 *
 * Revoke is the safer option - keeps the audit trail.
 */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, workspace_id, revoked_at')
    .eq('id', params.id)
    .single();

  if (!key) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (key.revoked_at) return NextResponse.json({ error: 'already revoked' }, { status: 400 });

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase.from('api_keys').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
