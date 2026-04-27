import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';
import Link from 'next/link';
import { ChevronLeft, Brain, TrendingUp, AlertTriangle, Activity, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminAIUsagePage() {
  await requirePlatformAdmin();
  const supabase = adminServiceClient();

  // Fetch summary across all workspaces
  const { data: summary } = await supabase
    .from('workspace_ai_usage_summary')
    .select('*')
    .order('cost_this_month_ils', { ascending: false });

  // Aggregate totals
  const totals = (summary || []).reduce((acc: any, w: any) => ({
    messages: acc.messages + Number(w.messages_this_month || 0),
    cost: acc.cost + Number(w.cost_this_month_ils || 0),
    charged: acc.charged + Number(w.charged_this_month_ils || 0),
    profit: acc.profit + Number(w.profit_this_month_ils || 0),
    overage: acc.overage + Number(w.overage_msgs_this_month || 0),
  }), { messages: 0, cost: 0, charged: 0, profit: 0, overage: 0 });

  // Recent calls
  const { data: recentCalls } = await supabase
    .from('ai_usage_log')
    .select(`
      id, feature, ai_provider, ai_model, tokens_input, tokens_output,
      cost_ils, charged_ils, is_overage, created_at,
      workspace_id, workspaces!ai_usage_log_workspace_id_fkey(name, icon)
    `)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/admin" className="text-xs text-slate-500 hover:text-amber-500 inline-flex items-center gap-1 mb-2">
            <ChevronLeft className="w-3 h-3" />
            חזרה ל-Admin
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-amber-500" />
            ניתוח שימוש ב-AI ורווחיות
          </h1>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              הודעות החודש
            </div>
            <div className="text-2xl font-bold text-blue-400">{totals.messages.toLocaleString()}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">עלות (משלמים לספקים)</div>
            <div className="text-2xl font-bold text-orange-400">₪{totals.cost.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">חויב (overage)</div>
            <div className="text-2xl font-bold text-emerald-400">₪{totals.charged.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              רווח החודש
            </div>
            <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ₪{totals.profit.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Per-workspace usage */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-slate-800">
            <h2 className="text-sm font-bold">שימוש לפי סביבה (החודש)</h2>
          </div>
          {!summary || summary.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">אין נתונים עדיין</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-right p-3 font-medium text-slate-400">סביבה</th>
                    <th className="text-right p-3 font-medium text-slate-400">תוכנית</th>
                    <th className="text-right p-3 font-medium text-slate-400">שימוש / מכסה</th>
                    <th className="text-right p-3 font-medium text-slate-400">עלות</th>
                    <th className="text-right p-3 font-medium text-slate-400">חויב</th>
                    <th className="text-right p-3 font-medium text-slate-400">רווח</th>
                    <th className="text-right p-3 font-medium text-slate-400">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((w: any) => (
                    <tr key={w.workspace_id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="p-3 font-medium">{w.icon || '📊'} {w.name}</td>
                      <td className="p-3 text-slate-400">{w.plan}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{w.messages_this_month} / {w.plan_quota}</span>
                          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${w.quota_status === 'overage' ? 'bg-red-500' : w.quota_status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, (Number(w.messages_this_month) / Math.max(Number(w.plan_quota), 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-orange-300">₪{Number(w.cost_this_month_ils).toFixed(4)}</td>
                      <td className="p-3 text-emerald-300">₪{Number(w.charged_this_month_ils).toFixed(2)}</td>
                      <td className={`p-3 font-bold ${Number(w.profit_this_month_ils) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ₪{Number(w.profit_this_month_ils).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          w.quota_status === 'overage' ? 'bg-red-500/20 text-red-300' :
                          w.quota_status === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {w.quota_status === 'overage' ? '🔥 overage' : w.quota_status === 'warning' ? '⚠ warning' : '✓ ok'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent calls */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              30 קריאות AI אחרונות
            </h2>
          </div>
          {!recentCalls || recentCalls.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">אין קריאות עדיין</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentCalls.map((c: any) => {
                const ws = Array.isArray(c.workspaces) ? c.workspaces[0] : c.workspaces;
                return (
                  <li key={c.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                    <div className={`w-1 h-8 rounded ${c.is_overage ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
                      <span className="font-medium">{ws?.icon || '📊'} {ws?.name}</span>
                      <span className="text-slate-400">{c.feature}</span>
                      <span className="text-slate-500 text-[10px]" dir="ltr">{c.ai_provider}/{c.ai_model}</span>
                      <span className="text-slate-400">in:{c.tokens_input} out:{c.tokens_output}</span>
                      <span className="text-orange-300">₪{Number(c.cost_ils).toFixed(4)}</span>
                      <span className="text-emerald-300">{Number(c.charged_ils) > 0 ? `+₪${Number(c.charged_ils).toFixed(2)}` : 'במכסה'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
