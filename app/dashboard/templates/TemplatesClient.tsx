'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Check, X, Package, Layers, ChevronDown, ChevronUp, Download, AlertCircle } from 'lucide-react';

type Field = {
  name: string;
  slug: string;
  type: string;
  is_primary?: boolean;
};

type TableSpec = {
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  fields: Field[];
};

type Template = {
  id: string;
  vertical: string;
  name: string;
  description: string | null;
  icon: string | null;
  structure: { tables: TableSpec[]; recommended_packages?: string[] };
};

type TablePackage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  color: string | null;
  structure: { tables: TableSpec[] };
};

const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string }> = {
  customers:     { label: 'לקוחות',     icon: '👤', color: 'text-emerald-700 bg-emerald-50' },
  operations:    { label: 'תפעול',      icon: '⚙️', color: 'text-purple-700 bg-purple-50' },
  finance:       { label: 'כספים',      icon: '💰', color: 'text-green-700 bg-green-50' },
  communication: { label: 'תקשורת',     icon: '💬', color: 'text-blue-700 bg-blue-50' },
  inventory:     { label: 'מלאי',       icon: '📦', color: 'text-amber-700 bg-amber-50' },
  hr:            { label: 'משאבי אנוש', icon: '👥', color: 'text-pink-700 bg-pink-50' },
};

export default function TemplatesClient({
  workspaceId,
  templates,
  packages,
  existingTableSlugs,
}: {
  workspaceId: string;
  templates: Template[];
  packages: TablePackage[];
  existingTableSlugs: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'packages' | 'templates'>('packages');
  const [searchQ, setSearchQ] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const existingSet = useMemo(() => new Set(existingTableSlugs), [existingTableSlugs]);

  // Filter by search
  const filteredPackages = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.description?.toLowerCase().includes(q)) return true;
      return p.structure.tables.some((t) => t.name.toLowerCase().includes(q));
    });
  }, [packages, searchQ]);

  const filteredTemplates = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      if (t.description?.toLowerCase().includes(q)) return true;
      return t.structure.tables.some((tbl) => tbl.name.toLowerCase().includes(q));
    });
  }, [templates, searchQ]);

  // Group packages by category
  const packagesByCategory = useMemo(() => {
    const grouped: Record<string, TablePackage[]> = {};
    for (const p of filteredPackages) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }
    return grouped;
  }, [filteredPackages]);

  async function install(payload: any) {
    const key = JSON.stringify(payload);
    setInstalling(key);
    setFeedback(null);
    try {
      const res = await fetch('/api/workspaces/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: json.error || 'שגיאה בהתקנה' });
      } else {
        setFeedback({ type: 'success', text: json.summary || 'הותקן בהצלחה' });
        // Refresh page to update existingTableSlugs
        setTimeout(() => router.refresh(), 1000);
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message });
    } finally {
      setInstalling(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-3 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="font-display font-bold text-2xl md:text-3xl mb-1">ספריית טבלאות</h1>
        <p className="text-sm md:text-base text-gray-500">
          הוסף טבלאות מוכנות לסביבת העבודה — חבילות גנריות לכל עסק או תבניות מותאמות לתחום ספציפי
        </p>
      </div>

      {/* Search + Tabs */}
      <div className="sticky top-0 z-10 bg-white py-2 mb-4 -mx-3 px-3 md:-mx-6 md:px-6 border-b border-gray-100">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="חיפוש: לקוחות, חשבוניות, פגישות..."
            className="input-field pr-9 text-sm"
          />
        </div>

        <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
          <button
            onClick={() => setTab('packages')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === 'packages' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>חבילות גנריות</span>
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{packages.length}</span>
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === 'templates' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>תבניות עסקיות</span>
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{templates.length}</span>
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
            feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* PACKAGES TAB */}
      {tab === 'packages' && (
        <div className="space-y-5">
          {Object.keys(packagesByCategory).length === 0 ? (
            <EmptyState searchQ={searchQ} />
          ) : (
            Object.entries(packagesByCategory).map(([cat, pkgs]) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${CATEGORY_INFO[cat]?.color || 'bg-gray-100'}`}>
                    <span>{CATEGORY_INFO[cat]?.icon}</span>
                    {CATEGORY_INFO[cat]?.label || cat}
                  </span>
                </div>
                <div className="space-y-3">
                  {pkgs.map((pkg) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      existingSlugs={existingSet}
                      isExpanded={expandedId === `pkg-${pkg.id}`}
                      onToggle={() => setExpandedId(expandedId === `pkg-${pkg.id}` ? null : `pkg-${pkg.id}`)}
                      installing={installing}
                      onInstallAll={() => install({ source: 'package', package_slug: pkg.slug })}
                      onInstallTable={(tableSlug) => install({ source: 'package_table', package_slug: pkg.slug, table_slug: tableSlug })}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {filteredTemplates.length === 0 ? (
            <EmptyState searchQ={searchQ} />
          ) : (
            filteredTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                existingSlugs={existingSet}
                isExpanded={expandedId === `tpl-${tpl.id}`}
                onToggle={() => setExpandedId(expandedId === `tpl-${tpl.id}` ? null : `tpl-${tpl.id}`)}
                installing={installing}
                onInstallAll={() => install({ source: 'template', template_vertical: tpl.vertical })}
                onInstallTable={(tableSlug) => install({ source: 'template_table', template_vertical: tpl.vertical, table_slug: tableSlug })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function EmptyState({ searchQ }: { searchQ: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">
        {searchQ ? `לא נמצאו תוצאות עבור "${searchQ}"` : 'אין פריטים זמינים'}
      </p>
    </div>
  );
}

function PackageCard({
  pkg, existingSlugs, isExpanded, onToggle, installing, onInstallAll, onInstallTable,
}: {
  pkg: TablePackage;
  existingSlugs: Set<string>;
  isExpanded: boolean;
  onToggle: () => void;
  installing: string | null;
  onInstallAll: () => void;
  onInstallTable: (slug: string) => void;
}) {
  const allInstalled = pkg.structure.tables.every((t) => existingSlugs.has(t.slug));
  const someInstalled = pkg.structure.tables.some((t) => existingSlugs.has(t.slug));

  const installAllKey = JSON.stringify({ source: 'package', package_slug: pkg.slug });

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 text-xl"
          style={{ backgroundColor: (pkg.color || '#7C3AED') + '15', color: pkg.color || '#7C3AED' }}
        >
          {pkg.icon || '📦'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm md:text-base text-gray-900">{pkg.name}</div>
          <div className="text-xs md:text-sm text-gray-500 mt-0.5">{pkg.description}</div>
          <div className="text-[11px] text-gray-400 mt-1.5">
            {pkg.structure.tables.length} טבלאות · {pkg.structure.tables.reduce((s, t) => s + t.fields.length, 0)} שדות
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={onInstallAll}
          disabled={allInstalled || installing === installAllKey}
          className={`flex-1 min-w-[120px] btn-primary text-sm flex items-center justify-center gap-1.5 ${
            allInstalled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {allInstalled ? (
            <><Check className="w-4 h-4" /> מותקן</>
          ) : installing === installAllKey ? (
            'מתקין...'
          ) : someInstalled ? (
            <><Plus className="w-4 h-4" /> השלם התקנה</>
          ) : (
            <><Download className="w-4 h-4" /> התקן את כל החבילה</>
          )}
        </button>
        <button onClick={onToggle} className="btn-ghost text-sm flex items-center gap-1">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          פירוט
        </button>
      </div>

      {/* Expanded - per-table install */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2">
          <div className="text-xs font-semibold text-gray-600 mb-2">טבלאות בחבילה — תוכל להתקין כל אחת בנפרד:</div>
          {pkg.structure.tables.map((t) => {
            const isInstalled = existingSlugs.has(t.slug);
            const tableKey = JSON.stringify({ source: 'package_table', package_slug: pkg.slug, table_slug: t.slug });
            return (
              <div key={t.slug} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-gray-100">
                <span className="text-lg flex-shrink-0">{t.icon || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-gray-500">{t.fields.length} שדות</div>
                </div>
                {isInstalled ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 flex items-center gap-1 flex-shrink-0">
                    <Check className="w-3 h-3" /> מותקן
                  </span>
                ) : (
                  <button
                    onClick={() => onInstallTable(t.slug)}
                    disabled={installing === tableKey}
                    className="btn-secondary text-xs flex items-center gap-1 flex-shrink-0"
                  >
                    {installing === tableKey ? '...' : <><Plus className="w-3 h-3" /> הוסף</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  tpl, existingSlugs, isExpanded, onToggle, installing, onInstallAll, onInstallTable,
}: {
  tpl: Template;
  existingSlugs: Set<string>;
  isExpanded: boolean;
  onToggle: () => void;
  installing: string | null;
  onInstallAll: () => void;
  onInstallTable: (slug: string) => void;
}) {
  const allInstalled = tpl.structure.tables.every((t) => existingSlugs.has(t.slug));
  const someInstalled = tpl.structure.tables.some((t) => existingSlugs.has(t.slug));
  const installAllKey = JSON.stringify({ source: 'template', template_vertical: tpl.vertical });

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 grid place-items-center flex-shrink-0 text-xl">
          {tpl.icon || '🏢'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm md:text-base text-gray-900">{tpl.name}</div>
          <div className="text-xs md:text-sm text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</div>
          <div className="text-[11px] text-gray-400 mt-1.5">
            {tpl.structure.tables.length} טבלאות ייחודיות
            {tpl.structure.recommended_packages && tpl.structure.recommended_packages.length > 0 && (
              <> · ממליץ על {tpl.structure.recommended_packages.length} חבילות גנריות</>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={onInstallAll}
          disabled={allInstalled || installing === installAllKey}
          className={`flex-1 min-w-[120px] btn-primary text-sm flex items-center justify-center gap-1.5 ${
            allInstalled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {allInstalled ? (
            <><Check className="w-4 h-4" /> מותקן</>
          ) : installing === installAllKey ? 'מתקין...'
            : someInstalled ? <><Plus className="w-4 h-4" /> השלם התקנה</>
            : <><Download className="w-4 h-4" /> התקן את כל התבנית</>}
        </button>
        <button onClick={onToggle} className="btn-ghost text-sm flex items-center gap-1">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          פירוט
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2">
          <div className="text-xs font-semibold text-gray-600 mb-2">טבלאות בתבנית:</div>
          {tpl.structure.tables.map((t) => {
            const isInstalled = existingSlugs.has(t.slug);
            const tableKey = JSON.stringify({ source: 'template_table', template_vertical: tpl.vertical, table_slug: t.slug });
            return (
              <div key={t.slug} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-gray-100">
                <span className="text-lg flex-shrink-0">{t.icon || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-gray-500">{t.fields.length} שדות</div>
                </div>
                {isInstalled ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 flex items-center gap-1 flex-shrink-0">
                    <Check className="w-3 h-3" /> מותקן
                  </span>
                ) : (
                  <button
                    onClick={() => onInstallTable(t.slug)}
                    disabled={installing === tableKey}
                    className="btn-secondary text-xs flex items-center gap-1 flex-shrink-0"
                  >
                    {installing === tableKey ? '...' : <><Plus className="w-3 h-3" /> הוסף</>}
                  </button>
                )}
              </div>
            );
          })}
          {tpl.structure.recommended_packages && tpl.structure.recommended_packages.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-900">
              💡 לתבנית זו מומלץ להוסיף גם חבילות גנריות (לקוחות, תפעול, כספים)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
