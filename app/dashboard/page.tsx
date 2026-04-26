import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { LayoutGrid, MessageSquare, Database, TrendingUp, BookOpen, Code, FileText, ArrowLeft } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return null;
  const workspaceId = membership.workspace_id;

  // Stats
  const [{ count: tablesCount }, { count: recordsCount }, { count: messagesCount }, { data: tables }] =
    await Promise.all([
      supabase.from('tables').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('records').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('wa_messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('tables').select('*').eq('workspace_id', workspaceId).order('position').limit(6),
    ]);

  const { data: recentRecords } = await supabase
    .from('records')
    .select('id, data, source, created_at, table_id, tables(name, icon)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 md:mb-8 pr-12 md:pr-0">
        <h1 className="font-display font-bold text-xl md:text-3xl mb-1">סקירה</h1>
        <p className="text-gray-500">מבט מהיר על העסק שלך</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Database />} label="טבלאות" value={tablesCount || 0} />
        <StatCard icon={<LayoutGrid />} label="רשומות" value={recordsCount || 0} />
        <StatCard icon={<MessageSquare />} label="הודעות וואטסאפ" value={messagesCount || 0} />
      </div>

      {/* Resources section - quick access to guide, API, PDF */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <ResourceCard
          href="/docs"
          icon={<BookOpen className="w-5 h-5" />}
          title="מדריך משתמש"
          desc="כל מה שצריך לדעת על המערכת — 14 מאמרים בעברית"
          color="from-purple-500 to-purple-700"
        />
        <ResourceCard
          href="/docs/api"
          icon={<Code className="w-5 h-5" />}
          title="API למפתחים"
          desc="חבר את המערכת לאתר, אפליקציה או Zapier"
          color="from-blue-500 to-blue-700"
        />
        <ResourceCard
          href="/allchatboard-user-guide.pdf"
          icon={<FileText className="w-5 h-5" />}
          title="הורד PDF"
          desc="המדריך המלא, 23 עמודים — לקריאה offline או להדפסה"
          color="from-amber-500 to-orange-600"
          external
        />
      </div>

      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">הטבלאות שלי</h2>
          <Link href="/dashboard/whatsapp" className="text-sm text-brand-600 hover:underline">
            חברו וואטסאפ →
          </Link>
        </div>
        {tables && tables.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/${t.id}`}
                className="p-4 rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-sm transition-all group"
              >
                <div className="text-3xl mb-2">{t.icon}</div>
                <div className="font-medium group-hover:text-brand-700 transition-colors">{t.name}</div>
                {t.description && (
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>אין עדיין טבלאות</p>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          פעילות אחרונה
        </h2>
        {recentRecords && recentRecords.length > 0 ? (
          <div className="space-y-2">
            {recentRecords.map((r: any) => (
              <Link
                key={r.id}
                href={`/dashboard/${r.table_id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="text-2xl">{r.tables?.icon || '📋'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    רשומה חדשה ב-{r.tables?.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {Object.values(r.data || {}).slice(0, 2).join(' · ') || 'ללא תוכן'}
                  </div>
                </div>
                <div className="text-xs text-gray-400 shrink-0">
                  {r.source === 'whatsapp' && '💬'}
                  {r.source === 'manual' && '✏️'}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            עדיין אין פעילות. חברו את הוואטסאפ כדי להתחיל!
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({
  href, icon, title, desc, color, external,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  external?: boolean;
}) {
  const linkProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' as const }
    : {};

  return (
    <Link
      href={href}
      {...linkProps}
      className="group p-4 rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all bg-white"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} text-white grid place-items-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-1 group-hover:text-brand-700 transition-colors">
            {title}
            <ArrowLeft className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all" />
          </div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
