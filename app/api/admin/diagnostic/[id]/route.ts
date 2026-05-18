// GET    /api/admin/diagnostic/[id]    full submission
// PATCH  /api/admin/diagnostic/[id]    update notes/reviewed
// DELETE /api/admin/diagnostic/[id]    delete (audit-safe — admin only)

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('diagnostic_submissions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'db_failed', details: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ submission: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await requirePlatformAdmin();
  const admin = createAdminClient();

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};

  if (typeof body.notes === 'string') {
    updates.notes = body.notes.slice(0, 5000);
  }
  if (body.mark_reviewed === true) {
    updates.reviewed_at = new Date().toISOString();
    updates.reviewed_by = user.id;
  }
  if (body.unmark_reviewed === true) {
    updates.reviewed_at = null;
    updates.reviewed_by = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('diagnostic_submissions')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'db_failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ submission: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from('diagnostic_submissions')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'db_failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
