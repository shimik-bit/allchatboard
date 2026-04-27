'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, Sparkles, AlertTriangle,
  CreditCard, Activity, ShieldAlert, ArrowLeft, LogOut,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      {/* Top bar - distinct dark theme to signal you're in admin mode */}
      <header className="bg-slate-900 border-b border-amber-500/30">
        <div className="px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white font-black text-sm">
              ⚡
            </div>
            <div>
              <div className="font-bold text-sm leading-none">Platform Admin</div>
              <div className="text-[10px] text-amber-400 leading-none mt-1">TaskFlow AI control panel</div>
            </div>
          </Link>

          <div className="flex-1" />

          <div className="text-xs text-slate-400">
            מחובר כ: <span className="text-amber-400 font-medium">{userEmail}</span>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            יציאה למערכת
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-[220px_1fr] min-h-[calc(100vh-49px)]">
        {/* Sidebar */}
        <aside className="bg-slate-900/50 border-l border-slate-800 p-3">
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
        </aside>

        <main className="p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
