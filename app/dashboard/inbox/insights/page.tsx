// app/dashboard/inbox/insights/page.tsx
// Inbox Insights - דשבורד אנליטיקה מלא לאינבוקס

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import InsightsClient from './InsightsClient';

export const metadata = { title: 'תובנות Inbox | TaskFlow' };
export const dynamic = 'force-dynamic';

export default async function InboxInsightsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const cookieStore = cookies();
  const wsId = cookieStore.get('tf_active_workspace')?.value;
  if (!wsId) redirect('/dashboard');

  // RLS לא רלוונטי כאן - אנחנו רק מאחזרים נתונים ש-RLS כבר סינן
  const admin = createAdminClient();
  
  const [{ data: kpis }, { data: byReason }, { data: topCustomers }, { data: dailyStats }] = 
    await Promise.all([
      admin.from('v_inbox_kpis').select('*').eq('workspace_id', wsId).maybeSingle(),
      admin.from('v_inbox_by_reason').select('*').eq('workspace_id', wsId),
      admin.from('v_inbox_top_customers').select('*').eq('workspace_id', wsId).limit(10),
      admin.from('v_inbox_daily_stats').select('*').eq('workspace_id', wsId).limit(30),
    ]);

  return (
    <InsightsClient
      kpis={kpis || {}}
      byReason={byReason || []}
      topCustomers={topCustomers || []}
      dailyStats={dailyStats || []}
    />
  );
}
