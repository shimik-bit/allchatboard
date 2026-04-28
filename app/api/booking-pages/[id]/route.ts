import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = [
    'title', 'description', 'enabled', 'duration_minutes', 'buffer_minutes',
    'advance_notice_days', 'min_lead_time_hours', 'working_hours',
    'field_mapping', 'form_fields', 'confirmation_message',
  ];
  const update: any = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  // Slug change: validate uniqueness if provided
  if ('slug' in body) {
    const newSlug = String(body.slug).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(newSlug)) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from('booking_pages')
      .select('id')
      .eq('slug', newSlug)
      .neq('id', params.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: 'slug already taken' }, { status: 409 });
    update.slug = newSlug;
  }

  const { data, error } = await supabase
    .from('booking_pages')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase.from('booking_pages').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
