import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Get user's workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(*)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) redirect('/onboarding');

  const workspace = Array.isArray(membership.workspaces)
    ? membership.workspaces[0]
    : membership.workspaces;

  // Get tables
  const { data: tables } = await supabase
    .from('tables')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_archived', false)
    .order('position');

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        workspace={workspace}
        tables={tables || []}
        userEmail={user.email || ''}
      />
      {/* Padding-top on mobile so the hamburger button (top-3 right-3) doesn't
          overlap content. Reset on md+ where the hamburger is hidden. */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
