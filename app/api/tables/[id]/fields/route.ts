import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/tables/[id]/fields
 *   List all fields for the table.
 *
 * POST /api/tables/[id]/fields
 *   Body: { name, slug, type, is_required?, config?, ai_extraction_hint? }
 *   Add a new field to the table. Editor permissions required.
 *
 * PATCH /api/tables/[id]/fields
 *   Body: { field_id, ...patch }
 *   Update an existing field's properties.
 *
 * DELETE /api/tables/[id]/fields?field_id=xxx
 *   Remove a field. Note: existing record data is NOT cleaned up — kept for safety.
 */

const VALID_FIELD_TYPES = [
  'text', 'longtext', 'number', 'currency', 'date', 'datetime',
  'select', 'multiselect', 'checkbox', 'phone', 'email', 'url',
  'user', 'attachment', 'rating', 'status', 'relation', 'city',
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\u0590-\u05FF]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'field_' + Date.now();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: fields, error } = await supabase
    .from('fields')
    .select('*')
    .eq('table_id', params.id)
    .order('position');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fields });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, slug: providedSlug, type, is_required, config, ai_extraction_hint } = body;

  // Validation
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!VALID_FIELD_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_FIELD_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Get the table to extract workspace_id
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('id, workspace_id')
    .eq('id', params.id)
    .single();

  if (tableErr || !table) {
    return NextResponse.json({ error: 'table not found' }, { status: 404 });
  }

  // For relation fields, validate that target table exists in same workspace
  let validatedConfig = config || {};
  if (type === 'relation') {
    if (!validatedConfig.relation_table_id) {
      return NextResponse.json(
        { error: 'relation field requires config.relation_table_id' },
        { status: 400 }
      );
    }
    const { data: relTable } = await supabase
      .from('tables')
      .select('id')
      .eq('id', validatedConfig.relation_table_id)
      .eq('workspace_id', table.workspace_id)
      .single();
    if (!relTable) {
      return NextResponse.json(
        { error: 'relation_table_id must reference a table in same workspace' },
        { status: 400 }
      );
    }
    // Default display_columns to single primary if not provided
    if (!validatedConfig.display_columns || !Array.isArray(validatedConfig.display_columns)) {
      validatedConfig.display_columns = validatedConfig.display_field
        ? [validatedConfig.display_field]
        : [];
    }
    // Limit to 3 display columns
    if (validatedConfig.display_columns.length > 3) {
      validatedConfig.display_columns = validatedConfig.display_columns.slice(0, 3);
    }
  }

  // Get next position
  const { data: existingFields } = await supabase
    .from('fields')
    .select('position')
    .eq('table_id', params.id)
    .order('position', { ascending: false })
    .limit(1);
  const nextPos = (existingFields?.[0]?.position ?? -1) + 1;

  const slug = providedSlug || slugify(name);

  const { data: field, error: insertErr } = await supabase
    .from('fields')
    .insert({
      table_id: params.id,
      workspace_id: table.workspace_id,
      name,
      slug,
      type,
      is_required: !!is_required,
      config: validatedConfig,
      ai_extraction_hint: ai_extraction_hint || null,
      position: nextPos,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ field });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { field_id, name, is_required, config, ai_extraction_hint, position } = body;

  if (!field_id) {
    return NextResponse.json({ error: 'field_id required' }, { status: 400 });
  }

  // Verify field belongs to this table
  const { data: existing } = await supabase
    .from('fields')
    .select('id, table_id, type, config')
    .eq('id', field_id)
    .eq('table_id', params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'field not found' }, { status: 404 });
  }

  const patch: any = {};
  if (name !== undefined) patch.name = name;
  if (is_required !== undefined) patch.is_required = !!is_required;
  if (ai_extraction_hint !== undefined) patch.ai_extraction_hint = ai_extraction_hint || null;
  if (position !== undefined) patch.position = position;

  if (config !== undefined) {
    // For relation fields, enforce 3-column max
    if (existing.type === 'relation' && config.display_columns) {
      config.display_columns = config.display_columns.slice(0, 3);
    }
    patch.config = config;
  }

  const { data: field, error } = await supabase
    .from('fields')
    .update(patch)
    .eq('id', field_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const field_id = searchParams.get('field_id');
  if (!field_id) {
    return NextResponse.json({ error: 'field_id query param required' }, { status: 400 });
  }

  // Block deleting primary fields
  const { data: existing } = await supabase
    .from('fields')
    .select('is_primary, table_id')
    .eq('id', field_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'field not found' }, { status: 404 });
  }
  if (existing.table_id !== params.id) {
    return NextResponse.json({ error: 'field does not belong to this table' }, { status: 400 });
  }
  if (existing.is_primary) {
    return NextResponse.json({ error: 'cannot delete primary field' }, { status: 400 });
  }

  const { error } = await supabase.from('fields').delete().eq('id', field_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
