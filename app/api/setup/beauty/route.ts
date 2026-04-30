/**
 * POST /api/setup/beauty
 *
 * Installs the Beauty vertical template into the user's currently-active
 * workspace. Creates 3 tables (clients, appointments, services) with
 * vertical-appropriate fields, and seeds them with example data so the
 * dashboard isn't empty on first view.
 *
 * Idempotent: if the tables already exist (slug match), they're skipped
 * and only missing ones are created. Re-running won't duplicate seed data
 * because we only seed when we just created the table.
 *
 * Auth: must be a member of the target workspace with role owner/admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_WS_COOKIE = 'tf_active_workspace';

export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Get active workspace from cookie
  const workspaceId = cookies().get(ACTIVE_WS_COOKIE)?.value;
  if (!workspaceId) {
    return NextResponse.json({ error: 'no active workspace' }, { status: 400 });
  }

  // Verify membership + role
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, workspaces(vertical)')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'only owners and admins can install templates' },
      { status: 403 }
    );
  }

  const ws = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
  if ((ws as any)?.vertical !== 'beauty') {
    return NextResponse.json(
      { error: 'workspace is not a beauty vertical' },
      { status: 400 }
    );
  }

  // Use admin client for the actual install — the seed data needs to bypass
  // any user-restricting RLS during bulk insert.
  const admin = createAdminClient();

  // Check what already exists so we're idempotent
  const { data: existingTables } = await admin
    .from('tables')
    .select('id, slug')
    .eq('workspace_id', workspaceId)
    .in('slug', ['beauty_clients', 'beauty_appointments', 'beauty_services']);

  const existingSlugs = new Set((existingTables || []).map((t: any) => t.slug));
  const created: string[] = [];
  const skipped: string[] = [];

  // ===== Table 1: Clients =====
  let clientsTableId: string | null = null;
  if (!existingSlugs.has('beauty_clients')) {
    const { data: clientsTable, error: clientsErr } = await admin
      .from('tables')
      .insert({
        workspace_id: workspaceId,
        name: 'לקוחות',
        slug: 'beauty_clients',
        icon: '💖',
        description: 'רשימת הלקוחות שלך',
        position: 0,
        ai_keywords: ['לקוח', 'לקוחה', 'client', 'customer'],
      })
      .select('id')
      .single();

    if (clientsErr || !clientsTable) {
      return NextResponse.json(
        { error: `failed to create clients table: ${clientsErr?.message}` },
        { status: 500 }
      );
    }
    clientsTableId = clientsTable.id;

    await createFields(admin, clientsTableId!, workspaceId, [
      { name: 'שם', slug: 'name', type: 'text', is_required: true },
      { name: 'טלפון', slug: 'phone', type: 'phone' },
      { name: 'אימייל', slug: 'email', type: 'email' },
      { name: 'יום הולדת', slug: 'birthday', type: 'date' },
      { name: 'מספר ביקורים', slug: 'visits', type: 'number' },
      { name: 'הערות', slug: 'notes', type: 'long_text' },
    ]);

    created.push('beauty_clients');
  } else {
    clientsTableId = existingTables!.find((t: any) => t.slug === 'beauty_clients')!.id;
    skipped.push('beauty_clients');
  }

  // ===== Table 2: Appointments =====
  let appointmentsTableId: string | null = null;
  if (!existingSlugs.has('beauty_appointments')) {
    const { data: aptTable, error: aptErr } = await admin
      .from('tables')
      .insert({
        workspace_id: workspaceId,
        name: 'פגישות',
        slug: 'beauty_appointments',
        icon: '📅',
        description: 'פגישות מתוזמנות',
        position: 1,
        ai_keywords: ['פגישה', 'תור', 'appointment', 'booking'],
      })
      .select('id')
      .single();

    if (aptErr || !aptTable) {
      return NextResponse.json(
        { error: `failed to create appointments table: ${aptErr?.message}` },
        { status: 500 }
      );
    }
    appointmentsTableId = aptTable.id;

    await createFields(admin, appointmentsTableId!, workspaceId, [
      { name: 'שם הלקוחה', slug: 'client_name', type: 'text', is_required: true },
      { name: 'שירות', slug: 'service', type: 'text', is_required: true },
      { name: 'תאריך', slug: 'date', type: 'date', is_required: true },
      { name: 'שעה', slug: 'time', type: 'text' },
      { name: 'משך (דק׳)', slug: 'duration', type: 'number' },
      { name: 'מחיר (₪)', slug: 'price', type: 'currency' },
      {
        name: 'סטטוס',
        slug: 'status',
        type: 'select',
        config: {
          options: [
            { value: 'confirmed', label: 'מאושר', color: '#10b981' },
            { value: 'completed', label: 'בוצע', color: '#3b82f6' },
            { value: 'cancelled', label: 'בוטל', color: '#6b7280' },
            { value: 'no_show', label: 'לא הגיעה', color: '#ef4444' },
          ],
        },
      },
      { name: 'הערות', slug: 'notes', type: 'long_text' },
    ]);

    created.push('beauty_appointments');
  } else {
    appointmentsTableId = existingTables!.find((t: any) => t.slug === 'beauty_appointments')!.id;
    skipped.push('beauty_appointments');
  }

  // ===== Table 3: Services =====
  let servicesTableId: string | null = null;
  if (!existingSlugs.has('beauty_services')) {
    const { data: svcTable, error: svcErr } = await admin
      .from('tables')
      .insert({
        workspace_id: workspaceId,
        name: 'שירותים',
        slug: 'beauty_services',
        icon: '✨',
        description: 'קטלוג השירותים שלך',
        position: 2,
        ai_keywords: ['שירות', 'טיפול', 'service', 'treatment'],
      })
      .select('id')
      .single();

    if (svcErr || !svcTable) {
      return NextResponse.json(
        { error: `failed to create services table: ${svcErr?.message}` },
        { status: 500 }
      );
    }
    servicesTableId = svcTable.id;

    await createFields(admin, servicesTableId!, workspaceId, [
      { name: 'שם השירות', slug: 'name', type: 'text', is_required: true },
      { name: 'קטגוריה', slug: 'category', type: 'text' },
      { name: 'משך (דק׳)', slug: 'duration', type: 'number' },
      { name: 'מחיר בסיס (₪)', slug: 'price', type: 'currency' },
      { name: 'תיאור', slug: 'description', type: 'long_text' },
    ]);

    // Seed common beauty services so the catalog isn't empty
    await admin.from('records').insert([
      {
        workspace_id: workspaceId,
        table_id: servicesTableId,
        data: { name: 'פדיקור לק ג׳ל', category: 'ציפורניים', duration: 45, price: 220 },
      },
      {
        workspace_id: workspaceId,
        table_id: servicesTableId,
        data: { name: 'מניקור רגיל', category: 'ציפורניים', duration: 30, price: 100 },
      },
      {
        workspace_id: workspaceId,
        table_id: servicesTableId,
        data: { name: 'איפור ערב', category: 'איפור', duration: 60, price: 280 },
      },
      {
        workspace_id: workspaceId,
        table_id: servicesTableId,
        data: { name: 'איפור כלות', category: 'איפור', duration: 90, price: 450 },
      },
      {
        workspace_id: workspaceId,
        table_id: servicesTableId,
        data: { name: 'עיצוב גבות עם חוט', category: 'גבות', duration: 30, price: 80 },
      },
      {
        workspace_id: workspaceId,
        table_id: servicesTableId,
        data: { name: 'טיפול פנים מתקדם', category: 'פנים', duration: 60, price: 280 },
      },
    ]);

    created.push('beauty_services');
  } else {
    skipped.push('beauty_services');
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
  });
}

/**
 * Helper to bulk-create fields for a new table.
 * Mirrors the logic in /api/tables/[id]/fields but skips validation for
 * known-good template fields.
 */
async function createFields(
  admin: ReturnType<typeof createAdminClient>,
  tableId: string,
  workspaceId: string,
  fields: Array<{
    name: string;
    slug: string;
    type: string;
    is_required?: boolean;
    config?: any;
  }>
): Promise<void> {
  const rows = fields.map((f, idx) => ({
    table_id: tableId,
    workspace_id: workspaceId,
    name: f.name,
    slug: f.slug,
    type: f.type,
    is_required: !!f.is_required,
    config: f.config || {},
    position: idx,
  }));
  await admin.from('fields').insert(rows);
}
