import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Settings, Zap, Shield } from 'lucide-react';
import LimitsEditor from './LimitsEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceLimitsPage({ params }: { params: { id: string } }) {
  await requirePlatformAdmin();
  const supabase = adminServiceClient();

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, icon, plan, limit_overrides, feature_overrides, plan_notes, plan_expires_at, plan_set_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!ws) notFound();

  const { data: allPlans } = await supabase
    .from('plan_limits')
    .select('*')
    .order('sort_order');

  // Get current usage
  const { data: usageData } = await supabase
    .rpc('get_workspace_usage', { p_workspace_id: params.id });

  const usage = (usageData as Record<string, number>) || {};
  const currentPlan = allPlans?.find((p: any) => p.plan === ws.plan);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/admin/workspaces/${params.id}`} className="text-xs text-slate-500 hover:text-amber-500 inline-flex items-center gap-1 mb-2">
            <ChevronLeft className="w-3 h-3" />
            חזרה לדף הסביבה
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 grid place-items-center text-amber-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-2xl">{ws.icon || '📊'}</span>
                {ws.name}
              </h1>
              <p className="text-sm text-slate-400">הגדרת מגבלות, תכונות ותוכנית</p>
            </div>
          </div>
        </div>

        <LimitsEditor
          workspaceId={params.id}
          workspaceName={ws.name}
          currentPlan={ws.plan}
          allPlans={allPlans || []}
          limitOverrides={ws.limit_overrides || {}}
          featureOverrides={ws.feature_overrides || {}}
          planNotes={ws.plan_notes}
          planExpiresAt={ws.plan_expires_at}
          usage={usage}
        />
      </div>
    </div>
  );
}
