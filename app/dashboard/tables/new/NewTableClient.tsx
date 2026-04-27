'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { FieldType } from '@/lib/types/database';
import { Plus, Trash2, ArrowRight, Link2 } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

const FIELD_TYPE_KEYS: { value: FieldType; needsOptions?: boolean; needsRelation?: boolean }[] = [
  { value: 'text' },
  { value: 'longtext' },
  { value: 'number' },
  { value: 'currency' },
  { value: 'date' },
  { value: 'datetime' },
  { value: 'select', needsOptions: true },
  { value: 'multiselect', needsOptions: true },
  { value: 'status', needsOptions: true },
  { value: 'checkbox' },
  { value: 'phone' },
  { value: 'email' },
  { value: 'url' },
  { value: 'rating' },
  { value: 'relation', needsRelation: true },
];

const ICONS = ['📋', '🏠', '👥', '🔧', '📦', '💰', '📅', '✅', '🚗', '🍕', '📞', '⚙️', '🎯', '📊'];
const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#DB2777', '#475569', '#0891B2'];

interface FieldDraft {
  name: string;
  slug: string;
  type: FieldType;
  is_required: boolean;
  options: string;
  ai_extraction_hint: string;
  relation_table_id?: string;
}

export default function NewTableClient({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📋');
  const [color, setColor] = useState('#7C3AED');
  const [aiKeywords, setAiKeywords] = useState('');
  const [existingTables, setExistingTables] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [fields, setFields] = useState<FieldDraft[]>([
    { name: '', slug: '', type: 'text', is_required: true, options: '', ai_extraction_hint: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tables')
        .select('id, name, icon')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('display_order');
      if (data) setExistingTables(data);
    })();
  }, [workspaceId, supabase]);

  function slugify(s: string, fallback?: number): string {
    return (
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || (fallback !== undefined ? `f${fallback}` : '')
    );
  }

  function ensureUniqueSlugs(items: FieldDraft[]): FieldDraft[] {
    const used = new Set<string>();
    return items.map((f, i) => {
      let base = slugify(f.name, i) || `f${i}`;
      let s = base;
      let n = 1;
      while (used.has(s)) {
        s = `${base}_${n++}`;
      }
      used.add(s);
      return { ...f, slug: s };
    });
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { name: '', slug: '', type: 'text', is_required: false, options: '', ai_extraction_hint: '' },
    ]);
  }

  function updateField(idx: number, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(t('tables.new_page.error_name_required'));
      return;
    }
    if (fields.length === 0) {
      setError(t('tables.new_page.error_at_least_one_field'));
      return;
    }
    if (fields.some((f) => !f.name.trim())) {
      setError(t('tables.new_page.error_field_name_required'));
      return;
    }
    const badRelation = fields.find((f) => f.type === 'relation' && !f.relation_table_id);
    if (badRelation) {
      setError(t('tables.new_page.error_relation_target', { name: badRelation.name }));
      return;
    }

    setSaving(true);
    const tableSlug = slugify(name) || `table_${Date.now()}`;
    const uniqueFields = ensureUniqueSlugs(fields);

    const fieldsPayload = uniqueFields.map((f, i) => {
      const cfg: any = {};
      if (FIELD_TYPE_KEYS.find((tt) => tt.value === f.type)?.needsOptions) {
        cfg.options = f.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
          .map((label, idx) => ({
            value: slugify(label, idx) || `opt_${idx}`,
            label,
            color: ['#7C3AED', '#059669', '#DC2626', '#D97706'][idx % 4],
          }));
      }
      if (f.type === 'relation' && f.relation_table_id) {
        cfg.relation_table_id = f.relation_table_id;
      }
      return {
        name: f.name,
        slug: f.slug,
        type: f.type,
        is_required: f.is_required,
        is_primary: i === 0,
        config: cfg,
        ai_extraction_hint: f.ai_extraction_hint || null,
      };
    });

    const { data: tableId, error: rpcError } = await supabase.rpc('add_table_with_fields', {
      p_workspace_id: workspaceId,
      p_name: name,
      p_slug: tableSlug,
      p_icon: icon,
      p_color: color,
      p_description: description || null,
      p_ai_keywords: aiKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      p_fields: fieldsPayload,
    });

    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.push(`/dashboard/${tableId}`);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-8 pr-4 md:pr-8 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        <ArrowRight className="w-4 h-4" /> {t('tables.new_page.back')}
      </button>

      <h1 className="font-display font-bold text-3xl mb-1">{t('tables.new_page.title')}</h1>
      <p className="text-gray-500 mb-8">{t('tables.new_page.subtitle')}</p>

      {/* Basic info */}
      <div className="card p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('tables.new_page.table_name_label')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('tables.new_page.table_name_placeholder')}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('tables.new_page.description_label')}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('tables.new_page.description_placeholder')}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('tables.new_page.icon_label')}
          </label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((i) => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                type="button"
                className={`w-10 h-10 rounded-lg text-xl transition-all ${
                  icon === i ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.color') || 'Color'}</label>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                type="button"
                className={`w-9 h-9 rounded-lg ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('tables.ai_keywords')}
          </label>
          <input
            type="text"
            value={aiKeywords}
            onChange={(e) => setAiKeywords(e.target.value)}
            placeholder={t('tables.ai_keywords_hint')}
            className="input-field"
          />
          <div className="text-xs text-gray-500 mt-1">{t('tables.ai_keywords_hint')}</div>
        </div>
      </div>

      {/* Fields */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">{t('tables.new_page.fields_title')}</h2>
          <button onClick={addField} className="btn-secondary text-sm">
            <Plus className="w-4 h-4" /> {t('tables.new_page.add_field')}
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((f, i) => {
            const typeInfo = FIELD_TYPE_KEYS.find((tt) => tt.value === f.type);
            return (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-6">#{i + 1}</span>
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    placeholder={t('tables.new_page.field_name')}
                    className="input-field flex-1 text-sm"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                    className="input-field text-sm w-40"
                  >
                    {FIELD_TYPE_KEYS.map((tt) => (
                      <option key={tt.value} value={tt.value}>
                        {t(`tables.new_page.field_types.${tt.value}`)}
                      </option>
                    ))}
                  </select>
                  {fields.length > 1 && (
                    <button
                      onClick={() => removeField(i)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title={t('tables.new_page.remove_field')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 pr-8 flex-wrap">
                  {typeInfo?.needsOptions && (
                    <input
                      type="text"
                      value={f.options}
                      onChange={(e) => updateField(i, { options: e.target.value })}
                      placeholder={t('tables.new_page.options_placeholder')}
                      className="input-field text-sm flex-1 min-w-[200px]"
                    />
                  )}
                  {typeInfo?.needsRelation && (
                    <select
                      value={f.relation_table_id || ''}
                      onChange={(e) => updateField(i, { relation_table_id: e.target.value })}
                      className="input-field text-sm flex-1 min-w-[200px]"
                    >
                      <option value="">— {t('tables.new_page.select_table')} —</option>
                      {existingTables.map((tt) => (
                        <option key={tt.id} value={tt.id}>
                          {tt.icon} {tt.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={f.ai_extraction_hint}
                    onChange={(e) => updateField(i, { ai_extraction_hint: e.target.value })}
                    placeholder={`${t('tables.ai_keywords')} (${t('common.optional')})`}
                    className="input-field text-sm flex-1 min-w-[200px]"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={f.is_required}
                      onChange={(e) => updateField(i, { is_required: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600"
                    />
                    {t('common.required')}
                  </label>
                  {i === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                      {t('tables.primary_field')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</div>
      )}

      <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full py-3">
        {saving ? t('tables.new_page.creating') : t('tables.new_page.create_table')}
      </button>
    </div>
  );
}
