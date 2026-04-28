'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, CreditCard, TrendingUp, AlertTriangle, CheckCircle2, ArrowUpCircle, ArrowDownCircle, RefreshCw, Settings, Loader2 } from 'lucide-react';

const TX_TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  topup: { label: 'טעינה', color: 'text-emerald-600', icon: ArrowUpCircle },
  auto_topup: { label: 'טעינה אוטומטית', color: 'text-blue-600', icon: RefreshCw },
  ai_charge: { label: 'חיוב AI', color: 'text-orange-600', icon: ArrowDownCircle },
  refund: { label: 'החזר', color: 'text-purple-600', icon: ArrowUpCircle },
  admin_adjustment: { label: 'התאמת אדמין', color: 'text-gray-600', icon: Settings },
};

export default function WalletClient({ workspace, allWorkspaces, wallet, settings, transactions, topupResult }: any) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(wallet?.auto_recharge_enabled || false);
  const [threshold, setThreshold] = useState(wallet?.auto_recharge_threshold_usd || 5);
  const [rechargeAmount, setRechargeAmount] = useState(wallet?.auto_recharge_amount_usd || 20);

  const presets: number[] = settings?.default_topup_presets || [10, 20, 50, 100];
  const balanceUsd = Number(wallet?.balance_usd || 0);
  const balanceIls = Number(wallet?.balance_ils || 0);
  const markup = Number(wallet?.effective_markup || 5);

  const balanceColor = wallet?.balance_status === 'critical' 
    ? 'from-red-500 to-orange-600' 
    : wallet?.balance_status === 'low'
    ? 'from-amber-500 to-orange-500'
    : wallet?.balance_status === 'warning'
    ? 'from-yellow-500 to-amber-500'
    : 'from-emerald-500 to-teal-600';

  async function topup(amountUsd: number) {
    if (busy) return;
    if (amountUsd < (settings?.min_topup_usd || 5)) {
      alert(`מינימום טעינה: $${settings?.min_topup_usd || 5}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id, amount_usd: amountUsd }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה בטעינה');
        setBusy(false);
        return;
      }
      // Redirect to Cardcom
      window.location.href = data.payment_url;
    } catch (err: any) {
      alert(err.message || 'שגיאה');
      setBusy(false);
    }
  }

  async function saveAutoSettings() {
    setBusy(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          auto_recharge_enabled: autoEnabled,
          auto_recharge_threshold_usd: Number(threshold),
          auto_recharge_amount_usd: Number(rechargeAmount),
        }),
      });
      if (res.ok) {
        setShowSettings(false);
        router.refresh();
      } else {
        const d = await res.json();
        alert(d.error || 'שגיאה');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-purple-600" />
            ארנק AI
          </h1>
          <p className="text-gray-500 text-sm">טעינת קרדיטים לשימוש ב-AI</p>
        </div>
        {allWorkspaces.length > 1 && (
          <select
            value={workspace.id}
            onChange={(e) => router.push(`/dashboard/wallet?ws=${e.target.value}`)}
            className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm"
          >
            {allWorkspaces.map((ws: any) => (
              <option key={ws.id} value={ws.id}>{ws.icon || '📊'} {ws.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Topup result banner */}
      {topupResult === 'success' && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">הטעינה הצליחה! היתרה תתעדכן תוך מספר שניות.</span>
        </div>
      )}
      {topupResult === 'cancel' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">הטעינה בוטלה.</span>
        </div>
      )}

      {/* Balance card */}
      <div className={`rounded-2xl p-6 bg-gradient-to-br ${balanceColor} text-white mb-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs opacity-90 mb-1">יתרה זמינה</div>
            <div className="text-5xl font-bold tracking-tight">${balanceUsd.toFixed(2)}</div>
            <div className="text-sm opacity-90 mt-1">≈ ₪{balanceIls.toFixed(2)}</div>
          </div>
          <Wallet className="w-12 h-12 opacity-30" />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/20 text-xs">
          <div>
            <div className="opacity-80">סה"כ נטען</div>
            <div className="font-bold text-base">${Number(wallet?.total_topped_up_usd || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="opacity-80">סה"כ הוצא</div>
            <div className="font-bold text-base">${Number(wallet?.total_spent_usd || 0).toFixed(2)}</div>
          </div>
        </div>

        {wallet?.balance_status === 'critical' && (
          <div className="mt-4 text-sm flex items-center gap-2 bg-white/20 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4" />
            <span>היתרה אזלה - לא ניתן להשתמש ב-AI עד טעינה</span>
          </div>
        )}
        {wallet?.balance_status === 'low' && (
          <div className="mt-4 text-sm flex items-center gap-2 bg-white/20 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4" />
            <span>יתרה נמוכה - מומלץ לטעון</span>
          </div>
        )}
      </div>

      {/* Top-up presets */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold text-lg">טעינת קרדיטים</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">בחר סכום או הקלד ידנית. החיוב מתבצע פעם אחת.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {presets.map((amount) => (
            <button
              key={amount}
              onClick={() => topup(amount)}
              disabled={busy}
              className="bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200 rounded-xl p-4 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-2xl font-bold text-purple-700">${amount}</div>
              <div className="text-xs text-purple-600 mt-1">≈ ₪{(amount * 3.7).toFixed(0)}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min={settings?.min_topup_usd || 5}
              step={1}
              placeholder="סכום מותאם אישית"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
            />
          </div>
          <button
            onClick={() => customAmount && topup(Number(customAmount))}
            disabled={busy || !customAmount}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            טען
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">מינימום: ${settings?.min_topup_usd || 5}</p>
      </div>

      {/* Auto-recharge */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-lg">טעינה אוטומטית</h2>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-purple-600 text-sm hover:text-purple-700"
          >
            {showSettings ? 'סגור' : 'הגדרות'}
          </button>
        </div>

        {!showSettings ? (
          <div className="text-sm">
            {wallet?.auto_recharge_enabled ? (
              <div className="text-emerald-700 bg-emerald-50 rounded-xl p-3">
                ✓ פעיל - מוסיף ${wallet.auto_recharge_amount_usd} כשהיתרה יורדת מתחת ל-${wallet.auto_recharge_threshold_usd}
              </div>
            ) : (
              <div className="text-gray-500">
                כבוי - הפעל כדי לוודא שלא תפסיק את שירות ה-AI
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoEnabled} onChange={(e) => setAutoEnabled(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">הפעל טעינה אוטומטית</span>
            </label>
            {autoEnabled && (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">טען כשהיתרה יורדת מתחת ל-</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">סכום הטעינה האוטומטית</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {presets.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setRechargeAmount(amount)}
                        className={`px-2 py-1.5 rounded-lg text-sm font-medium border-2 ${
                          Number(rechargeAmount) === amount
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={5}
                      step={1}
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </>
            )}
            <button
              onClick={saveAutoSettings}
              disabled={busy}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {busy ? 'שומר...' : 'שמור הגדרות'}
            </button>
          </div>
        )}
      </div>

      {/* Markup info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
        <div className="flex items-center gap-2 text-blue-700">
          <TrendingUp className="w-4 h-4" />
          <span className="font-bold">מקדם חיוב:</span>
          <span>{markup}x מהעלות</span>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          חיוב כל קריאת AI הוא העלות בפועל × {markup}. למשל הודעה שעולה $0.001 תחויב ב-${(0.001 * markup).toFixed(4)}.
        </p>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-sm">היסטוריית תנועות</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-30" />
            עדיין אין תנועות
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {transactions.map((tx: any) => {
              const meta = TX_TYPE_META[tx.type] || TX_TYPE_META.admin_adjustment;
              const Icon = meta.icon;
              const amount = Number(tx.amount_usd);
              return (
                <li key={tx.id} className="px-5 py-3 flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{meta.label}</div>
                    {tx.description && <div className="text-xs text-gray-500 truncate">{tx.description}</div>}
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`font-bold text-sm ${amount > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {amount > 0 ? '+' : ''}${amount.toFixed(amount > -0.01 ? 2 : 4)}
                    </div>
                    <div className="text-[10px] text-gray-400">יתרה: ${Number(tx.balance_after_usd).toFixed(2)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
