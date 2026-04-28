'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Settings as SettingsIcon, Zap, Database, Link2,
  AlertCircle, Loader2, Save,
} from 'lucide-react';

import GeneralTab from './tabs/GeneralTab';
import AutomationsTab from './tabs/AutomationsTab';
import DefaultsTab from './tabs/DefaultsTab';

// ─── Types ──────────────────────────────────────────────────────────────────
export type TableData = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  settings: any;
  workspace_id: string;
  ai_keywords: string[] | null;
};

export type FieldData = {
  id: string;
  name: string;
  slug: string;
  type: string;
  position: number;
  options: any;
};

type Tab = 'general' | 'automations' | 'defaults';

// ─── Component ──────────────────────────────────────────────────────────────
export default function TableSettingsClient({
  table: initialTable,
  fields,
  isAdmin,
}: {
  table: TableData;
  fields: FieldData[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('automations'); // start on the most useful tab
  const [table, setTable] = useState(initialTable);
  const [error, setError] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: typeof SettingsIcon; description: string }[] = [
    { id: 'general', label: 'כללי', icon: SettingsIcon, description: 'שם, תיאור, צבע' },
    { id: 'automations', label: 'אוטומציות', icon: Zap, description: 'תזכורות, התראות, רצפים' },
    { id: 'defaults', label: 'ברירות מחדל', icon: Link2, description: 'לינקים, כתובות, משך' },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* ─── Header ─── */}
      <header className="border-b border-violet-100 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/dashboard/${table.id}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shrink-0"
              aria-label="חזרה לטבלה"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-xl shrink-0"
              style={{ backgroundColor: table.color || '#7C3AED' }}
            >
              {table.icon || '📋'}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 text-lg leading-tight truncate">
                הגדרות {table.name}
              </h1>
              <p className="text-xs text-slate-500 truncate">{table.description || `טבלה: ${table.slug}`}</p>
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div className="mx-auto max-w-6xl px-4 -mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition shrink-0 ${
                  isActive
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 font-bold">×</button>
          </div>
        )}

        {!isAdmin && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ אתה במצב צפייה בלבד. רק מנהלי workspace יכולים לערוך הגדרות.
          </div>
        )}

        {tab === 'general' && (
          <GeneralTab table={table} setTable={setTable} setError={setError} disabled={!isAdmin} />
        )}
        {tab === 'automations' && (
          <AutomationsTab table={table} fields={fields} setError={setError} disabled={!isAdmin} />
        )}
        {tab === 'defaults' && (
          <DefaultsTab table={table} setTable={setTable} fields={fields} setError={setError} disabled={!isAdmin} />
        )}
      </main>
    </div>
  );
}
