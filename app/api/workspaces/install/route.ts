import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/install
 *
 * Installs tables into a workspace from one of these sources:
 *   { workspace_id, source: 'package', package_slug }
 *   { workspace_id, source: 'template', template_vertical }
 *   { workspace_id, source: 'package_table', package_slug, table_slug }
 *   { workspace_id, source: 'template_table', template_vertical, table_slug }
 *
 * Returns the IDs of the newly created tables.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, source } = body;

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify user is owner/admin
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'forbidden - admin/owner only' }, { status: 403 });
  }

  // Load the spec from the appropriate source
  let tablesToCreate: any[] = [];
  let sourcePackageId: string | null = null;
  let sourceTemplateId: string | null = null;

  if (source === 'package' || source === 'package_table') {
    const { data: pkg } = await supabase
      .from('table_packages')
      .select('id, structure')
      .eq('slug', body.package_slug)
      .single();
    if (!pkg) return NextResponse.json({ error: 'package not found' }, { status: 404 });
    sourcePackageId = pkg.id;
    tablesToCreate = (pkg.structure as any)?.tables || [];
    if (source === 'package_table') {
      tablesToCreate = tablesToCreate.filter((t: any) => t.slug === body.table_slug);
      if (tablesToCreate.length === 0) {
        return NextResponse.json({ error: 'table_slug not found in package' }, { status: 404 });
      }
    }
  } else if (source === 'template' || source === 'template_table') {
    const { data: tpl } = await supabase
      .from('templates')
      .select('id, structure')
      .eq('vertical', body.template_vertical)
      .single();
    if (!tpl) return NextResponse.json({ error: 'template not found' }, { status: 404 });
    sourceTemplateId = tpl.id;
    tablesToCreate = (tpl.structure as any)?.tables || [];
    if (source === 'template_table') {
      tablesToCreate = tablesToCreate.filter((t: any) => t.slug === body.table_slug);
      if (tablesToCreate.length === 0) {
        return NextResponse.json({ error: 'table_slug not found in template' }, { status: 404 });
      }
    }
  } else {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 });
  }

  if (tablesToCreate.length === 0) {
    return NextResponse.json({ error: 'no tables to create' }, { status: 400 });
  }

  // Get current position offset (last position in workspace tables)
  const { data: existingTables } = await supabase
    .from('tables')
    .select('position, slug')
    .eq('workspace_id', workspace_id);
  const existingSlugs = new Set((existingTables || []).map((t) => t.slug));
  const startPos = (existingTables || []).reduce((max, t) => Math.max(max, t.position || 0), -1) + 1;

  const created: { id: string; name: string; slug: string }[] = [];
  const skipped: { name: string; slug: string; reason: string }[] = [];

  for (let i = 0; i < tablesToCreate.length; i++) {
    const tableSpec = tablesToCreate[i];

    // Skip if a table with the same slug already exists in workspace
    if (existingSlugs.has(tableSpec.slug)) {
      skipped.push({ name: tableSpec.name, slug: tableSpec.slug, reason: 'already exists' });
      continue;
    }

    // Insert table
    const { data: tbl, error: tblErr } = await supabase
      .from('tables')
      .insert({
        workspace_id,
        name: tableSpec.name,
        slug: tableSpec.slug,
        icon: tableSpec.icon || null,
        color: tableSpec.color || null,
        ai_keywords: tableSpec.ai_keywords || [],
        position: startPos + i,
        source_package_id: sourcePackageId,
        source_template_id: sourceTemplateId,
      })
      .select('id, name, slug')
      .single();

    if (tblErr || !tbl) {
      skipped.push({ name: tableSpec.name, slug: tableSpec.slug, reason: tblErr?.message || 'create failed' });
      continue;
    }

    // Insert fields
    const fields = (tableSpec.fields || []).map((f: any, idx: number) => ({
      table_id: tbl.id,
      workspace_id,
      name: f.name,
      slug: f.slug,
      type: f.type,
      is_primary: !!f.is_primary,
      is_required: !!f.is_required,
      config: f.config || {},
      ai_extraction_hint: f.ai_extraction_hint || null,
      position: idx,
    }));

    if (fields.length > 0) {
      const { error: fieldsErr } = await supabase.from('fields').insert(fields);
      if (fieldsErr) {
        // Roll back the table if fields failed
        await supabase.from('tables').delete().eq('id', tbl.id);
        skipped.push({ name: tableSpec.name, slug: tableSpec.slug, reason: 'fields creation failed' });
        continue;
      }
    }

    created.push(tbl);
  }

  return NextResponse.json({
    success: true,
    created,
    skipped,
    summary: `נוצרו ${created.length} טבלאות${skipped.length > 0 ? `, ${skipped.length} דולגו` : ''}`,
  });
}
