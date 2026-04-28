'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit3, Loader2, Plus, Minus, Ban, CheckCircle2 } from 'lucide-react';

export default function WalletsAdminClient({ wallets, defaultMarkup }: any) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="text-right p-3 text-slate-400">סביבה</th>
              <th className="text-right p-3 text-slate-400">יתרה</th>
              <th className="text-right p-3 text-slate-400">הוצא / טען</th>
              <th className="text-right p-3 text-slate-400">Markup</th>
              <th className="text-right p-3 text-slate-400">טעינה אוטו'</th>
              <th className="text-right p-3 text-slate-400">סטטוס</th>
              <th className="text-right p-3 text-slate-400">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w: any) => (
              <tr key={w.workspace_id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="p-3 font-medium">
                  {w.workspace_icon || '📊'} {w.workspace_name}
                </td>
                <td className="p-3">
                  <div className={`font-bold ${
                    w.balance_status === 'critical' ? 'text-red-400' :
                    w.balance_status === 'low' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    ${Number(w.balance_usd).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">₪{Number(w.balance_ils).toFixed(2)}</div>
                </td>
                <td className="p-3 text-slate-400">
                  <div>הוצא: ${Number(w.total_spent_usd).toFixed(2)}</div>
                  <div>טען: ${Number(w.total_topped_up_usd).toFixed(2)}</div>
                </td>
                <td className="p-3">
                  {w.has_custom_markup ? (
                    <span className="text-amber-400 font-bold">{Number(w.effective_markup)}x ⚡</span>
                  ) : (
                    <span className="text-slate-400">{Number(w.effective_markup)}x</span>
                  )}
                </td>
                <td className="p-3">
                  {w.auto_recharge_enabled ? (
                    <span className="text-emerald-400">
                      ✓ ${w.auto_recharge_amount_usd} @ ${w.auto_recharge_threshold_usd}
                    </span>
                  ) : (
                    <span className="text-slate-500">כבוי</span>
                  )}
                </td>
                <td className="p-3">
                  {w.is_blocked ? (
                    <span className="text-red-400 text-[10px] bg-red-500/20 px-2 py-0.5 rounded">חסום</span>
                  ) : (
                    <span className="text-emerald-400 text-[10px]">פעיל</span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => setEditing(w.workspace_id)}
                    className="text-amber-500 hover:text-amber-400 text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditWalletModal
          wallet={wallets.find((w: any) => w.workspace_id === editing)}
          defaultMarkup={defaultMarkup}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function EditWalletModal({ wallet, defaultMarkup, onClose, onSaved }: any) {
  const [busy, setBusy] = useState(false);
  const [markup, setMarkup] = useState(wallet.has_custom_markup ? Number(wallet.effective_markup) : '');
  const [adjustment, setAdjustment] = useState('');
  const [description, setDescription] = useState('');
  const [block, setBlock] = useState(wallet.is_blocked);

  async function save() {
    setBusy(true);
    try {
      const body: any = { workspace_id: wallet.workspace_id };
      if (markup === '' || markup === null) {
        body.markup_multiplier = null;
      } else {
        body.markup_multiplier = Number(markup);
      }
      if (adjustment) body.balance_adjustment_usd = Number(adjustment);
      if (description) body.description = description;
      if (block !== wallet.is_blocked) body.is_blocked = block;

      const res = await fetch('/api/admin/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) onSaved();
      else {
        const d = await res.json();
        alert(d.error || 'שגיאה');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">עריכת ארנק</h3>
        <p className="text-xs text-slate-400 mb-4">{wallet.workspace_icon || '📊'} {wallet.workspace_name}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Markup פרטני ({wallet.has_custom_markup ? 'מוגדר ידנית' : `ברירת מחדל: ${defaultMarkup}x`})
            </label>
            <div className="flex gap-2">
              <input
                type="number" step={0.1} min={1}
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                placeholder={`${defaultMarkup} (ברירת מחדל)`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => setMarkup('')}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs hover:bg-slate-700"
              >
                איפוס
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">התאמת יתרה (USD, יכול להיות שלילי)</label>
            <input
              type="number" step={0.01}
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="לדוגמה: 50 או -10"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              יתרה נוכחית: ${Number(wallet.balance_usd).toFixed(2)}
              {adjustment && ` → ${(Number(wallet.balance_usd) + Number(adjustment)).toFixed(2)}`}
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">תיאור / סיבה</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="אופציונלי - יישמר בלוג"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">חסום קריאות AI לסביבה זו</span>
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            שמור
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
