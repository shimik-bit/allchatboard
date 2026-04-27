import { adminServiceClient } from '@/lib/admin/auth';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ErrorsPage() {
  const supabase = adminServiceClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pull from api_request_logs - errors only
  const { data: logs } = await supabase
    .from('api_request_logs')
    .select('*')
    .gte('created_at', oneDayAgo)
    .gte('status_code', 400)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">שגיאות</h1>
        <p className="text-sm text-slate-400">בקשות API עם status 400+ ב-24 שעות אחרונות</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {(!logs || logs.length === 0) ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-emerald-700 mx-auto mb-3" />
            <p className="text-emerald-400 text-sm font-bold">אין שגיאות ב-24 שעות אחרונות 🎉</p>
            <p className="text-slate-500 text-xs mt-1">המערכת בריאה</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">זמן</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Path</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map(l => (
                <tr key={l.id} className="border-b border-slate-800/50">
                  <td className="px-5 py-2 text-xs text-slate-400 font-mono">
                    {new Date(l.created_at).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-5 py-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-mono ${
                      l.status_code >= 500 ? 'bg-red-500/20 text-red-400' :
                      l.status_code >= 400 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {l.status_code}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-xs text-slate-300 font-mono">{l.method}</td>
                  <td className="px-5 py-2 text-xs text-slate-300 font-mono truncate max-w-md" title={l.path}>{l.path}</td>
                  <td className="px-5 py-2 text-xs text-slate-500 font-mono">{l.ip_address?.slice(0, 15) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
