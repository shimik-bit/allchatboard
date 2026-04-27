import { adminServiceClient } from '@/lib/admin/auth';
import Link from 'next/link';
import { Smartphone, Share2, AlertCircle, ChevronLeft, CheckCircle2, Clock, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATE_CONFIG: Record<string, { label: string; color: string }> = {
  created:        { label: 'נוצר',          color: 'bg-gray-100 text-gray-700' },
  awaiting_qr:    { label: 'ממתין QR',       color: 'bg-amber-100 text-amber-700' },
  scanning:       { label: 'בסריקה',         color: 'bg-blue-100 text-blue-700' },
  authorized:     { label: '✓ מחובר',        color: 'bg-green-100 text-green-700' },
  expired:        { label: 'פג תוקף',         color: 'bg-red-100 text-red-700' },
  paused:         { label: 'מושהה',          color: 'bg-gray-100 text-gray-500' },
  failed:         { label: 'כשל',            color: 'bg-red-100 text-red-700' },
  deleted:        { label: 'נמחק',           color: 'bg-gray-200 text-gray-400' },
};

export default async function AdminInstancesPage() {
  const supabase = adminServiceClient();

  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select(`
      id, provider, provider_instance_id, display_name, phone_number,
      state, is_shared, created_at, authorized_at, expires_at,
      messages_received_total, last_message_at,
      workspace_id,
      workspaces!whatsapp_instances_workspace_id_fkey(id, name, icon)
    `)
    .order('created_at', { ascending: false });

  // Count shared workspaces per instance
  const sharedIds = (instances || []).filter((i: any) => i.is_shared).map((i: any) => i.id);
  let linkCounts = new Map<string, number>();
  if (sharedIds.length > 0) {
    const { data: links } = await supabase
      .from('instance_workspace_links')
      .select('instance_id')
      .in('instance_id', sharedIds);
    for (const l of links || []) {
      const k = (l as any).instance_id;
      linkCounts.set(k, (linkCounts.get(k) || 0) + 1);
    }
  }

  // Count unrouted messages per shared instance
  const { data: unroutedMessages } = sharedIds.length > 0
    ? await supabase
        .from('wa_messages')
        .select('source_instance_id')
        .in('routing_status', ['unrouted_dm', 'unrouted_group'])
        .in('source_instance_id', sharedIds)
    : { data: [] };

  const unroutedCount = new Map<string, number>();
  for (const m of unroutedMessages || []) {
    const k = (m as any).source_instance_id;
    if (k) unroutedCount.set(k, (unroutedCount.get(k) || 0) + 1);
  }

  const total = instances?.length || 0;
  const sharedCount = (instances || []).filter((i: any) => i.is_shared).length;
  const totalUnrouted = Array.from(unroutedCount.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link href="/admin" className="text-xs text-slate-500 hover:text-amber-500 inline-flex items-center gap-1 mb-2">
              <ChevronLeft className="w-3 h-3" />
              חזרה ל-Admin
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-amber-500" />
              ניהול WhatsApp Instances
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              ניהול חיבורי Green API לכלל הסביבות בפלטפורמה
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400 mb-1">סך כל ה-Instances</div>
            <div className="text-2xl font-bold text-slate-100">{total}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400 mb-1">מחוברים פעילים</div>
            <div className="text-2xl font-bold text-green-400">
              {(instances || []).filter((i: any) => i.state === 'authorized').length}
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400 mb-1">משותפים</div>
            <div className="text-2xl font-bold text-purple-400">{sharedCount}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              הודעות לא מנותבות
            </div>
            <div className={`text-2xl font-bold ${totalUnrouted > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              {totalUnrouted}
            </div>
          </div>
        </div>

        {/* Banner if there are shared instances */}
        {sharedCount > 0 && (
          <div className="mb-6 bg-purple-950/30 border border-purple-800 rounded-xl p-4 flex items-start gap-3">
            <Share2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-200">
              <strong className="block mb-1 text-purple-100">{sharedCount} instances משותפים פעילים</strong>
              ב-instances משותפים, כל קבוצה צריכה הגדרת ניתוב ידנית. הודעות DM לא ינותבו אוטומטית.
              {totalUnrouted > 0 && (
                <span className="text-amber-300 mt-1 block">
                  ⚠ יש {totalUnrouted} הודעות שמחכות לניתוב.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Instances list */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">כל ה-Instances</h2>
            <span className="text-xs text-slate-500">{total} פריטים</span>
          </div>

          {!instances || instances.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-30" />
              עדיין לא נוצרו instances
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {instances.map((inst: any) => {
                const ws = Array.isArray(inst.workspaces) ? inst.workspaces[0] : inst.workspaces;
                const stateConfig = STATE_CONFIG[inst.state] || STATE_CONFIG.created;
                const sharedWith = linkCounts.get(inst.id) || 0;
                const unrouted = unroutedCount.get(inst.id) || 0;

                return (
                  <li key={inst.id}>
                    <Link
                      href={`/admin/instances/${inst.id}`}
                      className="px-4 py-3 hover:bg-slate-800/50 transition-colors flex items-center gap-3 group"
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg grid place-items-center flex-shrink-0 ${
                        inst.is_shared ? 'bg-purple-900/40 text-purple-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {inst.is_shared ? <Share2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-100 truncate">
                            {inst.display_name}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stateConfig.color}`}>
                            {stateConfig.label}
                          </span>
                          {inst.is_shared && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 font-medium inline-flex items-center gap-1">
                              <Share2 className="w-2.5 h-2.5" />
                              משותף ב-{sharedWith + 1} סביבות
                            </span>
                          )}
                          {unrouted > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 font-medium inline-flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              {unrouted} ממתינים
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span className="font-mono">{inst.provider_instance_id}</span>
                          <span>·</span>
                          <span>{ws?.icon || '📊'} {ws?.name || '?'}</span>
                          {inst.phone_number && (
                            <>
                              <span>·</span>
                              <span dir="ltr">{inst.phone_number}</span>
                            </>
                          )}
                          {inst.messages_received_total > 0 && (
                            <>
                              <span>·</span>
                              <span>{inst.messages_received_total.toLocaleString()} הודעות</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronLeft className="w-4 h-4 text-slate-600 group-hover:text-amber-500 group-hover:-translate-x-0.5 transition-all" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
