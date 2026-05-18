// POST /api/forms
//
// Creates a new draft form attached to one of the workspace's tables.
// Returns the form so the client can navigate to the editor (PR #2).
//
// At this point we don't yet have a Builder UI, so the created form
// has no fields exposed. The owner can publish via SQL or via the
// PATCH endpoint that will ship in PR #2.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { generateSlug } from '@/lib/forms/types';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const tableId = typeof body.table_id === 'string' ? body.table_id : '';

  if (!title) {
    return NextResponse.json({ error: 'missing_title' }, { status: 400 });
  }
  if (!tableId) {
    return NextResponse.json({ error: 'missing_table' }, { status: 400 });
  }

  // Verify the table belongs to the user's workspace (RLS would catch
  // this but it's nicer to return a clear 403)
  const { data: table } = await supabase
    .from('tables')
    .select('id, workspace_id, name')
    .eq('id', tableId)
    .maybeSingle();

  if (!table || table.workspace_id !== ws.wsId) {
    return NextResponse.json({ error: 'invalid_table' }, { status: 403 });
  }

  // ---- Plan gating ----
  // Read plan_limits via the same admin client used elsewhere. If the
  // workspace already has max_forms forms, block the create.
  const admin = createAdminClient();

  const { data: planRow } = await admin
    .from('workspaces')
    .select('plan')
    .eq('id', ws.wsId)
    .maybeSingle();

  if (planRow?.plan) {
    const { data: limits } = await admin
      .from('plan_limits')
      .select('max_forms, feature_forms')
      .eq('plan', planRow.plan)
      .maybeSingle();

    if (limits && limits.feature_forms === false) {
      return NextResponse.json(
        {
          error: 'plan_disallowed',
          message: 'הפיצ׳ר אינו זמין בתוכנית הנוכחית. שדרגו ל-Starter ומעלה.',
        },
        { status: 403 },
      );
    }
    if (limits && typeof limits.max_forms === 'number') {
      const { count } = await admin
        .from('forms')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.wsId);
      if ((count ?? 0) >= limits.max_forms) {
        return NextResponse.json(
          {
            error: 'plan_limit_reached',
            message: `הגעת למקסימום הטפסים בתוכנית (${limits.max_forms}). שדרגו לתוכנית גבוהה יותר.`,
          },
          { status: 403 },
        );
      }
    }
  }

  // ---- Slug generation with collision handling ----
  // Base slug from title, then disambiguate with a numeric suffix if a
  // form with the same slug already exists in this workspace.
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const { data: existing } = await admin
      .from('forms')
      .select('id')
      .eq('workspace_id', ws.wsId)
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
    if (suffix > 100) break; // sanity
  }

  // ---- Insert the form (draft) ----
  const { data: form, error: insertErr } = await admin
    .from('forms')
    .insert({
      workspace_id: ws.wsId,
      table_id: tableId,
      slug,
      title,
      status: 'draft',
      hero_title: title,
      cta_label: 'התחל',
      thank_you_title: 'תודה!',
      notification_emails: [user.email].filter(Boolean) as string[],
      created_by: user.id,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: 'db_failed', message: insertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ form });
}
