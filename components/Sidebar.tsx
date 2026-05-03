'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, Table } from '@/lib/types/database';
import {
  LayoutGrid, Plus, Settings, MessageSquare, LogOut, HelpCircle, BookOpen, Key, Bell, Zap, CreditCard, Brain, Receipt, Activity, Wallet,
  ChevronDown, Sparkles, FileText, Phone, UserCheck, Menu, X, Shield, TrendingUp, Inbox,
  Layers, Store,
} from 'lucide-react';
import { DevModeToggle } from '@/components/DevMode';
import { useT } from '@/lib/i18n/useT';
import { useApps } from '@/lib/hooks/useApps';

export default function Sidebar({
  workspace, allWorkspaces = [], tables, userEmail,
}: {
  workspace: Workspace;
  allWorkspaces?: Array<{ id: string; name: string; icon: string; primary_color: string }>;
  tables: Table[];
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t, dir } = useT();
  const [showWsSwitcher, setShowWsSwitcher] = useState(false);

  async function handleWorkspaceSwitch(workspaceId: string) {
    if (workspaceId === workspace.id) {
      setShowWsSwitcher(false);
      return;
    }
    await fetch('/api/workspaces/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    setShowWsSwitcher(false);
    // Hard reload to dashboard root with new workspace
    window.location.href = '/dashboard';
  }
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHubMenu, setShowHubMenu] = useState(true); // Hub submenu open by default

  // Apps installed for this workspace — drives which sidebar items show.
  const { data: appsData } = useApps(workspace.id);
  const installedSlugs = new Set((appsData?.apps || []).filter((a) => a.is_installed).map((a) => a.slug));
  const isAppInstalled = (slug: string): boolean => installedSlugs.has(slug);
  // Hub apps (the sub-section under Hub) — only show those that are installed.
  // The four core "always-show" links (Settings, Tables, Inbox, API Keys, Phones,
  // Assignments, Workspace Switcher) are unaffected by this list.
  const HUB_APP_SLUGS = ['crm', 'buildbot', 'restobot'] as const;
  const installedHubApps = (appsData?.apps || []).filter(
    (a) => HUB_APP_SLUGS.includes(a.slug as typeof HUB_APP_SLUGS[number]) && a.is_installed
  );
  const hasAnyHubApp = installedHubApps.length > 0;

  // Mobile drawer state. The sidebar is hidden by default on mobile (<md) and
  // toggled via a hamburger button. On desktop, this state is irrelevant —
  // the sidebar is always visible thanks to md:translate-x-0 below.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Open escalation count for the inbox badge. Polled every 30s as a cheap
  // approximation of real-time — proper WebSocket subscriptions could come
  // later but for the MVP, polling is good enough and uses no extra infra.
  // Resets when the workspace changes (different workspace = different count).
  const [openEscalationCount, setOpenEscalationCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const { count } = await supabase
          .from('escalations')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'open');
        if (!cancelled) setOpenEscalationCount(count || 0);
      } catch {
        // Silent on error — badge just stays at last known value
      }
    }
    loadCount();
    const t = setInterval(loadCount, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [workspace.id, supabase]);

  // Auto-close the drawer when the user navigates to a new page. Without
  // this, tapping a link on mobile would change the route but leave the
  // drawer open covering the new content.
  useEffect(() => {
    setMobileOpen(false);
    setShowUserMenu(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open so background content doesn't
  // scroll under the user's finger when they're trying to scroll the menu.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const trialDays = Math.max(0, Math.ceil(
    (new Date(workspace.trial_ends_at).getTime() - Date.now()) / 86400000
  ));

  return (
    <>
      {/* ── Mobile-only hamburger button ──────────────────────────────────
          Floats top-right (RTL) when the drawer is closed. Hidden on
          md+ where the sidebar is permanently visible. */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label={t('common.open')}
          className="md:hidden fixed top-3 right-3 z-40 w-10 h-10 grid place-items-center bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {/* ── Mobile-only overlay ──────────────────────────────────────────
          Dims the background and closes the drawer when tapped. */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
          aria-hidden
        />
      )}

      {/* ── Sidebar / drawer ─────────────────────────────────────────────
          - Desktop (md+): static, always visible at w-64
          - Mobile (<md): fixed-position drawer that slides in from the
            right (RTL). Hidden via translate-x-full when closed. */}
      <aside
        className={`
          bg-white border-l border-gray-200 flex flex-col h-screen
          fixed md:static top-0 right-0 z-50
          w-72 max-w-[85vw] md:w-64
          transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile-only close button inside the drawer header */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label={t('common.close')}
          className="md:hidden absolute top-3 left-3 z-10 w-8 h-8 grid place-items-center text-gray-500 hover:bg-gray-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TaskFlow AI brand stripe */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <Link href="/" className="flex items-center justify-center">
            <img
              src="/taskflow-logo.png"
              alt="TaskFlow AI"
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Workspace header - clickable switcher when multiple workspaces */}
        <div className="p-4 border-b border-gray-100 relative">
          <button
            onClick={() => allWorkspaces.length > 1 && setShowWsSwitcher(!showWsSwitcher)}
            className={`w-full flex items-center gap-2 ${allWorkspaces.length > 1 ? 'cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded-lg transition-colors' : ''}`}
            disabled={allWorkspaces.length <= 1}
          >
            <div
              className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold flex-shrink-0"
              style={{ background: workspace.primary_color }}
            >
              {(workspace as any).icon || workspace.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="font-semibold text-sm truncate">{workspace.name}</div>
              <div className="text-xs text-gray-500">
                {allWorkspaces.length > 1 ? (
                  <span className="inline-flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" />
                    {allWorkspaces.length} סביבות · החלף
                  </span>
                ) : (
                  workspace.plan === 'trial' ? `${t('common.optional')} - ${trialDays}d` : workspace.plan
                )}
              </div>
            </div>
          </button>

          {/* Workspace switcher dropdown */}
          {showWsSwitcher && allWorkspaces.length > 1 && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowWsSwitcher(false)}
              />
              <div className="absolute top-full right-4 left-4 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-40 max-h-80 overflow-y-auto">
                <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  בחר סביבת עבודה
                </div>
                {allWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => handleWorkspaceSwitch(ws.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-right ${
                      ws.id === workspace.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg grid place-items-center text-white font-bold text-xs flex-shrink-0"
                      style={{ background: ws.primary_color }}
                    >
                      {ws.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${ws.id === workspace.id ? 'font-bold text-brand-700' : 'text-gray-800'}`}>
                        {ws.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">
                        {ws.id.slice(0, 8)}
                      </div>
                    </div>
                    {ws.id === workspace.id && (
                      <span className="text-[10px] text-brand-600 font-bold">פעיל</span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => router.push('/onboarding')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 hover:bg-gray-50 text-brand-600"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">צור סביבה חדשה</span>
                </button>
              </div>
            </>
          )}
        </div>

      {/* Agency context bar — shown when:
          - The current workspace is type='agency' → link back to Agency Hub
          - The current workspace is type='client' → "managed by X" badge
          Both cases give the user clear context about WHERE they are in the
          agency-client hierarchy, so they don't get confused after switching
          into a client from the hub. */}
      {(workspace as any).type === 'agency' && (
        <Link
          href="/dashboard/agency"
          className={`mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathname === '/dashboard/agency' || pathname?.startsWith('/dashboard/agency/')
              ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <span className="text-base">👑</span>
          חלל סוכנות
        </Link>
      )}
      {(workspace as any).type === 'client' && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs bg-blue-50 text-blue-800 ring-1 ring-blue-100">
          <div className="flex items-center gap-1.5 font-medium">
            <span>🏢</span>
            לקוח של סוכנות
          </div>
          <div className="text-blue-600/80 mt-0.5 text-[11px]">
            חלל זה מנוהל על ידי סוכנות חיצונית
          </div>
        </div>
      )}

      {/* Navigation */}
      {/* pb-safe: extra bottom padding to clear iOS home-indicator (the bar at the
          bottom of the screen on phones without home button) - otherwise the last
          menu items get hidden behind it. Combined with env(safe-area-inset-bottom)
          for browsers that support it. */}
      <nav className="flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Focus Mode - prominent */}
        <Link
          href="/dashboard/focus"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold mb-2 transition-all ${
            pathname === '/dashboard/focus'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
              : 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 hover:shadow-sm border border-purple-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>תפקס אותי</span>
          <span className={`mr-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
            pathname === '/dashboard/focus' ? 'bg-white/20' : 'bg-purple-200 text-purple-700'
          }`}>AI</span>
        </Link>

        {/* Inbox - escalation queue. Badge shows # open escalations.
            We render a non-zero badge in red so it's hard to ignore — these are
            things waiting for human attention, after all. */}
        <Link
          href="/dashboard/inbox"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold mb-2 transition-all ${
            pathname === '/dashboard/inbox' || pathname?.startsWith('/dashboard/inbox/')
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 hover:shadow-sm border border-amber-100'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>תיבה נכנסת</span>
          {openEscalationCount > 0 && (
            <span className={`mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              pathname === '/dashboard/inbox' || pathname?.startsWith('/dashboard/inbox/')
                ? 'bg-white/30 text-white'
                : 'bg-red-500 text-white'
            }`}>
              {openEscalationCount}
            </span>
          )}
        </Link>

        {/* Cashflow Dashboard - prominent */}
        <Link
          href="/dashboard/cashflow"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold mb-2 transition-all ${
            pathname === '/dashboard/cashflow'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
              : 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 hover:shadow-sm border border-emerald-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>תזרים מזומנים</span>
          <span className={`mr-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
            pathname === '/dashboard/cashflow' ? 'bg-white/20' : 'bg-emerald-200 text-emerald-700'
          }`}>AI</span>
        </Link>

        {/* ============ My Apps — link to the marketplace ============ */}
        <Link
          href="/dashboard/apps"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-2 transition-colors ${
            pathname === '/dashboard/apps'
              ? 'bg-purple-50 text-purple-700 border border-purple-100'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>אפליקציות</span>
          {!hasAnyHubApp && (
            <span className="mr-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              התקן
            </span>
          )}
        </Link>

        {/* ============ Hub — only shown if any hub app is installed ============ */}
        {hasAnyHubApp && (
          <div className="mb-1">
            <button
              onClick={() => setShowHubMenu(!showHubMenu)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/dashboard/hub')
                  ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-100'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t('hub.title')}</span>
              <ChevronDown
                className={`mr-auto w-3.5 h-3.5 transition-transform ${showHubMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showHubMenu && (
              <div className="mt-1 mr-3 pr-2 border-r-2 border-purple-100 space-y-0.5">
                <Link
                  href="/dashboard/hub"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    pathname === '/dashboard/hub'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t('hub.nav_overview')}</span>
                </Link>

                {/* Render each installed hub-app and its declared sidebar links */}
                {installedHubApps.map((app) => (
                  <div key={app.slug}>
                    {(app.sidebar_links || []).map((link, idx) => {
                      const isPrimary = idx === 0;
                      return (
                        <Link
                          key={link.path}
                          href={link.path}
                          className={`flex items-center gap-2 ${
                            isPrimary ? 'px-3' : (dir === 'rtl' ? 'pr-7' : 'pl-7')
                          } py-1.5 rounded-md text-xs font-medium transition-colors ${
                            pathname === link.path
                              ? 'bg-purple-100 text-purple-700'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {isPrimary
                            ? <span className="text-sm" style={{ color: app.color }}>{app.icon}</span>
                            : <span className="text-xs">↳</span>}
                          <span>{link.label_he}</span>
                          {isPrimary && app.is_beta && (
                            <span className="mr-auto text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                              BETA
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
            pathname === '/dashboard'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          {t('nav.overview')}
        </Link>

        {isAppInstalled('whatsapp') && (
          <Link
            href="/dashboard/whatsapp"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
              pathname === '/dashboard/whatsapp'
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {t('nav.whatsapp')}
          </Link>
        )}

        {isAppInstalled('spam_protect') && (
          <Link
            href="/dashboard/groupguard"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
              pathname === '/dashboard/groupguard'
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            הגנה מספאם
          </Link>
        )}

        {isAppInstalled('automations') && (
          <Link
            href="/dashboard/automations"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
              pathname === '/dashboard/automations'
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Zap className="w-4 h-4" />
            {t('nav.automations')}
          </Link>
        )}

        {isAppInstalled('reports') && (
          <Link
            href="/dashboard/reports"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
              pathname === '/dashboard/reports'
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Bell className="w-4 h-4" />
            {t('nav.reports')}
          </Link>
        )}

        <Link
          href="/dashboard/api-keys"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
            pathname === '/dashboard/api-keys'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Key className="w-4 h-4" />
          {t('nav.api_keys')}
        </Link>

        <Link
          href="/dashboard/phones"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
            pathname === '/dashboard/phones'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Phone className="w-4 h-4" />
          {t('nav.phones')}
        </Link>

        <Link
          href="/dashboard/assignments"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
            pathname === '/dashboard/assignments'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          {t('nav.assignments')}
        </Link>

        <div className="mt-6 mb-2 px-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {t('nav.tables')}
          </span>
          <div className="flex items-center gap-0.5">
            <Link
              href="/dashboard/templates"
              className="p-1 rounded hover:bg-gray-100"
              title={t('tables.new')}
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
            </Link>
            <Link
              href="/dashboard/tables/new"
              className="p-1 rounded hover:bg-gray-100"
              title={t('tables.new')}
            >
              <Plus className="w-3.5 h-3.5 text-gray-500" />
            </Link>
          </div>
        </div>

        {tables.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400 text-center">
            {t('tables.no_tables')}
          </div>
        ) : (
          tables.map((t) => {
            const isActive = pathname === `/dashboard/${t.id}`;
            return (
              <Link
                key={t.id}
                href={`/dashboard/${t.id}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{t.icon}</span>
                <span className="truncate">{t.name}</span>
              </Link>
            );
          })
        )}

        {/* AI usage */}
        <div className="mt-6 mx-2 p-3 rounded-xl bg-gradient-to-br from-brand-50 to-purple-50 border border-brand-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {t('common.info')}
          </div>
          <div className="flex items-end justify-between text-xs text-gray-600 mb-1.5">
            <span>{workspace.ai_messages_used.toLocaleString()}</span>
            <span>{workspace.ai_messages_limit.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (workspace.ai_messages_used / workspace.ai_messages_limit) * 100)}%`,
              }}
            />
          </div>
        </div>
      </nav>

      {/* Dev mode toggle */}
      <div className="border-t border-gray-100 px-3 pt-3 pb-1">
        <DevModeToggle />
      </div>

      {/* User menu */}
      <div className="border-t border-gray-100 p-3 relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gray-200 grid place-items-center text-xs font-semibold">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-right min-w-0">
            <div className="text-xs font-medium truncate">{userEmail}</div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 animate-fade-in">
            <Link
              href="/dashboard/settings"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" /> {t('nav.settings')}
            </Link>
            <Link
              href="/dashboard/billing"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <CreditCard className="w-4 h-4" /> חיוב ומנוי
            </Link>
            <Link
              href="/dashboard/invoices"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Receipt className="w-4 h-4" /> חשבוניות
            </Link>
            <Link
              href="/dashboard/knowledge"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Brain className="w-4 h-4" /> בוט מידע AI
            </Link>
            <Link
              href="/dashboard/ai-usage"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Activity className="w-4 h-4" /> שימוש ב-AI
            </Link>
            <Link
              href="/dashboard/wallet"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Wallet className="w-4 h-4" /> ארנק AI
            </Link>
            <button
              onClick={() => {
                setShowUserMenu(false);
                try { localStorage.removeItem('allchatboard:onboarding-seen-v1'); } catch {}
                window.location.reload();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
            >
              <HelpCircle className="w-4 h-4" /> {t('nav.help')}
            </button>
            <a
              href="https://docs.taskflow-ai.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <BookOpen className="w-4 h-4" /> {t('nav.docs')}
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
            >
              <LogOut className="w-4 h-4" /> {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
