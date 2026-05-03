import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same vocabulary as lead_notes, kept identical so the lead UI and the generic
// record UI render the same chips. Adjust both together if changing.
const VALID_CATEGORIES = ['general', 'meeting', 'follow_up', 'objection', 'decision'];
const MAX_BODY_LEN = 5000;

/** Resolve workspace_id for a given record + verify the user is a member.
 *  Returns null if the record doesn't exist or the user isn't a member —
 *  callers should treat both cases identically (don't leak existence). */
async function requireMembership(
  recordId: string,
  userId: string
): Promise<{ workspaceId: string; role: string } | null> {
  const admin = createAdminClient();
  const { data: rec } = await admin
    .from('records')
    .select('workspace_id')
    .eq('id', recordId)
    .single();
  if (!rec) return null;

  const { data: m } = await admin
    .from('workspace_members')
    .select('role, accepted_at')
    .eq('workspace_id', rec.workspace_id)
    .eq('user_id', userId)
    .single();
  if (!m || !m.accepted_at) return null;

  return { workspaceId: rec.workspace_id, role: m.role };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/records/[id]/note — create a note on a record
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const member = await requireMembership(params.id, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }
  // Only editor+ can write notes — same rule as lead_notes.
  if (!['owner', 'admin', 'editor'].includes(member.role)) {
    return NextResponse.json(
      { error: 'forbidden — note creation requires editor role' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const noteBody = String(body.body || '').trim();
  const category = String(body.category || 'general');

  if (!noteBody) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }
  if (noteBody.length > MAX_BODY_LEN) {
    return NextResponse.json(
      { error: `body must be ≤ ${MAX_BODY_LEN} characters` },
      { status: 400 }
    );
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: note, error } = await admin
    .from('record_notes')
    .insert({
      workspace_id: member.workspaceId,
      record_id: params.id,
      author_id: user.id,
      body: noteBody,
      category,
      is_pinned: false,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort activity log entry — don't fail the note creation if this
  // errors (RLS allows reads; writes only via service role, which we use here).
  await admin.from('record_activity_log').insert({
    workspace_id: member.workspaceId,
    record_id: params.id,
    actor_id: user.id,
    event_type: 'note_added',
    summary: noteBody.slice(0, 120),
    metadata: { note_id: note.id, category },
  });

  return NextResponse.json({ note });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/records/[id]/note — update pin or body/category
// Body: { note_id, is_pinned?, body?, category? }
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const member = await requireMembership(params.id, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const noteId = String(body.note_id || '');
  if (!noteId) {
    return NextResponse.json({ error: 'note_id required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('record_notes')
    .select('id, author_id, record_id')
    .eq('id', noteId)
    .single();
  if (!existing || existing.record_id !== params.id) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const updates: Record<string, any> = {};

  // Pin/unpin: any workspace member can do this.
  if (typeof body.is_pinned === 'boolean') {
    updates.is_pinned = body.is_pinned;
  }

  // Body/category edits: author only.
  const editingContent = body.body !== undefined || body.category !== undefined;
  if (editingContent) {
    if (existing.author_id !== user.id) {
      return NextResponse.json(
        { error: 'forbidden — only the author can edit a note' },
        { status: 403 }
      );
    }
    if (body.body !== undefined) {
      const newBody = String(body.body).trim();
      if (!newBody) {
        return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 });
      }
      if (newBody.length > MAX_BODY_LEN) {
        return NextResponse.json(
          { error: `body must be ≤ ${MAX_BODY_LEN} characters` },
          { status: 400 }
        );
      }
      updates.body = newBody;
    }
    if (body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(body.category)) {
        return NextResponse.json(
          { error: `category must be one of ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.category = body.category;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updates provided' }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from('record_notes')
    .update(updates)
    .eq('id', noteId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: updated });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/records/[id]/note?note_id=...
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const member = await requireMembership(params.id, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  const noteId = req.nextUrl.searchParams.get('note_id') || '';
  if (!noteId) {
    return NextResponse.json({ error: 'note_id required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('record_notes')
    .select('id, author_id, record_id')
    .eq('id', noteId)
    .single();
  if (!existing || existing.record_id !== params.id) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  // Author can always delete; owners/admins of the workspace can also delete.
  const canDelete =
    existing.author_id === user.id ||
    member.role === 'owner' ||
    member.role === 'admin';
  if (!canDelete) {
    return NextResponse.json(
      { error: 'forbidden — only the author or workspace admin can delete' },
      { status: 403 }
    );
  }

  const { error } = await admin.from('record_notes').delete().eq('id', noteId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
