// app/dashboard/inbox/insights/page.tsx
// Inbox Insights - דשבורד אנליטיקה מלא לאינבוקס

import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { redirect } from 'next/navigation';
import InsightsClient from './InsightsClient';

export const metadata = { title: 'תובנות Inbox | TaskFlow' };
export const dynamic = 'force-dynamic';

export default async function InboxInsightsPage() {
  // SECURITY: same secure resolver as the rest of the dashboard
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) redirect('/onboarding');

  const supabase = createClient();
  const wsId = ws.wsId;

  const [{ data: kpis }, { data: byReason }, { data: topCustomers }, { data: dailyStats }] =
    await Promise.all([
      supabase.from('v_inbox_kpis').select('*').eq('workspace_id', wsId).maybeSingle(),
      supabase.from('v_inbox_by_reason').select('*').eq('workspace_id', wsId),
      supabase.from('v_inbox_top_customers').select('*').eq('workspace_id', wsId).limit(10),
      supabase.from('v_inbox_daily_stats').select('*').eq('workspace_id', wsId).limit(30),
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
