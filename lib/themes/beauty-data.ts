/**
 * Beauty dashboard data loader
 *
 * Fetches the data needed by the BeautyDashboard component from
 * the workspace's tables. If the beauty templates haven't been
 * installed yet, returns hasBeautyTables=false so the UI can
 * show the setup CTA instead of empty data.
 *
 * Looks for tables with these slugs (created by the beauty template):
 *   - 'beauty_clients'        - the client/customer list
 *   - 'beauty_appointments'   - scheduled appointments
 *   - 'beauty_services'       - service catalog (used for revenue calc)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BeautyDashboardData } from '@/components/dashboards/BeautyDashboard';

export async function loadBeautyDashboardData(
  supabase: SupabaseClient,
  workspaceId: string,
  userName: string,
  workspaceName: string
): Promise<BeautyDashboardData> {
  // Find the beauty tables for this workspace
  const { data: tables } = await supabase
    .from('tables')
    .select('id, slug')
    .eq('workspace_id', workspaceId)
    .in('slug', ['beauty_clients', 'beauty_appointments', 'beauty_services']);

  const tableMap = new Map((tables || []).map((t) => [t.slug, t.id]));
  const clientsTableId = tableMap.get('beauty_clients');
  const appointmentsTableId = tableMap.get('beauty_appointments');

  const hasBeautyTables = !!(clientsTableId && appointmentsTableId);

  if (!hasBeautyTables) {
    // Workspace exists but template not installed yet — return empty shell
    return {
      userName,
      workspaceName,
      appointmentsToday: [],
      upcomingBirthdays: [],
      stats: {
        clientCount: 0,
        appointmentsThisWeek: 0,
        revenueThisMonth: 0,
        averageRating: null,
      },
      hasBeautyTables: false,
    };
  }

  // ===== Today's appointments =====
  // Match records where the appointment_date (or scheduled_at) field is today
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayRecords } = await supabase
    .from('records')
    .select('id, data')
    .eq('table_id', appointmentsTableId)
    .or(
      `data->>appointment_date.eq.${todayStr},data->>date.eq.${todayStr},data->>scheduled_at.gte.${todayStr}T00:00:00,data->>scheduled_at.lt.${todayStr}T23:59:59`
    )
    .order('data->>time', { ascending: true })
    .limit(10);

  const appointmentsToday = (todayRecords || []).map((r: any) => ({
    id: r.id,
    time: r.data?.time || r.data?.start_time || '—',
    clientName: r.data?.client_name || r.data?.customer_name || 'לקוחה',
    service: r.data?.service || r.data?.service_name || 'טיפול',
    duration: r.data?.duration ? `${r.data.duration} דק׳` : '60 דק׳',
    price: r.data?.price ? `₪${r.data.price}` : undefined,
  }));

  // ===== Upcoming birthdays (next 7 days) =====
  // For now this is a stub — real implementation would compute from
  // clients.data->>birthday with month-day matching. Keeping it simple
  // for the MVP demo so we have something to show.
  const upcomingBirthdays: any[] = [];

  // ===== Stats =====
  const { count: clientCount } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', clientsTableId);

  // Appointments this week (Sunday → Saturday in Israel)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const { count: appointmentsThisWeek } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', appointmentsTableId)
    .gte('created_at', startOfWeek.toISOString())
    .lt('created_at', endOfWeek.toISOString());

  return {
    userName,
    workspaceName,
    appointmentsToday,
    upcomingBirthdays,
    stats: {
      clientCount: clientCount || 0,
      appointmentsThisWeek: appointmentsThisWeek || 0,
      revenueThisMonth: 0, // TODO: compute from completed appointments
      averageRating: null, // TODO: compute from reviews/ratings if present
    },
    hasBeautyTables: true,
  };
}
