'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertCircle, Loader2, Sparkles, Crown, Calendar, X, Receipt } from 'lucide-react';

type Workspace = { id: string; name: string; icon: string | null; plan: string; plan_expires_at: string | null };
type Subscription = {
  id: string;
  status: string;
  amount_usd: number;
  amount_ils: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cardcom_last_4: string | null;
  cardcom_card_brand: string | null;
};
type Payment = {
  id: string;
  amount_ils: number;
  status: string;
  created_at: string;
  payment_type: string;
  cardcom_last_4: string | null;
  failure_reason: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'ממתין לתשלום',  color: 'bg-amber-100 text-amber-700' },
  active:    { label: '✓ פעיל',         color: 'bg-emerald-100 text-emerald-700' },
  past_due:  { label: 'בפיגור',         color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'בוטל',           color: 'bg-gray-100 text-gray-600' },
  expired:   { label: 'פג תוקף',         color: 'bg-red-100 text-red-700' },
};

export default function BillingClient({
  workspace,
  allWorkspaces,
  subscription,
  payments,
  successFlag,
  errorFlag,
}: {
  workspace: Workspace;
  allWorkspaces: Array<{ id: string; name: string; icon: string | null }>;
  subscription: Subscription | null;
  payments: Payment[];
  successFlag: boolean;
  errorFlag: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = subscription && ['active', 'past_due'].includes(subscription.status);

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה');
        return;
      }
      // Redirect to Cardcom payment page
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!subscription) return;
    if (!confirm('לבטל את המנוי? תוכל להמשיך להשתמש עד תום התקופה ששולמה.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscription.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-purple-600" />
            חיוב ומנוי
          </h1>
          <p className="text-gray-500">ניהול תוכנית והיסטוריית תשלומים</p>
        </div>
        {allWorkspaces.length > 1 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">סביבה:</span>
            <select
              value={workspace.id}
              onChange={(e) => router.push(`/dashboard/billing?ws=${e.target.value}`)}
              className="text-sm font-medium bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              {allWorkspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.icon || '📊'} {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Success/Error from URL */}
      {successFlag && (
        <div className="mb-6 bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-emerald-900">תשלום בוצע בהצלחה!</h3>
            <p className="text-sm text-emerald-700">המנוי שלך פעיל. כל התכונות פתוחות.</p>
          </div>
        </div>
      )}
      {errorFlag && (
        <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-900">התשלום לא הושלם</h3>
            <p className="text-sm text-red-700">משהו השתבש. נסה שוב או פנה לתמיכה.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Active subscription card */}
      {isActive && subscription && (
        <div className="mb-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-sm opacity-90 mb-1">
                <Crown className="w-4 h-4" />
                TaskFlow AI Pro
              </div>
              <div className="text-3xl font-bold">$15<span className="text-lg opacity-75">/חודש</span></div>
              <div className="text-sm opacity-75 mt-1">≈ ₪{subscription.amount_ils} לחודש</div>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-bold ${STATUS_CONFIG[subscription.status]?.color || 'bg-white/20 text-white'}`}>
              {STATUS_CONFIG[subscription.status]?.label || subscription.status}
            </span>
          </div>

          {subscription.current_period_end && (
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs opacity-75">החיוב הבא</div>
                <div className="font-bold flex items-center gap-1.5 mt-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(subscription.current_period_end).toLocaleDateString('he-IL')}
                </div>
              </div>
              {subscription.cardcom_last_4 && (
                <div>
                  <div className="text-xs opacity-75">כרטיס</div>
                  <div className="font-bold mt-1" dir="ltr">
                    {subscription.cardcom_card_brand || 'Card'} •••• {subscription.cardcom_last_4}
                  </div>
                </div>
              )}
            </div>
          )}

          {subscription.cancel_at_period_end && (
            <div className="mt-4 pt-4 border-t border-white/20 bg-white/10 -m-2 p-3 rounded-lg">
              <div className="text-sm">
                ⚠ המנוי בוטל - יישאר פעיל עד {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('he-IL') : '?'}
              </div>
            </div>
          )}

          {!subscription.cancel_at_period_end && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="mt-4 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium border border-white/20"
            >
              ביטול מנוי
            </button>
          )}
        </div>
      )}

      {/* Upgrade CTA - shown when no active subscription */}
      {!isActive && (
        <div className="mb-6 bg-white rounded-2xl border-2 border-purple-300 p-8 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-2xl text-gray-900 mb-1">שדרג ל-TaskFlow AI Pro</h2>
              <p className="text-gray-600 text-sm mb-4">גישה מלאה לכל התכונות, ללא מגבלות</p>
              
              <ul className="space-y-2 mb-6 text-sm">
                {[
                  'טבלאות, רשומות וקבוצות ללא הגבלה',
                  'GroupGuard - הגנה אוטומטית על קבוצות',
                  'דוחות אוטומטיים + רצפי הודעות',
                  'אוטומציות + AI מתקדם',
                  'White Label + דומיין מותאם',
                  'תמיכה מועדפת',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-purple-600">$15</span>
                <span className="text-lg text-gray-500">/חודש</span>
                <span className="text-sm text-gray-400 mr-2">≈ ₪55</span>
              </div>

              <button
                onClick={handleUpgrade}
                disabled={busy}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                שדרג עכשיו
              </button>
              <p className="text-[10px] text-gray-500 mt-2">תשלום מאובטח דרך Cardcom · בטל בכל זמן</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-gray-500" />
            <h2 className="font-bold text-sm text-gray-700">היסטוריית תשלומים</h2>
            <span className="text-xs text-gray-400 mr-auto">{payments.length} תשלומים</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {payments.map(p => (
              <li key={p.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <div className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${
                  p.status === 'captured' ? 'bg-emerald-100 text-emerald-600' :
                  p.status === 'failed' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {p.status === 'captured' ? <CheckCircle2 className="w-4 h-4" /> : p.status === 'failed' ? <X className="w-4 h-4" /> : <Loader2 className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    ₪{p.amount_ils}
                    {p.cardcom_last_4 && (
                      <span className="text-xs text-gray-500 mr-2" dir="ltr">•••• {p.cardcom_last_4}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleDateString('he-IL', { dateStyle: 'medium' })}
                    {' · '}
                    {p.payment_type === 'subscription' ? 'חידוש חודשי' : p.payment_type === 'initial' ? 'תשלום ראשון' : p.payment_type}
                    {p.failure_reason && ` · ${p.failure_reason}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
