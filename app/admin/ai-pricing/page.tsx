import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';
import Link from 'next/link';
import { ChevronLeft, DollarSign } from 'lucide-react';
import PricingSettingsForm from './PricingSettingsForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPricingPage() {
  await requirePlatformAdmin();
  const supabase = adminServiceClient();

  const { data: settings } = await supabase
    .from('ai_pricing_settings').select('*').eq('id', 1).single();

  const { data: models } = await supabase
    .from('ai_model_pricing').select('*').order('ai_provider, ai_model');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6">
        <Link href="/admin" className="text-xs text-slate-500 hover:text-amber-500 inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="w-3 h-3" /> חזרה ל-Admin
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <DollarSign className="w-6 h-6 text-amber-500" />
          הגדרות תמחור AI
        </h1>

        <PricingSettingsForm initial={settings} />

        {/* Provider model pricing reference */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 mt-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <h2 className="text-sm font-bold">מחירוני ספקים (cost בסיסי לפני markup)</h2>
            <p className="text-xs text-slate-400 mt-1">לכל מיליון טוקנים, USD</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-right p-3 text-slate-400">ספק / דגם</th>
                <th className="text-right p-3 text-slate-400">קלט (per 1M)</th>
                <th className="text-right p-3 text-slate-400">פלט (per 1M)</th>
              </tr>
            </thead>
            <tbody>
              {(models || []).map((m: any) => (
                <tr key={m.id} className="border-t border-slate-800">
                  <td className="p-3" dir="ltr">{m.ai_provider} / {m.ai_model}</td>
                  <td className="p-3 text-orange-300">${Number(m.cost_per_m_input_usd).toFixed(2)}</td>
                  <td className="p-3 text-orange-300">${Number(m.cost_per_m_output_usd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
