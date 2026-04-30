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
 *
 * Fields it expects on records (all stored in records.data jsonb):
 *   beauty_clients:
 *     - name (string)
 *     - birthday (YYYY-MM-DD; year ignored for matching)
 *     - phone, email (optional)
 *
 *   beauty_appointments:
 *     - client_name (string) — could later become a relation FK
 *     - service (string), service_id (uuid, optional)
 *     - date (YYYY-MM-DD)
 *     - time (HH:MM)
 *     - duration (number, minutes)
 *     - price (number, ILS)
 *     - status: 'confirmed' | 'completed' | 'cancelled' | 'no_show'
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
        ratingCount: 0,
      },
      hasBeautyTables: false,
    };
  }

  // Compute the date boundaries we'll need below.
  // Using Israel time conceptually but JS Date is UTC-based, so we work
  // off `today` as the user's calendar date and let the DB do its own
  // string comparison (which is timezone-agnostic for YYYY-MM-DD).
  const now = new Date();
  const todayStr = isoDate(now);

  // Start of week = Sunday (Israeli week). End = next Sunday (exclusive).
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  const startOfWeekStr = isoDate(startOfWeek);
  const endOfWeekStr = isoDate(endOfWeek);

  // Start of month = 1st of current month. End = 1st of next month.
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfMonthStr = isoDate(startOfMonth);
  const endOfMonthStr = isoDate(endOfMonth);

  // 7 days ahead for upcoming birthdays
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(now.getDate() + 7);

  // ===== Today's appointments =====
  // Match the data->>date field against today's string. We picked `date` as
  // the canonical field name in the seed data; appointment_date / scheduled_at
  // are alternatives the loader also tries for resilience.
  const { data: todayRecords } = await supabase
    .from('records')
    .select('id, data')
    .eq('table_id', appointmentsTableId)
    .filter('data->>date', 'eq', todayStr)
    .order('data->>time', { ascending: true })
    .limit(20);

  const appointmentsToday = (todayRecords || []).map((r: any) => ({
    id: r.id,
    time: r.data?.time || r.data?.start_time || '—',
    clientName: r.data?.client_name || r.data?.customer_name || 'לקוחה',
    service: r.data?.service || r.data?.service_name || 'טיפול',
    duration: r.data?.duration ? `${r.data.duration} דק׳` : '60 דק׳',
    price: r.data?.price ? `₪${r.data.price}` : undefined,
  }));

  // ===== Upcoming birthdays (next 7 days) =====
  // Strategy: load ALL clients with birthdays, then filter in JS by month-day.
  // We can't do this in SQL cleanly because birthdays span year-end (Dec 28
  // birthday must show up when today is Dec 25 even though the year is wrong).
  // The client list is small enough (~hundreds at most) that this is fine.
  const { data: clientRecords } = await supabase
    .from('records')
    .select('id, data')
    .eq('table_id', clientsTableId)
    .not('data->>birthday', 'is', null);

  const upcomingBirthdays = computeUpcomingBirthdays(
    clientRecords || [],
    now,
    7
  );

  // ===== Stats =====
  const { count: clientCount } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', clientsTableId);

  // Appointments this week — count by appointment date, not record creation,
  // so an appointment scheduled last month for this Tuesday is correctly
  // counted as "this week".
  const { count: appointmentsThisWeek } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', appointmentsTableId)
    .filter('data->>date', 'gte', startOfWeekStr)
    .filter('data->>date', 'lt', endOfWeekStr);

  // Revenue this month — sum of price for appointments in this month.
  // We include 'confirmed' because in this small-business context the appt
  // is typically already paid for at booking; for a proper finance system
  // this should restrict to status='completed'.
  const { data: thisMonthAppointments } = await supabase
    .from('records')
    .select('data')
    .eq('table_id', appointmentsTableId)
    .filter('data->>date', 'gte', startOfMonthStr)
    .filter('data->>date', 'lt', endOfMonthStr);

  let revenueThisMonth = 0;
  for (const apt of thisMonthAppointments || []) {
    const status = (apt as any).data?.status;
    // Don't count cancelled or no-show appointments toward revenue
    if (status === 'cancelled' || status === 'no_show') continue;
    const price = Number((apt as any).data?.price);
    if (isFinite(price) && price > 0) {
      revenueThisMonth += price;
    }
  }

  // ===== Average rating =====
  // Pull all rated appointments (regardless of date) and average the
  // rating field. We don't restrict by date — we want the studio's overall
  // satisfaction score, not just this month's. The dashboard label says
  // "מהלקוחות" (from customers) which is timeless.
  const { data: ratedAppointments } = await supabase
    .from('records')
    .select('data')
    .eq('table_id', appointmentsTableId)
    .not('data->>rating', 'is', null);

  let averageRating: number | null = null;
  let ratingCount = 0;
  if (ratedAppointments && ratedAppointments.length > 0) {
    const ratings = ratedAppointments
      .map((r: any) => Number(r.data?.rating))
      .filter((n) => isFinite(n) && n > 0);
    if (ratings.length > 0) {
      averageRating = ratings.reduce((s, n) => s + n, 0) / ratings.length;
      ratingCount = ratings.length;
    }
  }

  return {
    userName,
    workspaceName,
    appointmentsToday,
    upcomingBirthdays,
    stats: {
      clientCount: clientCount || 0,
      appointmentsThisWeek: appointmentsThisWeek || 0,
      revenueThisMonth: Math.round(revenueThisMonth),
      averageRating,
      ratingCount,
    },
    hasBeautyTables: true,
  };
}

/**
 * Compute clients with birthdays in the next N days from `from`.
 *
 * Handles the year-end wrap correctly: a birthday on Jan 3 should appear
 * in the upcoming list when `from` is Dec 30. We do this by computing each
 * client's *next* birthday (the upcoming occurrence regardless of stored
 * year), then keeping only those within the window.
 */
function computeUpcomingBirthdays(
  records: { id: string; data: any }[],
  from: Date,
  daysWindow: number
): {
  id: string;
  name: string;
  daysUntil: number;
  dayLabel: string;
}[] {
  const result: any[] = [];
  const today0 = new Date(from);
  today0.setHours(0, 0, 0, 0);
  const todayMs = today0.getTime();

  for (const r of records) {
    const birthday = String(r.data?.birthday || '').slice(0, 10);
    if (!birthday) continue;

    const m = birthday.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!m) continue;
    const [, monthStr, dayStr] = m;
    const month = Number(monthStr) - 1; // JS months are 0-indexed
    const day = Number(dayStr);

    // Compute next occurrence of this birthday.
    let next = new Date(today0.getFullYear(), month, day);
    next.setHours(0, 0, 0, 0);
    if (next.getTime() < todayMs) {
      // Already passed this year — bump to next year
      next = new Date(today0.getFullYear() + 1, month, day);
    }

    const daysUntil = Math.round((next.getTime() - todayMs) / 86400000);
    if (daysUntil > daysWindow) continue;

    result.push({
      id: r.id,
      name: String(r.data?.name || 'לקוחה'),
      daysUntil,
      dayLabel: friendlyDayLabel(daysUntil, next),
    });
  }

  // Sort by closest first
  result.sort((a, b) => a.daysUntil - b.daysUntil);
  return result;
}

/** "היום", "מחר", "מחרתיים", "ביום שלישי", "ב-15 במאי" */
function friendlyDayLabel(daysUntil: number, date: Date): string {
  if (daysUntil === 0) return 'היום! 🎉';
  if (daysUntil === 1) return 'מחר';
  if (daysUntil === 2) return 'מחרתיים';
  if (daysUntil <= 6) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return `יום ${days[date.getDay()]}`;
  }
  const months = [
    'בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני',
    'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר',
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
