// app/dashboard/inbox/reports/page.tsx
// Inbox Reports - דשבורד דוחות מקצועי עם SLA, percentiles, heatmap, top issues

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ReportsClient from './ReportsClient';

export const metadata = { title: 'דוחות Inbox | TaskFlow' };
export const dynamic = 'force-dynamic';

export default async function InboxReportsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const wsId = cookies().get('tf_active_workspace')?.value;
  if (!wsId) redirect('/dashboard');

  const admin = createAdminClient();
  
  const [
    { data: kpis },
    { data: heatmap },
    { data: topIssues },
    { data: weekComparison },
    { data: trend },
  ] = await Promise.all([
    admin.from('v_inbox_advanced_kpis').select('*').eq('workspace_id', wsId).maybeSingle(),
    admin.from('v_inbox_hourly_heatmap').select('*').eq('workspace_id', wsId),
    admin.from('v_inbox_top_issues').select('*').eq('workspace_id', wsId),
    admin.from('v_inbox_week_comparison').select('*').eq('workspace_id', wsId).maybeSingle(),
    admin.from('v_inbox_response_trend').select('*').eq('workspace_id', wsId),
  ]);

  return (
    <ReportsClient
      kpis={kpis || {}}
      heatmap={heatmap || []}
      topIssues={topIssues || []}
      weekComparison={weekComparison || {}}
      trend={trend || []}
    />
  );
}
