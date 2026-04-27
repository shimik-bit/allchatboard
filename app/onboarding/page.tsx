'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Template } from '@/lib/types/database';
import { LayoutGrid, Loader2, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

export default function OnboardingPage() {
  const { t } = useT();
  const router = useRouter();
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('templates').select('*').eq('is_published', true)
      .then(({ data }) => setTemplates(data || []));
  }, []);

  function toggleTemplate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (selectedIds.size === 0 || !workspaceName.trim()) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const slug = workspaceName.toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05FF]/g, '-')
      .replace(/-+/g, '-').replace(/^-|-$/g, '')
      || `ws-${Date.now()}`;

    const primaryVertical = templates.find((tpl) => selectedIds.has(tpl.id))?.vertical || 'mixed';

    const { data: wsId, error: rpcError } = await supabase.rpc(
      'create_workspace_with_templates',
      {
        p_name: workspaceName,
        p_slug: `${slug}-${Date.now().toString(36)}`,
        p_vertical: primaryVertical,
        p_template_ids: Array.from(selectedIds),
      }
    );

    if (rpcError) {
      setError(rpcError.message || t('errors.generic') || 'שגיאה ביצירת סביבה');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  const selectedCount = selectedIds.size;
  const totalTables = templates
    .filter((tpl) => selectedIds.has(tpl.id))
    .reduce((sum, tpl) => sum + (tpl.structure?.tables?.length || 0), 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 to-white px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl">AllChatBoard</span>
        </div>

        <div className="card p-8">
          <h1 className="font-display font-bold text-3xl mb-2">{t('onboarding.lets_start') || 'בואו נתחיל!'}</h1>
          <p className="text-gray-600 mb-8">
            {t('onboarding.choose_industry') || 'בחרו את התחומים של העסק שלכם. אפשר לבחור כמה תבניות - וגם להוסיף עוד אחר כך.'}
          </p>

          <label className="block text-sm font-medium mb-2">{t('onboarding.workspace_name') || 'שם הסביבה'}</label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder={t('onboarding.workspace_name_placeholder') || 'לדוגמה: "מוסך אבי" או "מסעדת מוישה"'}
            className="input-field mb-8"
          />

          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium">{t('onboarding.choose_templates') || 'בחרו תבניות (אפשר כמה)'}</label>
            {selectedCount > 0 && (
              <span className="text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                {selectedCount} {selectedCount === 1 ? (t('onboarding.template_singular') || 'תבנית') : (t('onboarding.templates_plural') || 'תבניות')} · {totalTables} {t('tables.title') || 'טבלאות'}
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {templates.map((tpl) => {
              const isSelected = selectedIds.has(tpl.id);
              const tableCount = tpl.structure?.tables?.length || 0;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => toggleTemplate(tpl.id)}
                  className={`text-right p-4 rounded-xl border-2 transition-all relative ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl shrink-0">{tpl.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{tpl.name}</div>
                      <div className="text-sm text-gray-600 mt-0.5 line-clamp-2">{tpl.description}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {tableCount} {t('tables.title') || 'טבלאות'}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-brand-600 grid place-items-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || selectedCount === 0 || !workspaceName.trim()}
            className="btn-primary w-full py-3"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : selectedCount === 0
              ? (t('onboarding.choose_at_least_one') || 'בחרו לפחות תבנית אחת')
              : `${t('onboarding.create_workspace_with') || 'צרו את הסביבה עם'} ${totalTables} ${t('tables.title') || 'טבלאות'}`}
          </button>
        </div>
      </div>
    </main>
  );
}
