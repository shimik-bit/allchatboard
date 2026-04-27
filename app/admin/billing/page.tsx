import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';
import Link from 'next/link';
import { CreditCard, ChevronLeft, AlertCircle, CheckCircle2, Clock, X, TrendingUp, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'ממתין',      color: 'bg-amber-500/20 text-amber-300' },
  active:    { label: '✓ פעיל',     color: 'bg-emerald-500/20 text-emerald-300' },
  past_due:  { label: 'בפיגור',     color: 'bg-orange-500/20 text-orange-300' },
  cancelled: { label: 'בוטל',       color: 'bg-gray-500/20 text-gray-300' },
  expired:   { label: 'פג תוקף',     color: 'bg-red-500/20 text-red-300' },
};

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const supabase = adminServiceClient();

  // All subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id, status, amount_usd, amount_ils, currency, billing_period,
      current_period_start, current_period_end, cancel_at_period_end,
      cardcom_last_4, cardcom_card_brand, customer_email, customer_name,
      created_at,
      workspace_id,
      workspaces!subscriptions_workspace_id_fkey(id, name, icon, plan)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  // Summary stats
  const active = (subscriptions || []).filter((s: any) => s.status === 'active').length;
  const pastDue = (subscriptions || []).filter((s: any) => s.status === 'past_due').length;
  const cancelled = (subscriptions || []).filter((s: any) => s.status === 'cancelled').length;
  const mrr = (subscriptions || [])
    .filter((s: any) => ['active', 'past_due'].includes(s.status))
    .reduce((sum: number, s: any) => sum + Number(s.amount_ils || 0), 0);

  // Recent payments (last 30)
  const { data: recentPayments } = await supabase
    .from('payments')
    .select(`
      id, amount_ils, currency, status, payment_type, cardcom_last_4,
      failure_reason, created_at,
      workspace_id,
      workspaces!payments_workspace_id_fkey(id, name, icon)
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
            <CreditCard className="w-6 h-6 text-amber-500" />
            ניהול חיוב ומנויים
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              MRR (חודשי)
            </div>
            <div className="text-2xl font-bold text-emerald-400">₪{mrr.toLocaleString()}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">פעילים</div>
            <div className="text-2xl font-bold text-emerald-400">{active}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">בפיגור</div>
            <div className={`text-2xl font-bold ${pastDue > 0 ? 'text-orange-400' : 'text-slate-500'}`}>{pastDue}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">בוטלו</div>
            <div className="text-2xl font-bold text-slate-400">{cancelled}</div>
          </div>
        </div>

        {/* Subscriptions list */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">כל המנויים ({subscriptions?.length || 0})</h2>
          </div>
          {!subscriptions || subscriptions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
              עדיין אין מנויים
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {subscriptions.map((s: any) => {
                const ws = Array.isArray(s.workspaces) ? s.workspaces[0] : s.workspaces;
                const stat = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                return (
                  <li key={s.id} className="p-3">
                    <Link href={`/admin/workspaces/${s.workspace_id}`} className="flex items-center gap-3 hover:bg-slate-800/50 -m-3 p-3 rounded-lg transition-colors">
                      <div className="text-2xl">{ws?.icon || '📊'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{ws?.name || '?'}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stat.color}`}>
                            {stat.label}
                          </span>
                          {s.cancel_at_period_end && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                              מבוטל
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>${s.amount_usd}/{s.billing_period === 'monthly' ? 'חודש' : 'שנה'}</span>
                          <span>·</span>
                          <span>₪{s.amount_ils}</span>
                          {s.customer_email && (
                            <>
                              <span>·</span>
                              <span>{s.customer_email}</span>
                            </>
                          )}
                          {s.cardcom_last_4 && (
                            <>
                              <span>·</span>
                              <span dir="ltr">{s.cardcom_card_brand || 'Card'} •••• {s.cardcom_last_4}</span>
                            </>
                          )}
                          {s.current_period_end && (
                            <>
                              <span>·</span>
                              <span>חיוב הבא: {new Date(s.current_period_end).toLocaleDateString('he-IL')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent payments */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              תשלומים אחרונים
            </h2>
          </div>
          {!recentPayments || recentPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">עדיין אין תשלומים</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentPayments.map((p: any) => {
                const ws = Array.isArray(p.workspaces) ? p.workspaces[0] : p.workspaces;
                return (
                  <li key={p.id} className="p-3 flex items-center gap-3 text-sm">
                    <div className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${
                      p.status === 'captured' ? 'bg-emerald-500/20 text-emerald-400' :
                      p.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-800 text-slate-500'
                    }`}>
                      {p.status === 'captured' ? <CheckCircle2 className="w-4 h-4" /> : p.status === 'failed' ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        ₪{p.amount_ils} · {ws?.icon || '📊'} {ws?.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(p.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                        {' · '}
                        {p.payment_type === 'subscription' ? 'חידוש' : p.payment_type === 'initial' ? 'ראשוני' : p.payment_type}
                        {p.failure_reason && (
                          <span className="text-red-400 mr-1">· {p.failure_reason}</span>
                        )}
                      </div>
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
