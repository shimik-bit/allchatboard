import { adminServiceClient } from '@/lib/admin/auth';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImpersonationsPage() {
  const supabase = adminServiceClient();
  const { data: logs } = await supabase
    .from('impersonation_audit')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">לוג כניסה כמשתמש</h1>
        <p className="text-sm text-slate-400">היסטוריה מלאה של כל פעולת impersonate (אינה ניתנת למחיקה)</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {(!logs || logs.length === 0) ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">לא נעשו פעולות impersonate</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">זמן</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Admin</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">סיבה</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map(l => (
                <tr key={l.id} className="border-b border-slate-800/50">
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(l.started_at).toLocaleString('he-IL')}
                  </td>
                  <td className="px-5 py-3 text-xs text-amber-400">{l.admin_email}</td>
                  <td className="px-5 py-3 text-xs text-slate-300">{l.target_email}</td>
                  <td className="px-5 py-3 text-xs text-slate-400 max-w-md truncate" title={l.reason}>
                    {l.reason}
                  </td>
                  <td className="px-5 py-3 text-[10px] text-slate-500 font-mono">{l.ip_address?.slice(0, 20)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
