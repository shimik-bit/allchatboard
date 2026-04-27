import { adminServiceClient } from '@/lib/admin/auth';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ActivityPage() {
  const supabase = adminServiceClient();

  // Recent records, messages, signups - merged into a feed
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: records }, { data: messages }, { data: signups }] = await Promise.all([
    supabase.from('records')
      .select('id, created_at, table_id, source, tables(name, icon, workspace_id, workspaces(name))')
      .gte('created_at', oneWeekAgo)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('wa_messages')
      .select('id, processed_at, group_id, whatsapp_groups(group_name, workspace_id, workspaces(name))')
      .gte('processed_at', oneWeekAgo)
      .order('processed_at', { ascending: false })
      .limit(30),
    supabase.from('terms_acceptances')
      .select('user_id, accepted_at, ip_address')
      .gte('accepted_at', oneWeekAgo)
      .order('accepted_at', { ascending: false })
      .limit(20),
  ]);

  type Event = { ts: string; type: 'record' | 'message' | 'signup'; label: string; detail: string };
  const events: Event[] = [];

  for (const r of (records || []) as any[]) {
    events.push({
      ts: r.created_at,
      type: 'record',
      label: `רשומה חדשה ב"${r.tables?.name || '(טבלה)'}"`,
      detail: `${r.tables?.workspaces?.name || '?'} · מקור: ${r.source || 'manual'}`,
    });
  }
  for (const m of (messages || []) as any[]) {
    events.push({
      ts: m.processed_at,
      type: 'message',
      label: `הודעת WhatsApp בקבוצה "${m.whatsapp_groups?.group_name || '(קבוצה)'}"`,
      detail: m.whatsapp_groups?.workspaces?.name || '',
    });
  }
  for (const s of (signups || []) as any[]) {
    events.push({
      ts: s.accepted_at,
      type: 'signup',
      label: `משתמש חדש נרשם`,
      detail: `IP: ${s.ip_address || '?'}`,
    });
  }

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const recent = events.slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">פעילות אחרונה</h1>
        <p className="text-sm text-slate-400">7 ימים אחרונים · {recent.length} אירועים</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {recent.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">אין פעילות ב-7 ימים האחרונים</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recent.map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-800/20">
                <div className={`w-7 h-7 rounded-lg grid place-items-center text-sm flex-shrink-0 ${
                  e.type === 'record' ? 'bg-blue-500/10 text-blue-400' :
                  e.type === 'message' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {e.type === 'record' ? '📝' : e.type === 'message' ? '💬' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200">{e.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{e.detail}</div>
                </div>
                <div className="text-[10px] text-slate-600 font-mono flex-shrink-0">
                  {formatTime(e.ts)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor(diff / (60 * 1000));
  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (mins >= 1) return `${mins}m`;
  return 'now';
}
