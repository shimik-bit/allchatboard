import { CreditCard } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">תשלומים</h1>
        <p className="text-sm text-slate-400">ניהול מנויי Cardcom + חשבוניות</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <CreditCard className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-300 font-medium mb-1">בקרוב</p>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          אינטגרציה עם Cardcom (terminal 137368) להצגת תשלומים, מנויים פעילים, חיובים שנכשלו ו-MRR.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-lg mx-auto text-right">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 uppercase">מנויים פעילים</div>
            <div className="text-xl font-bold text-slate-300 mt-1">—</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 uppercase">MRR</div>
            <div className="text-xl font-bold text-slate-300 mt-1">—</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 uppercase">Failed payments</div>
            <div className="text-xl font-bold text-slate-300 mt-1">—</div>
          </div>
        </div>
      </div>
    </div>
  );
}
