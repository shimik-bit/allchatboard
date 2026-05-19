// GET    /api/forms/[slug]    - fetch one form + its table's fields
// PATCH  /api/forms/[slug]    - update form properties / field settings
// DELETE /api/forms/[slug]    - delete form (records remain in table)
//
// All three require workspace membership; RLS enforces scoping.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import type { FormRow } from '@/lib/forms/types';

// ----------------------------------------------------------------------------
// GET — fetch form + table fields, so the builder has everything in one call
// ----------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) return NextResponse.json({ error: 'no_workspace' }, { status: 400 });

  const { data: form } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', params.slug)
    .eq('workspace_id', ws.wsId)
    .maybeSingle();

  if (!form) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, slug, type, is_required, is_primary, position, config')
    .eq('table_id', (form as FormRow).table_id)
    .order('position', { ascending: true });

  return NextResponse.json({ form, fields: fields ?? [] });
}

// ----------------------------------------------------------------------------
// PATCH — partial update. Whitelist columns to prevent setting things like
//         workspace_id, table_id, or stats counters.
// ----------------------------------------------------------------------------
const PATCHABLE_COLUMNS = new Set([
  'title',
  'description',
  'status',
  'field_settings',
  'sections',
  'theme',
  'brand_color',
  'logo_url',
  'hero_title',
  'hero_subtitle',
  'cta_label',
  'thank_you_title',
  'thank_you_message',
  'success_redirect_url',
  'notification_emails',
  'show_progress_bar',
  'allow_multiple_submissions',
  'require_phone',
  'require_email',
  'whatsapp_automation',
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) return NextResponse.json({ error: 'no_workspace' }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  const update: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (PATCHABLE_COLUMNS.has(key)) update[key] = value;
  }

  if (update.status && !['draft', 'published', 'archived'].includes(update.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  if (update.status === 'published' && !body.published_at) {
    update.published_at = new Date().toISOString();
  }
  if (update.status === 'archived' && !body.archived_at) {
    update.archived_at = new Date().toISOString();
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('forms')
    .select('id, workspace_id, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!existing || existing.workspace_id !== ws.wsId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: form, error } = await admin
    .from('forms')
    .update(update)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'db_failed', message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ form });
}

// ----------------------------------------------------------------------------
// DELETE — remove the form. Records in the underlying table stay intact.
// ----------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) return NextResponse.json({ error: 'no_workspace' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('forms')
    .select('id, workspace_id')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!existing || existing.workspace_id !== ws.wsId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await admin.from('forms').delete().eq('id', existing.id);
  if (error) {
    return NextResponse.json(
      { error: 'db_failed', message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
