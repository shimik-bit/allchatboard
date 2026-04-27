import { adminServiceClient } from '@/lib/admin/auth';
import Link from 'next/link';
import {
  Smartphone, AlertTriangle, ExternalLink, CheckCircle2,
  Wifi, WifiOff, Power, X, Search,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  authorized:   { color: 'text-green-300',  bg: 'bg-green-900/30 border-green-700',  label: 'מחובר' },
  awaiting_qr:  { color: 'text-amber-300',  bg: 'bg-amber-900/30 border-amber-700',  label: 'ממתין לQR' },
  scanning:     { color: 'text-blue-300',   bg: 'bg-blue-900/30 border-blue-700',    label: 'סריקה' },
  created:      { color: 'text-gray-300',   bg: 'bg-gray-800 border-gray-700',       label: 'נוצר' },
  expired:      { color: 'text-orange-300', bg: 'bg-orange-900/30 border-orange-700', label: 'פג תוקף' },
  paused:       { color: 'text-gray-400',   bg: 'bg-gray-800 border-gray-700',       label: 'מושעה' },
  failed:       { color: 'text-red-300',    bg: 'bg-red-900/30 border-red-700',      label: 'שגיאה' },
  deleted:      { color: 'text-gray-500',   bg: 'bg-gray-900 border-gray-800',       label: 'נמחק' },
};

export default async function AdminInstancesPage() {
  const supabase = adminServiceClient();

  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select(`
      id, display_name, provider, provider_instance_id, phone_number, state,
      state_message, state_updated_at, authorized_at, expires_at,
      messages_received_total, messages_sent_total, last_message_at,
      created_at, workspace_id,
      workspaces:workspace_id (id, name, icon)
    `)
    .order('created_at', { ascending: false });

  // Group by state for stats
  const stats = {
    total: instances?.length || 0,
    authorized: instances?.filter((i: any) => i.state === 'authorized').length || 0,
    awaiting: instances?.filter((i: any) => ['awaiting_qr', 'scanning', 'created'].includes(i.state)).length || 0,
    expired: instances?.filter((i: any) => ['expired', 'failed'].includes(i.state)).length || 0,
    paused: instances?.filter((i: any) => i.state === 'paused').length || 0,
    deleted: instances?.filter((i: any) => i.state === 'deleted').length || 0,
  };

  // Detect duplicates - same provider_instance_id in multiple workspaces (the bug)
  const idCounts = new Map<string, number>();
  for (const inst of instances || []) {
    const key = `${(inst as any).provider}:${(inst as any).provider_instance_id}`;
    idCounts.set(key, (idCounts.get(key) || 0) + 1);
  }
  const duplicates = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin" className="text-amber-500 text-xs hover:underline mb-2 inline-block">
          ← חזרה לדשבורד
        </Link>
        <h1 className="font-display font-bold text-3xl text-white flex items-center gap-2">
          <Smartphone className="w-7 h-7 text-amber-500" />
          ניהול WhatsApp Instances
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          כל ה-instances של Green API (ופלטפורמות אחרות) על פני כל הסביבות
        </p>
      </div>

      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-300 mb-1">
                ⚠️ זוהו {duplicates.length} כפילויות
              </h3>
              <p className="text-xs text-red-200 mb-2">
                ה-instances הבאים מחוברים לכמה סביבות בו-זמנית. זה גורם לבעיות routing.
              </p>
              <ul className="text-xs text-red-200 space-y-0.5">
                {duplicates.map(([key, count]) => (
                  <li key={key} className="font-mono">
                    {key} → {count} סביבות
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <StatCard label="סה״כ" value={stats.total} color="text-white" />
        <StatCard label="מחוברים" value={stats.authorized} color="text-green-400" icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="ממתינים" value={stats.awaiting} color="text-amber-400" />
        <StatCard label="פג תוקף" value={stats.expired} color="text-orange-400" />
        <StatCard label="מושעים" value={stats.paused} color="text-gray-400" icon={<Power className="w-4 h-4" />} />
        <StatCard label="נמחקו" value={stats.deleted} color="text-gray-500" icon={<X className="w-4 h-4" />} />
      </div>

      {/* Instances table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
          <h2 className="font-bold text-white">כל ה-Instances ({instances?.length || 0})</h2>
        </div>
        {!instances || instances.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            עוד לא נוצרו instances במערכת
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-xs text-gray-400 uppercase">
                  <th className="px-3 py-2 text-right">שם תצוגה</th>
                  <th className="px-3 py-2 text-right">סביבה</th>
                  <th className="px-3 py-2 text-right">מספר</th>
                  <th className="px-3 py-2 text-right">Instance ID</th>
                  <th className="px-3 py-2 text-right">מצב</th>
                  <th className="px-3 py-2 text-right">הודעות</th>
                  <th className="px-3 py-2 text-right">נוצר</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((inst: any) => {
                  const ws = Array.isArray(inst.workspaces) ? inst.workspaces[0] : inst.workspaces;
                  const config = STATE_CONFIG[inst.state] || STATE_CONFIG.created;
                  return (
                    <tr key={inst.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 text-white font-medium">{inst.display_name}</td>
                      <td className="px-3 py-2.5">
                        {ws ? (
                          <Link
                            href={`/admin/workspaces/${ws.id}`}
                            className="text-amber-400 hover:underline inline-flex items-center gap-1"
                          >
                            {ws.icon || '📊'} {ws.name}
                          </Link>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs font-mono" dir="ltr">
                        {inst.phone_number || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs font-mono" dir="ltr">
                        {inst.provider_instance_id}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">
                        📥 {inst.messages_received_total} / 📤 {inst.messages_sent_total}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">
                        {new Date(inst.created_at).toLocaleDateString('he-IL', {
                          day: '2-digit', month: 'short', year: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3">
      <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
