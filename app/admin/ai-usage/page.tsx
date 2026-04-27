import { adminServiceClient } from '@/lib/admin/auth';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AiUsagePage() {
  const supabase = adminServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('id, user_id, workspace_id, model_used, tokens_input, tokens_output, cost_usd, created_at, source')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  const total = sessions?.length || 0;
  const totalTokens = (sessions || []).reduce((sum, s: any) => sum + (s.tokens_input || 0) + (s.tokens_output || 0), 0);
  const totalCost = (sessions || []).reduce((sum, s: any) => sum + parseFloat(s.cost_usd || '0'), 0);

  // By workspace
  const byWorkspace = new Map<string, { count: number; cost: number; tokens: number }>();
  for (const s of (sessions || []) as any[]) {
    const k = s.workspace_id;
    if (!byWorkspace.has(k)) byWorkspace.set(k, { count: 0, cost: 0, tokens: 0 });
    const v = byWorkspace.get(k)!;
    v.count += 1;
    v.cost += parseFloat(s.cost_usd || '0');
    v.tokens += (s.tokens_input || 0) + (s.tokens_output || 0);
  }

  // Get workspace names
  const wsIds = Array.from(byWorkspace.keys());
  const { data: workspaces } = wsIds.length > 0
    ? await supabase.from('workspaces').select('id, name, icon').in('id', wsIds)
    : { data: [] };
  const wsMap = new Map((workspaces || []).map((w: any) => [w.id, w]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">שימוש ב-AI</h1>
        <p className="text-sm text-slate-400">30 הימים האחרונים</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-xl p-5">
          <div className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">בריפינגים</div>
          <div className="font-display font-black text-3xl text-slate-100">{total}</div>
          <div className="text-xs text-slate-500 mt-1">{total > 0 ? (total / 30).toFixed(1) : 0} ביום ממוצע</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tokens</div>
          <div className="font-display font-black text-3xl text-slate-100">{(totalTokens / 1000).toFixed(1)}K</div>
          <div className="text-xs text-slate-500 mt-1">ממוצע {total > 0 ? Math.round(totalTokens / total) : 0} לבריפינג</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-500/20 rounded-xl p-5">
          <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2">עלות</div>
          <div className="font-display font-black text-3xl text-slate-100">${totalCost.toFixed(3)}</div>
          <div className="text-xs text-slate-500 mt-1">${total > 0 ? (totalCost / total * 1000).toFixed(2) : 0} לבריפינג × 1000</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h2 className="font-bold text-sm text-slate-200">לפי סביבה</h2>
        </div>
        {byWorkspace.size === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">אין שימוש ב-AI ב-30 ימים האחרונים</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50 bg-slate-900/50">
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">סביבה</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">בריפינגים</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tokens</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">עלות</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byWorkspace.entries())
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([wsId, stats]) => {
                  const ws: any = wsMap.get(wsId);
                  return (
                    <tr key={wsId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-5 py-3 text-sm">
                        <span className="text-base mr-1">{ws?.icon || '📊'}</span>
                        <span className="text-slate-100">{ws?.name || '(לא ידוע)'}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-300">{stats.count}</td>
                      <td className="px-5 py-3 text-sm text-slate-300">{(stats.tokens / 1000).toFixed(1)}K</td>
                      <td className="px-5 py-3 text-sm text-emerald-400 font-mono">${stats.cost.toFixed(4)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
