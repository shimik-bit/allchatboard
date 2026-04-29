import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/saved-filters/[id]
 *
 * Body: any subset of { name, filters, icon, is_pinned, position }
 *
 * Updates a saved filter. RLS enforces ownership.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const updates: any = {};

  // Whitelist updatable fields
  if (typeof body.name === 'string') updates.name = body.name.trim().slice(0, 80);
  if (body.filters && typeof body.filters === 'object') updates.filters = body.filters;
  if ('icon' in body) updates.icon = body.icon || null;
  if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned;
  if (typeof body.position === 'number') updates.position = body.position;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_filters')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'כבר יש לך פילטר בשם הזה. בחר שם אחר.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filter: data });
}

/**
 * DELETE /api/saved-filters/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('saved_filters')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
