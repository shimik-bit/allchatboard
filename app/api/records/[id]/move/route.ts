import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyFieldMapping } from '@/lib/automations/field-mapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/records/[id]/move
 *
 * Body:
 *   {
 *     target_table_id: string,
 *     field_mapping: { source_slug: target_slug | null },
 *     source_action: 'keep' | 'mark_converted' | 'archive' | 'delete',
 *     create_link: boolean (default true)
 *   }
 *
 * Returns: { new_record_id, new_table_id }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { target_table_id, field_mapping, source_action = 'mark_converted', create_link = true } = body;

  if (!target_table_id || !field_mapping) {
    return NextResponse.json({ error: 'target_table_id and field_mapping are required' }, { status: 400 });
  }

  // 1. Fetch source record
  const { data: source, error: sourceErr } = await supabase
    .from('records')
    .select('id, table_id, workspace_id, data, conversion_links, source')
    .eq('id', params.id)
    .single();

  if (sourceErr || !source) {
    return NextResponse.json({ error: 'source record not found' }, { status: 404 });
  }

  // 2. Verify target table is in same workspace
  const { data: targetTable } = await supabase
    .from('tables')
    .select('id, workspace_id, default_assignee_phone_id')
    .eq('id', target_table_id)
    .single();

  if (!targetTable) {
    return NextResponse.json({ error: 'target table not found' }, { status: 404 });
  }
  if (targetTable.workspace_id !== source.workspace_id) {
    return NextResponse.json({ error: 'cross-workspace move not allowed' }, { status: 403 });
  }

  // 3. Apply mapping → produce target data
  const mappedData = applyFieldMapping(source.data || {}, field_mapping);

  // 4. Create the new record in target table
  const { data: newRecord, error: createErr } = await supabase
    .from('records')
    .insert({
      table_id: target_table_id,
      workspace_id: source.workspace_id,
      data: mappedData,
      source: 'manual',
      assignee_phone_id: targetTable.default_assignee_phone_id || null,
      conversion_links: create_link
        ? {
            originated_from: {
              table_id: source.table_id,
              record_id: source.id,
              at: new Date().toISOString(),
            },
          }
        : {},
    })
    .select('id, table_id, data, created_at')
    .single();

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  // 5. Update source record based on source_action
  if (source_action === 'delete') {
    await supabase.from('records').delete().eq('id', source.id);
  } else if (source_action === 'archive' || source_action === 'mark_converted') {
    const updates: any = {};

    // Add cross-reference link
    if (create_link) {
      updates.conversion_links = {
        ...(source.conversion_links || {}),
        converted_to: {
          table_id: target_table_id,
          record_id: newRecord.id,
          at: new Date().toISOString(),
        },
      };
    }

    // For mark_converted, also add a status note in the data if there's a status field
    if (source_action === 'mark_converted') {
      // Try to find a status field and update it; fallback: add _converted_marker field
      const { data: sourceFields } = await supabase
        .from('fields')
        .select('slug, type')
        .eq('table_id', source.table_id);

      const statusField = sourceFields?.find((f: any) => f.type === 'status' || f.slug === 'status');
      if (statusField) {
        updates.data = { ...source.data, [statusField.slug]: 'converted' };
      } else {
        updates.data = { ...source.data, _converted: true };
      }
    } else if (source_action === 'archive') {
      updates.data = { ...source.data, _archived: true };
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('records').update(updates).eq('id', source.id);
    }
  }
  // 'keep' = do nothing to source

  return NextResponse.json({
    new_record_id: newRecord.id,
    new_table_id: target_table_id,
    new_record_url: `/dashboard/${target_table_id}`,
    source_action_applied: source_action,
  }, { status: 201 });
}
