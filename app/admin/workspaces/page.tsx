import { adminServiceClient } from '@/lib/admin/auth';
import Link from 'next/link';
import { Building2, ExternalLink, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspacesListPage() {
  const supabase = adminServiceClient();

  // Get all workspaces with enrichment
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, icon, vertical, created_at, updated_at')
    .order('created_at', { ascending: false });

  // Enrich each with stats (sequential to avoid rate limits)
  const enriched = await Promise.all((workspaces || []).map(async (ws: any) => {
    const [
      { count: memberCount },
      { count: tableCount },
      tableIds,
      groupIds,
    ] = await Promise.all([
      supabase.from('workspace_members').select('user_id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
      supabase.from('tables').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
      supabase.from('tables').select('id').eq('workspace_id', ws.id),
      supabase.from('whatsapp_groups').select('id').eq('workspace_id', ws.id),
    ]);

    let recordCount = 0;
    if (tableIds.data && tableIds.data.length > 0) {
      const { count } = await supabase
        .from('records')
        .select('id', { count: 'exact', head: true })
        .in('table_id', tableIds.data.map((t: any) => t.id));
      recordCount = count || 0;
    }

    let messageCount = 0;
    if (groupIds.data && groupIds.data.length > 0) {
      const { count } = await supabase
        .from('wa_messages')
        .select('id', { count: 'exact', head: true })
        .in('group_id', groupIds.data.map((g: any) => g.id));
      messageCount = count || 0;
    }

    return {
      ...ws,
      member_count: memberCount || 0,
      table_count: tableCount || 0,
      record_count: recordCount,
      message_count: messageCount,
    };
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">סביבות עבודה</h1>
          <p className="text-sm text-slate-400">{enriched.length} סביבות במערכת</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">סביבה</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">תחום</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">חברים</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">טבלאות</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">רשומות</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">הודעות WA</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">נוצר</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(ws => (
              <tr key={ws.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{ws.icon || '📊'}</span>
                    <div>
                      <div className="text-slate-100 font-medium">{ws.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{ws.id.slice(0, 8)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm">
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs">
                    {ws.vertical || 'general'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-300">{ws.member_count}</td>
                <td className="px-5 py-3.5 text-sm text-slate-300">{ws.table_count}</td>
                <td className="px-5 py-3.5 text-sm text-slate-300">{ws.record_count.toLocaleString('he-IL')}</td>
                <td className="px-5 py-3.5 text-sm text-slate-300">{ws.message_count.toLocaleString('he-IL')}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">
                  {new Date(ws.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
                </td>
                <td className="px-5 py-3.5">
                  <Link
                    href={`/admin/workspaces/${ws.id}`}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                  >
                    פרטים <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {enriched.length === 0 && (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">אין עדיין סביבות במערכת</p>
          </div>
        )}
      </div>
    </div>
  );
}
