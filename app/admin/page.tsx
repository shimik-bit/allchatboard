import { getPlatformStats } from '@/lib/admin/stats';
import Link from 'next/link';
import {
  TrendingUp, Building2, Users, Database, MessageSquare,
  DollarSign, Sparkles, Activity, ChevronLeft,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminOverview() {
  const stats = await getPlatformStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">תמונת מצב פלטפורמה</h1>
        <p className="text-sm text-slate-400">סקירה כוללת של כל הסביבות והפעילות במערכת</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Building2}
          label="סביבות פעילות"
          value={stats.active_workspaces_30d}
          delta={`מתוך ${stats.total_workspaces} סך הכל`}
          color="amber"
        />
        <KpiCard
          icon={Users}
          label="משתמשים סה״כ"
          value={stats.total_users}
          delta={`+${stats.new_users_7d} חדשים השבוע`}
          color="blue"
        />
        <KpiCard
          icon={Database}
          label="רשומות סה״כ"
          value={stats.total_records.toLocaleString('he-IL')}
          delta={`+${stats.records_created_24h} ב-24 שעות`}
          color="green"
        />
        <KpiCard
          icon={MessageSquare}
          label="הודעות WhatsApp"
          value={stats.total_messages.toLocaleString('he-IL')}
          delta={`+${stats.messages_processed_24h} היום`}
          color="purple"
        />
      </div>

      {/* AI usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">AI · 30 ימים</span>
          </div>
          <div className="text-3xl font-display font-black text-slate-100">
            {stats.ai_briefings_30d}
          </div>
          <div className="text-xs text-slate-400 mt-1">בריפינגי Focus Mode</div>
          <div className="border-t border-purple-500/20 mt-3 pt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Tokens</div>
              <div className="text-sm font-bold text-slate-200">
                {(stats.ai_total_tokens_30d / 1000).toFixed(1)}K
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">עלות</div>
              <div className="text-sm font-bold text-slate-200">
                ${stats.ai_total_cost_usd_30d.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">פעילות 24ש</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">רשומות חדשות</span>
              <span className="font-bold text-slate-100">{stats.records_created_24h}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">הודעות WhatsApp</span>
              <span className="font-bold text-slate-100">{stats.messages_processed_24h}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">הרשמות היום</span>
              <span className="font-bold text-slate-100">{stats.signups_today}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">הרשמות 7 ימים</span>
              <span className="font-bold text-amber-400">{stats.signups_7d}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Health</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Activation rate</span>
              <span className="font-bold text-emerald-300">
                {stats.total_workspaces > 0
                  ? Math.round((stats.active_workspaces_30d / stats.total_workspaces) * 100)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg records/ws</span>
              <span className="font-bold text-slate-100">
                {stats.total_workspaces > 0
                  ? Math.round(stats.total_records / stats.total_workspaces)
                  : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg msgs/ws</span>
              <span className="font-bold text-slate-100">
                {stats.total_workspaces > 0
                  ? Math.round(stats.total_messages / stats.total_workspaces)
                  : 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top workspaces */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-100">סביבות מובילות</h2>
            <p className="text-xs text-slate-500 mt-0.5">לפי פעילות (רשומות + הודעות)</p>
          </div>
          <Link
            href="/admin/workspaces"
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            הצג הכל
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        {stats.top_workspaces.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">אין סביבות עדיין</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">סביבה</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">חברים</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">רשומות</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">הודעות</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">פעילות אחרונה</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {stats.top_workspaces.map(ws => (
                <tr key={ws.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ws.icon || '📊'}</span>
                      <span className="text-slate-100 font-medium">{ws.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-300">{ws.member_count}</td>
                  <td className="px-5 py-3 text-sm text-slate-300">{ws.record_count}</td>
                  <td className="px-5 py-3 text-sm text-slate-300">{ws.message_count}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {ws.last_activity ? formatRelativeTime(ws.last_activity) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <Link
                      href={`/admin/workspaces/${ws.id}`}
                      className="text-amber-400 hover:text-amber-300 text-xs"
                    >
                      פרטים →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, delta, color,
}: {
  icon: any;
  label: string;
  value: string | number;
  delta: string;
  color: 'amber' | 'blue' | 'green' | 'purple';
}) {
  const colorMap: Record<string, string> = {
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{label}</span>
      </div>
      <div className="font-display font-black text-3xl text-slate-100 leading-none">{value}</div>
      <div className="text-[11px] text-slate-400 mt-2">{delta}</div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor(diff / (60 * 1000));
  if (days >= 1) return `לפני ${days} ${days === 1 ? 'יום' : 'ימים'}`;
  if (hours >= 1) return `לפני ${hours} ש'`;
  if (mins >= 1) return `לפני ${mins} דק'`;
  return 'הרגע';
}
