import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/records/merge
 *
 * Merge 2+ duplicate records in the same table into a single primary record.
 *
 * Body:
 *   {
 *     primary_id:    string,    // record to keep
 *     duplicate_ids: string[],  // records to merge into primary, then delete
 *     merged_data:   object,    // the final `data` jsonb for the primary
 *                               //   (the client computes this preview using
 *                               //    previewMergedData() and lets the user
 *                               //    tweak it before sending)
 *   }
 *
 * Authorization:
 *   - All records must be in the same workspace + table
 *   - User must be owner / admin / editor of the workspace
 *
 * Side effects on success:
 *   - primary.data       ← merged_data
 *   - primary.notes      ← primary.notes + duplicates' notes (newline-separated)
 *   - primary.updated_at ← now()
 *   - primary.last_updated_by ← user.id
 *   - duplicates are deleted
 *
 * Returns: { merged_record, deleted_count }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { primary_id, duplicate_ids, merged_data } = body || {};

  // ----- Input validation -----
  if (typeof primary_id !== 'string' || !primary_id) {
    return NextResponse.json({ error: 'primary_id required' }, { status: 400 });
  }
  if (!Array.isArray(duplicate_ids) || duplicate_ids.length === 0) {
    return NextResponse.json(
      { error: 'duplicate_ids[] required (at least 1)' },
      { status: 400 }
    );
  }
  if (duplicate_ids.length > 20) {
    return NextResponse.json(
      { error: 'cannot merge more than 20 records at once' },
      { status: 400 }
    );
  }
  if (duplicate_ids.includes(primary_id)) {
    return NextResponse.json(
      { error: 'primary_id cannot also appear in duplicate_ids' },
      { status: 400 }
    );
  }
  if (
    !merged_data ||
    typeof merged_data !== 'object' ||
    Array.isArray(merged_data)
  ) {
    return NextResponse.json(
      { error: 'merged_data must be an object' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const allIds = [primary_id, ...duplicate_ids];

  // ----- Load all records to verify workspace + table consistency -----
  const { data: records, error: loadError } = await admin
    .from('records')
    .select('id, workspace_id, table_id, data, notes, source, source_phone, conversion_links, ai_metadata')
    .in('id', allIds);

  if (loadError) {
    return NextResponse.json(
      { error: 'failed to load records: ' + loadError.message },
      { status: 500 }
    );
  }
  if (!records || records.length !== allIds.length) {
    return NextResponse.json(
      { error: 'one or more records not found' },
      { status: 404 }
    );
  }

  // All records must belong to the same workspace + table.
  const workspaceIds = new Set(records.map((r: any) => r.workspace_id));
  const tableIds = new Set(records.map((r: any) => r.table_id));
  if (workspaceIds.size > 1) {
    return NextResponse.json(
      { error: 'all records must be in the same workspace' },
      { status: 400 }
    );
  }
  if (tableIds.size > 1) {
    return NextResponse.json(
      { error: 'all records must be in the same table' },
      { status: 400 }
    );
  }
  const workspaceId = [...workspaceIds][0];

  // ----- Authorization: user must be editor+ in this workspace -----
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const role = membership.role;
  const canEdit = role === 'owner' || role === 'admin' || role === 'editor';
  if (!canEdit) {
    return NextResponse.json(
      { error: 'merge requires editor / admin / owner role' },
      { status: 403 }
    );
  }

  // ----- Build the merged primary -----
  const primary = records.find((r: any) => r.id === primary_id) as any;
  const duplicates = records.filter((r: any) => r.id !== primary_id) as any[];

  // Concatenate notes: primary's notes first, then any non-empty duplicate notes,
  // each on its own line. Avoid double-blank lines.
  const noteParts: string[] = [];
  if (primary.notes && primary.notes.trim()) noteParts.push(primary.notes.trim());
  for (const d of duplicates) {
    if (d.notes && d.notes.trim() && !noteParts.includes(d.notes.trim())) {
      noteParts.push(d.notes.trim());
    }
  }
  const mergedNotes = noteParts.length ? noteParts.join('\n---\n') : null;

  // Merge conversion_links arrays (deduped by href if present, else by stringify)
  const mergedLinks: any[] = [];
  const linkSeen = new Set<string>();
  for (const r of records) {
    const links = Array.isArray(r.conversion_links) ? r.conversion_links : [];
    for (const l of links) {
      const key =
        typeof l === 'object' && l && 'href' in l
          ? String((l as any).href)
          : JSON.stringify(l);
      if (!linkSeen.has(key)) {
        linkSeen.add(key);
        mergedLinks.push(l);
      }
    }
  }

  // ----- Apply the merge as 2 operations: update primary, delete dupes -----
  const { data: updated, error: updateError } = await admin
    .from('records')
    .update({
      data: merged_data,
      notes: mergedNotes,
      conversion_links: mergedLinks.length ? mergedLinks : null,
      last_updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', primary_id)
    .select('*, authorized_phones:authorized_phone_id(display_name, job_title), assignee:assignee_phone_id(display_name, job_title)')
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: 'failed to update primary: ' + updateError.message },
      { status: 500 }
    );
  }

  // Delete duplicates. If this fails AFTER the update, the primary is already
  // merged but duplicates still exist — the UI will detect this on next render
  // (same phone shows up again) and offer to re-merge. We log the partial state.
  const { error: deleteError } = await admin
    .from('records')
    .delete()
    .in('id', duplicate_ids);

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          'primary updated but failed to delete duplicates: ' +
          deleteError.message,
        partial: true,
        merged_record: updated,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    merged_record: updated,
    deleted_count: duplicate_ids.length,
  });
}
