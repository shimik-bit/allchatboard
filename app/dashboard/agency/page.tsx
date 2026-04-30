/**
 * Agency Hub
 *
 * Replaces the regular dashboard for workspaces with type='agency'. Shows
 * the agency's client list with a quick KPI for each, and lets the user
 * one-click switch into any client to manage it.
 *
 * Uses the same vertical-aware routing pattern as Beauty: /dashboard checks
 * the current workspace type and either renders this page or falls through
 * to the regular dashboard.
 *
 * Server Component - all data loaded server-side and rendered as HTML.
 * Switching to a client is just a link to /api/workspace/switch?id=...
 */
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, ArrowLeft, Plus, Crown, AlertCircle } from 'lucide-react';
import type { Workspace, AgencyClient } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface ClientWithStats {
  link: AgencyClient;
  workspace: Workspace;
  recordCount: number;
  pendingApprovals: number;
}

export default async function AgencyHubPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Find the user's agency workspace. We use the cookie to know which
  // workspace they're "currently in", but we also verify it actually IS
  // an agency. If they came here via direct URL on a non-agency workspace,
  // bounce them to /dashboard.
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const activeWsId = cookieStore.get('tf_active_workspace')?.value;

  if (!activeWsId) {
    redirect('/dashboard');
  }

  const { data: agencyWs } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', activeWsId)
    .single();

  if (!agencyWs || (agencyWs as any).type !== 'agency') {
    // Not an agency workspace - redirect to regular dashboard
    redirect('/dashboard');
  }

  // Verify the user is a member with appropriate role
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', activeWsId)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/dashboard');

  // Load the agency's client list with workspace details
  const { data: links } = await supabase
    .from('agency_clients')
    .select('*, client:client_workspace_id(*)')
    .eq('agency_workspace_id', activeWsId)
    .order('created_at', { ascending: false });

  // Hydrate each link with quick stats. We fetch counts in parallel because
  // sequential queries would make the page slow when an agency has many clients.
  const clients: ClientWithStats[] = await Promise.all(
    (links || []).map(async (l: any) => {
      const clientWs = l.client;
      if (!clientWs) {
        // Orphaned link (client workspace deleted but link wasn't cleaned up).
        // Skip in stats but still render so admin can see + remove.
        return {
          link: l,
          workspace: null as any,
          recordCount: 0,
          pendingApprovals: 0,
        };
      }

      // Total records across all tables in this client workspace
      const { count: recordCount } = await supabase
        .from('records')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', clientWs.id);

      // Records awaiting approval (is_approved IS NULL on tables with approval enabled)
      const { count: pendingApprovals } = await supabase
        .from('records')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', clientWs.id)
        .is('is_approved', null);

      return {
        link: l as AgencyClient,
        workspace: clientWs as Workspace,
        recordCount: recordCount || 0,
        pendingApprovals: pendingApprovals || 0,
      };
    })
  );

  // Filter out orphaned links from the main view (we'd surface them in a
  // separate "broken links" section if we were polishing, but for the
  // foundation PR we just hide them).
  const validClients = clients.filter((c) => c.workspace);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white p-5 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-gray-500 mb-2 font-medium">
              <Crown className="w-3.5 h-3.5" />
              חלל סוכנות
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              {agencyWs.name}
            </h1>
            <p className="text-gray-600 mt-1.5">
              {validClients.length === 0
                ? 'עוד לא הוספת לקוחות. לחץ על "הוסף לקוח" כדי להתחיל.'
                : `מנהל ${validClients.length} ${validClients.length === 1 ? 'לקוח' : 'לקוחות'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {membership.role === 'owner' || membership.role === 'admin' ? (
              <Link
                href="/dashboard/agency/add-client"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                הוסף לקוח
              </Link>
            ) : null}
          </div>
        </div>

        {/* Empty state */}
        {validClients.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
            <Building2 className="w-14 h-14 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              אין עדיין לקוחות
            </h2>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              כסוכנות אתה יכול לחבר workspaces של לקוחות ולנהל את כולם ממקום
              אחד — בלי להיות חבר בכל workspace בנפרד.
            </p>
            {(membership.role === 'owner' || membership.role === 'admin') && (
              <Link
                href="/dashboard/agency/add-client"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition"
              >
                <Plus className="w-4 h-4" />
                הוסף את הלקוח הראשון
              </Link>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {validClients.map((c) => (
              <ClientCard key={c.link.id} client={c} />
            ))}
          </div>
        )}

        {/* Foot note */}
        <div className="mt-8 text-xs text-gray-500 text-center">
          לחיצה על כרטיס לקוח תעביר אותך לחלל העבודה שלו.
          <br />
          כדי לחזור לכאן, לחץ על "חלל סוכנות" בסיידבר.
        </div>
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: ClientWithStats }) {
  const { link, workspace, recordCount, pendingApprovals } = client;
  // Pretty-print the client name: prefer the agency's nickname if set,
  // otherwise the workspace's official name. Lets accountants use shorter
  // friendlier names internally without forcing the client to rename.
  const displayName = link.nickname || workspace.name;

  return (
    <a
      href={`/api/workspace/switch?id=${workspace.id}`}
      className="group bg-white rounded-2xl p-5 border border-gray-200 hover:border-brand-400 hover:shadow-lg transition-all relative"
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center text-2xl shrink-0"
          style={{ background: workspace.primary_color + '15' }}
        >
          {workspace.icon || workspace.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-700 transition-colors">
            {displayName}
          </h3>
          {/* If we used a nickname, show the official name as secondary text
              so the agency user can still find the client by their real name. */}
          {link.nickname && link.nickname !== workspace.name && (
            <div className="text-xs text-gray-500 truncate">{workspace.name}</div>
          )}
          {workspace.workspace_code && (
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              {workspace.workspace_code}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-600 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>
            <strong className="text-gray-900">{recordCount}</strong> רשומות
          </span>
        </div>
        {pendingApprovals > 0 && (
          <div className="flex items-center gap-1.5 text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              <strong>{pendingApprovals}</strong> ממתין לאישור
            </span>
          </div>
        )}
      </div>

      {/* Hover indicator */}
      <ArrowLeft className="w-4 h-4 text-gray-300 group-hover:text-brand-600 transition-colors absolute top-5 left-5 group-hover:-translate-x-1 transition-transform" />
    </a>
  );
}
