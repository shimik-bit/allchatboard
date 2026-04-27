import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import OnboardingTour from '@/components/OnboardingTour';
import { DevModeIndicator } from '@/components/DevMode';
import { LanguageProvider } from '@/lib/i18n/provider';
import { isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/locales';

const ACTIVE_WS_COOKIE = 'tf_active_workspace';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Get ALL of user's workspaces
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) redirect('/onboarding');

  // Determine which workspace to show:
  // 1. Cookie value (last selected workspace)
  // 2. First membership as fallback
  const cookieStore = cookies();
  const cookieWsId = cookieStore.get(ACTIVE_WS_COOKIE)?.value;

  let activeMembership = memberships[0];
  if (cookieWsId) {
    const found = memberships.find(m => m.workspace_id === cookieWsId);
    if (found) activeMembership = found;
  }

  const workspace = Array.isArray(activeMembership.workspaces)
    ? activeMembership.workspaces[0]
    : activeMembership.workspaces;

  if (!workspace) redirect('/onboarding');

  // Build list of all workspaces for the selector
  const allWorkspaces = memberships.map(m => {
    const ws: any = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return ws ? { id: ws.id, name: ws.name, icon: ws.icon || '📊', primary_color: ws.primary_color } : null;
  }).filter(Boolean) as Array<{ id: string; name: string; icon: string; primary_color: string }>;

  // Pick locale from workspace (defaults to Hebrew)
  const locale = isValidLocale((workspace as any).locale) ? (workspace as any).locale : DEFAULT_LOCALE;

  // Get tables for this workspace
  const { data: tables } = await supabase
    .from('tables')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_archived', false)
    .order('position');

  return (
    <LanguageProvider locale={locale}>
      <div className="h-screen flex flex-col bg-gray-50" dir={locale === 'he' ? 'rtl' : 'ltr'}>
        {/* DevMode banner above everything - covers the full width */}
        <DevModeIndicator />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            workspace={workspace}
            allWorkspaces={allWorkspaces}
            tables={tables || []}
            userEmail={user.email || ''}
          />
          {/* Padding-top on mobile so the hamburger button (top-3 right-3) doesn't
              overlap content. Reset on md+ where the hamburger is hidden. */}
          <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
            {children}
          </main>
        </div>

        <OnboardingTour />
      </div>
    </LanguageProvider>
  );
}
