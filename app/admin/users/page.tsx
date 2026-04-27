import { adminServiceClient } from '@/lib/admin/auth';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsersListPage() {
  const supabase = adminServiceClient();
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users || [];

  // Get workspace memberships for each user
  const userIds = users.map(u => u.id);
  const { data: memberships } = userIds.length > 0
    ? await supabase
        .from('workspace_members')
        .select('user_id, workspace_id, role, workspaces(name, icon)')
        .in('user_id', userIds)
    : { data: [] };

  const membersByUser = new Map<string, any[]>();
  for (const m of (memberships || []) as any[]) {
    if (!membersByUser.has(m.user_id)) membersByUser.set(m.user_id, []);
    membersByUser.get(m.user_id)!.push(m);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100 mb-1">משתמשים</h1>
        <p className="text-sm text-slate-400">{users.length} משתמשים רשומים במערכת</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">אימייל</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">סביבות</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">נרשם</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">התחבר לאחרונה</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const wsList = membersByUser.get(u.id) || [];
              return (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-sm">
                    <div className="text-slate-100 font-medium">{u.email}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{u.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {wsList.length === 0 ? (
                      <span className="text-slate-500 text-xs">אין</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {wsList.slice(0, 3).map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300">
                            {m.workspaces?.icon || '📊'} {m.workspaces?.name}
                          </span>
                        ))}
                        {wsList.length > 3 && (
                          <span className="text-[10px] text-slate-500">+{wsList.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {u.email_confirmed_at ? (
                      <span className="text-emerald-400">מאומת</span>
                    ) : (
                      <span className="text-amber-400">ממתין</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">אין משתמשים עדיין</p>
          </div>
        )}
      </div>
    </div>
  );
}
