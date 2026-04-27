'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, Sparkles, AlertTriangle,
  CreditCard, Activity, ShieldAlert, ArrowLeft, LogOut, Smartphone,
  Menu, X,
} from 'lucide-react';
import type { PlatformAdmin } from '@/lib/admin/auth';

export default function AdminShell({
  admin, userEmail, children,
}: {
  admin: PlatformAdmin;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const navSections = [
    {
      title: 'Overview',
      items: [
        { href: '/admin', icon: LayoutDashboard, label: 'תמונת מצב' },
      ],
    },
    {
      title: 'Customers',
      items: [
        { href: '/admin/workspaces', icon: Building2, label: 'סביבות' },
        { href: '/admin/users', icon: Users, label: 'משתמשים' },
        { href: '/admin/instances', icon: Smartphone, label: 'WhatsApp Instances' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { href: '/admin/ai-usage', icon: Sparkles, label: 'שימוש ב-AI' },
        { href: '/admin/errors', icon: AlertTriangle, label: 'שגיאות' },
        { href: '/admin/activity', icon: Activity, label: 'פעילות' },
      ],
    },
    ...(admin.can_view_billing ? [{
      title: 'Business',
      items: [
        { href: '/admin/billing', icon: CreditCard, label: 'תשלומים' },
      ],
    }] : []),
    ...(admin.can_impersonate ? [{
      title: 'Audit',
      items: [
        { href: '/admin/impersonations', icon: ShieldAlert, label: 'לוג כניסה כמשתמש' },
      ],
    }] : []),
  ];

  const sidebarContent = (
    <>
      <nav className="space-y-4">
        {navSections.map(section => (
          <div key={section.title}>
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 font-medium'
                          : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-6 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-200/70">
        ⚠️ מצב Admin פעיל. יש לך גישה ל-<strong>כל</strong> הסביבות במערכת.
      </div>

      {/* Mobile-only: user info + exit at bottom of drawer */}
      <div className="mt-6 pt-6 border-t border-slate-800 lg:hidden space-y-3">
        <div className="px-3 text-xs text-slate-400">
          מחובר כ:
          <span className="text-amber-400 font-medium block truncate mt-0.5">{userEmail}</span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/50"
        >
          <ArrowLeft className="w-4 h-4" />
          יציאה למערכת
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      {/* Top bar */}
      <header className="bg-slate-900 border-b border-amber-500/30 sticky top-0 z-40">
        <div className="px-3 sm:px-4 py-3 flex items-center gap-3">
          {/* Hamburger - mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 -m-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 flex-shrink-0"
            aria-label="פתח תפריט"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white font-black text-sm flex-shrink-0">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm leading-none truncate">Platform Admin</div>
              <div className="text-[10px] text-amber-400 leading-none mt-1 hidden sm:block">TaskFlow AI control panel</div>
            </div>
          </Link>

          <div className="flex-1" />

          {/* Desktop-only header info */}
          <div className="hidden lg:block text-xs text-slate-400">
            מחובר כ: <span className="text-amber-400 font-medium">{userEmail}</span>
          </div>

          <Link
            href="/dashboard"
            className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            יציאה למערכת
          </Link>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-49px)]">
        {/* Sidebar - desktop only */}
        <aside className="hidden lg:block lg:w-[220px] bg-slate-900/50 border-l border-slate-800 p-3 flex-shrink-0">
          {sidebarContent}
        </aside>

        {/* Mobile drawer overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile drawer - slides from right (RTL) */}
        <aside
          className={`lg:hidden fixed top-0 right-0 z-50 h-full w-[280px] max-w-[85vw] bg-slate-900 border-l border-slate-800 p-3 overflow-y-auto transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white font-black text-sm">
                ⚡
              </div>
              <div className="font-bold text-sm">Admin</div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              aria-label="סגור תפריט"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {sidebarContent}
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
