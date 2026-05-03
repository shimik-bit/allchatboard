// app/api/crm/lead-note/route.ts
//
// CRUD for lead_notes from the customer-file UI.
//   POST   /api/crm/lead-note         body: { lead_id, body, category? }
//   PATCH  /api/crm/lead-note         body: { id, is_pinned?, body?, category? }
//   DELETE /api/crm/lead-note?id=...
//
// Auth: every operation re-checks that the caller is a member of the
// workspace that owns the lead. We do this even though lead_notes has RLS,
// because we use the admin client to do the actual write (RLS for INSERT
// on lead_notes is restrictive about author_id and we want to set it
// explicitly).
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_CATEGORIES = ['general', 'meeting', 'follow_up', 'objection', 'decision'];

async function requireMembership(leadId: string) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const admin = createAdminClient();

  // Resolve the lead's workspace via records→tables (records has table_id only).
  const { data: lead, error: leadErr } = await admin
    .from('records')
    .select('id, table_id, tables!inner(workspace_id, slug)')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return { error: NextResponse.json({ error: 'Lead not found' }, { status: 404 }) };
  }

  const tbl: any = (lead as any).tables;
  if (!tbl || tbl.slug !== 'leads') {
    return { error: NextResponse.json({ error: 'Not a lead' }, { status: 400 }) };
  }

  const workspaceId: string = tbl.workspace_id;

  const { data: membership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .not('accepted_at', 'is', null)
    .maybeSingle();

  if (!membership) {
    // Don't disclose whether the lead exists in another workspace.
    return { error: NextResponse.json({ error: 'Lead not found' }, { status: 404 }) };
  }

  return { user, admin, workspaceId };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lead_id, body: noteBody, category } = body;

    if (!lead_id || typeof noteBody !== 'string' || !noteBody.trim()) {
      return NextResponse.json({ error: 'lead_id and body are required' }, { status: 400 });
    }
    const trimmed = noteBody.trim();
    if (trimmed.length > 5000) {
      return NextResponse.json({ error: 'Note too long (max 5000 chars)' }, { status: 400 });
    }
    const cat = VALID_CATEGORIES.includes(category) ? category : 'general';

    const { error: authErr, user, admin, workspaceId } = await requireMembership(lead_id) as any;
    if (authErr) return authErr;

    const { data: inserted, error: insErr } = await admin
      .from('lead_notes')
      .insert({
        workspace_id: workspaceId,
        lead_id,
        author_id: user.id,
        body: trimmed,
        category: cat,
        is_pinned: false,
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ error: insErr?.message || 'Insert failed' }, { status: 500 });
    }

    // Best-effort activity log entry. If the table has a different schema we
    // simply skip — never fail the user-visible action because of an audit miss.
    await admin.from('lead_activity_log').insert({
      workspace_id: workspaceId,
      lead_id,
      actor_id: user.id,
      event_type: 'note_added',
      summary: `הערה נוספה (${cat})`,
      metadata: { note_id: inserted.id },
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, note: { id: inserted.id } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, is_pinned, body: newBody, category } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: note } = await admin
      .from('lead_notes')
      .select('id, lead_id, workspace_id, author_id')
      .eq('id', id)
      .maybeSingle();

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const { data: membership } = await admin
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', note.workspace_id)
      .not('accepted_at', 'is', null)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const updates: Record<string, any> = {};
    if (typeof is_pinned === 'boolean') updates.is_pinned = is_pinned;
    if (typeof newBody === 'string' && newBody.trim() && note.author_id === user.id) {
      const trimmed = newBody.trim();
      if (trimmed.length > 5000) {
        return NextResponse.json({ error: 'Note too long (max 5000 chars)' }, { status: 400 });
      }
      updates.body = trimmed;
    }
    if (typeof category === 'string' && VALID_CATEGORIES.includes(category) && note.author_id === user.id) {
      updates.category = category;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { error: updErr } = await admin
      .from('lead_notes')
      .update(updates)
      .eq('id', id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: note } = await admin
      .from('lead_notes')
      .select('id, lead_id, workspace_id, author_id')
      .eq('id', id)
      .maybeSingle();

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const { data: membership } = await admin
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', note.workspace_id)
      .not('accepted_at', 'is', null)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    // Only the author or workspace admins can delete.
    const isAdmin = (membership as any).role === 'owner' || (membership as any).role === 'admin';
    if (note.author_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: delErr } = await admin
      .from('lead_notes')
      .delete()
      .eq('id', id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
