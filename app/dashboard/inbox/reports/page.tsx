// app/dashboard/inbox/reports/page.tsx
// Inbox Reports - דשבורד דוחות מקצועי עם SLA, percentiles, heatmap, top issues

import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

export const metadata = { title: 'דוחות Inbox | TaskFlow' };
export const dynamic = 'force-dynamic';

export default async function InboxReportsPage() {
  // SECURITY: verifies the user is signed in AND that the active workspace
  // cookie points to a workspace they're a member of. Falls back to their
  // first membership if the cookie is invalid; redirects to /onboarding if
  // they have no memberships at all.
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) redirect('/onboarding');

  const supabase = createClient();
  const wsId = ws.wsId;

  const [
    { data: kpis },
    { data: heatmap },
    { data: topIssues },
    { data: weekComparison },
    { data: trend },
  ] = await Promise.all([
    supabase.from('v_inbox_advanced_kpis').select('*').eq('workspace_id', wsId).maybeSingle(),
    supabase.from('v_inbox_hourly_heatmap').select('*').eq('workspace_id', wsId),
    supabase.from('v_inbox_top_issues').select('*').eq('workspace_id', wsId),
    supabase.from('v_inbox_week_comparison').select('*').eq('workspace_id', wsId).maybeSingle(),
    supabase.from('v_inbox_response_trend').select('*').eq('workspace_id', wsId),
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
