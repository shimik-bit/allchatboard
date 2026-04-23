'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, Table } from '@/lib/types/database';
import {
  LayoutGrid, Plus, Settings, MessageSquare, LogOut,
  ChevronDown, Sparkles, FileText, Phone,
} from 'lucide-react';

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
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const trialDays = Math.max(0, Math.ceil(
    (new Date(workspace.trial_ends_at).getTime() - Date.now()) / 86400000
  ));

  return (
    <aside className="w-64 bg-white border-l border-gray-200 flex flex-col h-screen">
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
              {workspace.plan === 'trial' ? `ניסיון - ${trialDays} ימים` : workspace.plan}
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
          סקירה
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
          וואטסאפ
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
          מספרים מורשים
        </Link>

        <div className="mt-6 mb-2 px-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            הטבלאות שלי
          </span>
          <div className="flex items-center gap-0.5">
            <Link
              href="/dashboard/templates"
              className="p-1 rounded hover:bg-gray-100"
              title="הוסף תבנית מוכנה"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
            </Link>
            <Link
              href="/dashboard/tables/new"
              className="p-1 rounded hover:bg-gray-100"
              title="הוסף טבלה חדשה"
            >
              <Plus className="w-3.5 h-3.5 text-gray-500" />
            </Link>
          </div>
        </div>

        {tables.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400 text-center">
            אין טבלאות עדיין
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
            שימוש ב-AI החודש
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
              <Settings className="w-4 h-4" /> הגדרות
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
            >
              <LogOut className="w-4 h-4" /> התנתקות
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
