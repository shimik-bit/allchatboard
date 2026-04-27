'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, Table } from '@/lib/types/database';
import {
  LayoutGrid, Plus, Settings, MessageSquare, LogOut, HelpCircle, BookOpen, Key, Bell, Zap,
  ChevronDown, Sparkles, FileText, Phone, UserCheck, Menu, X, Shield,
} from 'lucide-react';
import { DevModeToggle } from '@/components/DevMode';
import { useT } from '@/lib/i18n/useT';

export default function Sidebar({
  workspace, tables, userEmail,
}: {
  workspace: Workspace;
  tables: Table[];
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Mobile drawer state. The sidebar is hidden by default on mobile (<md) and
  // toggled via a hamburger button. On desktop, this state is irrelevant —
  // the sidebar is always visible thanks to md:translate-x-0 below.
  const [mobileOpen, setMobileOpen] = useState(false);

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

        {/* Workspace header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold"
              style={{ background: workspace.primary_color }}
            >
              {workspace.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{workspace.name}</div>
              <div className="text-xs text-gray-500">
                {workspace.plan === 'trial' ? `${t('common.optional')} - ${trialDays}d` : workspace.plan}
              </div>
            </div>
          </div>
        </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
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
