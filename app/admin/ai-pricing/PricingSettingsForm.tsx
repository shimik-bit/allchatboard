'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';

export default function PricingSettingsForm({ initial }: { initial: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [markup, setMarkup] = useState(initial?.default_markup_multiplier || 5);
  const [presets, setPresets] = useState((initial?.default_topup_presets || [10, 20, 50, 100]).join(','));
  const [threshold, setThreshold] = useState(initial?.default_threshold_usd || 5);
  const [rechargeAmount, setRechargeAmount] = useState(initial?.default_recharge_amount_usd || 20);
  const [minTopup, setMinTopup] = useState(initial?.min_topup_usd || 10);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const presetsArr = presets.split(',').map((s: string) => Number(s.trim())).filter((n: number) => n > 0);
      const res = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_markup_multiplier: Number(markup),
          default_topup_presets: presetsArr,
          default_threshold_usd: Number(threshold),
          default_recharge_amount_usd: Number(rechargeAmount),
          min_topup_usd: Number(minTopup),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">מקדם חיוב ברירת מחדל (markup multiplier)</label>
        <div className="flex items-center gap-2">
          <input
            type="number" step={0.1} min={1}
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
            className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-slate-400 text-xs">× העלות בפועל</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          לדוגמה: עלות $0.001 × markup {markup} = ${(0.001 * Number(markup)).toFixed(4)} ללקוח
        </p>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">סכומי טעינה מוצעים (USD, מופרדים בפסיק)</label>
        <input
          type="text"
          value={presets}
          onChange={(e) => setPresets(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          placeholder="10,20,50,100"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">סף ברירת מחדל לטעינה אוטו'</label>
          <input
            type="number" min={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">סכום טעינה אוטו'</label>
          <input
            type="number" min={5}
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">מינימום טעינה</label>
          <input
            type="number" min={1}
            value={minTopup}
            onChange={(e) => setMinTopup(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? '✓ נשמר' : 'שמור הגדרות'}
      </button>
    </div>
  );
}
