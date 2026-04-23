'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Template } from '@/lib/types/database';
import { Check, ChevronDown, ChevronLeft, Plus, Loader2, Info } from 'lucide-react';

export default function TemplatesClient({
  workspaceId, templates, existingTableSlugs,
}: {
  workspaceId: string;
  templates: Template[];
  existingTableSlugs: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const existing = new Set(existingTableSlugs);

  async function handleInstall(templateId: string) {
    setInstalling(templateId);
    setError(null);

    const { data: tablesAdded, error: rpcError } = await supabase.rpc('add_template_to_workspace', {
      p_workspace_id: workspaceId,
      p_template_id: templateId,
    });

    setInstalling(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setInstalled((prev) => new Set(prev).add(templateId));
    // Refresh so sidebar picks up the new tables
    router.refresh();
  }

  return (
    <div className="p-4 md:p-8 pr-4 md:pr-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">תבניות נוספות</h1>
        <p className="text-gray-500">הוסיפו תבניות מוכנות שיתווספו לטבלאות הקיימות שלכם</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</div>
      )}

      <div className="space-y-3">
        {templates.map((t) => {
          const tableCount = t.structure?.tables?.length || 0;
          const isExpanded = expandedId === t.id;
          const isInstalling = installing === t.id;
          const wasJustInstalled = installed.has(t.id);
          // Count how many of the template's tables already exist (by slug match)
          const existingCount = (t.structure?.tables || []).filter((tbl: any) =>
            existing.has(tbl.slug)
          ).length;

          return (
            <div key={t.id} className="card overflow-hidden">
              <div className="p-5 flex items-center gap-4">
                <div className="text-4xl shrink-0">{t.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-lg">{t.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {tableCount} טבלאות
                    </span>
                    {existingCount > 0 && existingCount === tableCount && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> מותקן
                      </span>
                    )}
                    {existingCount > 0 && existingCount < tableCount && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {existingCount}/{tableCount} מותקנות
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{t.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className="btn-ghost text-sm"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    פרטים
                  </button>
                  {wasJustInstalled ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700">
                      <Check className="w-4 h-4" /> נוסף
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(t.id)}
                      disabled={isInstalling}
                      className="btn-primary text-sm"
                    >
                      {isInstalling
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Plus className="w-4 h-4" /> הוסף</>}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                  <div className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    הטבלאות שיתווספו:
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(t.structure?.tables || []).map((tbl: any, i: number) => {
                      const exists = existing.has(tbl.slug);
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2.5 p-3 rounded-lg bg-white border ${
                            exists ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'
                          }`}
                        >
                          <div className="text-xl shrink-0">{tbl.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm">{tbl.name}</span>
                              {exists && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-700">
                                  קיימת - תיווסף עותק
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {tbl.fields?.length || 0} שדות · {tbl.ai_keywords?.slice(0, 3).join(', ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
