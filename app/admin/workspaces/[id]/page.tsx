import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Building2, Users, Database, MessageSquare,
  Phone, Calendar, Activity, Eye, AlertTriangle,
} from 'lucide-react';
import ImpersonateButton from './ImpersonateButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { admin } = await requirePlatformAdmin();
  const supabase = adminServiceClient();

  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!ws) notFound();

  // Fetch all related data in parallel
  const [
    { data: members },
    { data: tables },
    { data: phones },
    { data: groups },
    { data: recentRecords },
    { data: recentMessages },
  ] = await Promise.all([
    supabase.from('workspace_members')
      .select('user_id, role, display_name, joined_at')
      .eq('workspace_id', params.id),
    supabase.from('tables')
      .select('id, name, icon, is_archived, created_at, updated_at')
      .eq('workspace_id', params.id)
      .order('position'),
    supabase.from('authorized_phones')
      .select('id, phone, display_name, job_title, is_active')
      .eq('workspace_id', params.id),
    supabase.from('whatsapp_groups')
      .select('id, group_name, green_api_chat_id, created_at')
      .eq('workspace_id', params.id),
    Promise.resolve({ data: null }),
    Promise.resolve({ data: null }),
  ]);

  // Compute counts manually since RPCs may not exist
  let totalRecords = 0;
  let totalMessages = 0;

  if (tables && tables.length > 0) {
    const tableIds = tables.map((t: any) => t.id);
    const { count: rc } = await supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .in('table_id', tableIds);
    totalRecords = rc || 0;
  }

  if (groups && groups.length > 0) {
    const groupIds = groups.map((g: any) => g.id);
    const { count: mc } = await supabase
      .from('wa_messages')
      .select('id', { count: 'exact', head: true })
      .in('group_id', groupIds);
    totalMessages = mc || 0;
  }

  // Get user emails for members
  const userIds = (members || []).map((m: any) => m.user_id).filter(Boolean);
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const usersMap = new Map((usersData?.users || []).map(u => [u.id, u.email]));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/workspaces"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה לרשימת סביבות
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-800 grid place-items-center text-3xl">
            {ws.icon || '📊'}
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-slate-100">{ws.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              <span className="font-mono">{ws.id}</span>
              <span>·</span>
              <span>{ws.vertical || 'general'}</span>
              <span>·</span>
              <span>נוצר {new Date(ws.created_at).toLocaleDateString('he-IL')}</span>
              <span>·</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                ws.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                ws.plan === 'business' ? 'bg-amber-500/20 text-amber-300' :
                ws.plan === 'starter' ? 'bg-blue-500/20 text-blue-300' :
                'bg-slate-700 text-slate-400'
              }`}>{ws.plan || 'trial'}</span>
            </div>
          </div>
        </div>
        <Link
          href={`/admin/workspaces/${params.id}/limits`}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-bold flex items-center gap-1.5"
        >
          <Activity className="w-4 h-4" />
          הגדרת מגבלות
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="חברים" value={members?.length || 0} />
        <StatCard icon={Database} label="טבלאות" value={tables?.filter((t: any) => !t.is_archived).length || 0} />
        <StatCard icon={Database} label="רשומות" value={totalRecords.toLocaleString('he-IL')} />
        <StatCard icon={MessageSquare} label="הודעות WA" value={totalMessages.toLocaleString('he-IL')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Members */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-200">חברים בסביבה</h2>
            <span className="text-xs text-slate-500">{members?.length || 0}</span>
          </div>
          {(!members || members.length === 0) ? (
            <div className="p-6 text-center text-slate-500 text-sm">אין חברים</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {members.map((m: any) => {
                const email = usersMap.get(m.user_id);
                return (
                  <div key={m.user_id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-100 font-medium">
                        {m.display_name || email?.split('@')[0] || '(unknown)'}
                      </div>
                      <div className="text-xs text-slate-500">{email || m.user_id.slice(0, 8)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.role === 'owner' ? 'bg-amber-500/20 text-amber-400' :
                        m.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                        m.role === 'editor' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {m.role}
                      </span>
                      {admin.can_impersonate && email && (
                        <ImpersonateButton
                          targetUserId={m.user_id}
                          targetEmail={email}
                          workspaceId={params.id}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tables */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-200">טבלאות</h2>
            <span className="text-xs text-slate-500">{tables?.length || 0}</span>
          </div>
          {(!tables || tables.length === 0) ? (
            <div className="p-6 text-center text-slate-500 text-sm">אין טבלאות</div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
              {tables.map((t: any) => (
                <div key={t.id} className="px-5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{t.icon || '📋'}</span>
                    <span className={`text-sm ${t.is_archived ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {t.name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(t.updated_at).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp groups */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-200">קבוצות WhatsApp</h2>
            <span className="text-xs text-slate-500">{groups?.length || 0}</span>
          </div>
          {(!groups || groups.length === 0) ? (
            <div className="p-6 text-center text-slate-500 text-sm">אין קבוצות מחוברות</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {groups.map((g: any) => (
                <div key={g.id} className="px-5 py-2.5">
                  <div className="text-sm text-slate-200">{g.group_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    הודעה אחרונה: {g.created_at ? new Date(g.created_at).toLocaleDateString('he-IL') : 'אף פעם'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phones */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-200">טלפונים מורשים</h2>
            <span className="text-xs text-slate-500">{phones?.length || 0}</span>
          </div>
          {(!phones || phones.length === 0) ? (
            <div className="p-6 text-center text-slate-500 text-sm">אין טלפונים מורשים</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {phones.map((p: any) => (
                <div key={p.id} className="px-5 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-200">{p.display_name}</div>
                    <div className="text-xs text-slate-500 font-mono" dir="ltr">{p.phone}</div>
                  </div>
                  {!p.is_active && (
                    <span className="text-[10px] text-red-400">לא פעיל</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-display font-black text-2xl text-slate-100 leading-none">{value}</div>
    </div>
  );
}
