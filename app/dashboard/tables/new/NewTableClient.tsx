'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { FieldType } from '@/lib/types/database';
import { Plus, Trash2, ArrowRight, Link2 } from 'lucide-react';

const FIELD_TYPES: { value: FieldType; label: string; needsOptions?: boolean; needsRelation?: boolean }[] = [
  { value: 'text', label: 'טקסט קצר' },
  { value: 'longtext', label: 'טקסט ארוך' },
  { value: 'number', label: 'מספר' },
  { value: 'currency', label: 'מטבע (₪)' },
  { value: 'date', label: 'תאריך' },
  { value: 'datetime', label: 'תאריך + שעה' },
  { value: 'select', label: 'בחירה אחת', needsOptions: true },
  { value: 'multiselect', label: 'בחירה מרובה', needsOptions: true },
  { value: 'status', label: 'סטטוס', needsOptions: true },
  { value: 'checkbox', label: 'תיבת סימון' },
  { value: 'phone', label: 'טלפון' },
  { value: 'email', label: 'אימייל' },
  { value: 'url', label: 'קישור URL' },
  { value: 'rating', label: 'דירוג כוכבים' },
  { value: 'relation', label: '🔗 קישור לרשומה', needsRelation: true },
];

const ICONS = ['📋', '🏠', '👥', '🔧', '📦', '💰', '📅', '✅', '🚗', '🍕', '📞', '⚙️', '🎯', '📊'];
const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#DB2777', '#475569', '#0891B2'];

interface FieldDraft {
  name: string;
  slug: string;
  type: FieldType;
  is_required: boolean;
  options: string;        // comma-separated for select-types
  ai_extraction_hint: string;
  relation_table_id?: string;  // for relation type
}

export default function NewTableClient({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const supabase = createClient();

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

  // Load existing tables in workspace (for relation dropdowns)
  useEffect(() => {
    supabase
      .from('tables')
      .select('id, name, icon')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false)
      .order('position')
      .then(({ data }) => setExistingTables(data || []));
  }, [workspaceId]);

  function slugify(s: string, idx?: number): string {
    let base = s.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')   // strip non-ascii to '_' — Hebrew gets removed
      .replace(/^_|_$/g, '');
    if (!base) {
      // Hebrew/empty: use a stable fallback
      base = `field_${(idx ?? 0) + 1}`;
    }
    return base;
  }

  // Ensure all field slugs are unique within the table
  function ensureUniqueSlugs(fieldsList: FieldDraft[]): FieldDraft[] {
    const seen = new Map<string, number>();
    return fieldsList.map((f, i) => {
      let slug = f.slug || slugify(f.name, i);
      if (!slug) slug = `field_${i + 1}`;
      const count = seen.get(slug) || 0;
      seen.set(slug, count + 1);
      const finalSlug = count === 0 ? slug : `${slug}_${count + 1}`;
      // re-track final to prevent recursive collisions
      seen.set(finalSlug, (seen.get(finalSlug) || 0) + 1);
      return { ...f, slug: finalSlug };
    });
  }

  function updateField(idx: number, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f, i) => {
      if (i !== idx) return f;
      const next = { ...f, ...patch };
      // auto-update slug when name changes (unless slug was manually edited)
      if (patch.name !== undefined && (f.slug === '' || f.slug === slugify(f.name, idx))) {
        next.slug = slugify(patch.name, idx);
      }
      return next;
    }));
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { name: '', slug: '', type: 'text', is_required: false, options: '', ai_extraction_hint: '' },
    ]);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) { setError('שם הטבלה הוא שדה חובה'); return; }
    if (fields.length === 0) { setError('חייב לפחות שדה אחד'); return; }
    if (fields.some((f) => !f.name.trim())) { setError('כל השדות חייבים שם'); return; }
    // Validate relation fields have a target table
    const badRelation = fields.find((f) => f.type === 'relation' && !f.relation_table_id);
    if (badRelation) { setError(`לשדה "${badRelation.name}" מסוג קישור חייב לבחור טבלה יעד`); return; }

    setSaving(true);
    const tableSlug = slugify(name) || `table_${Date.now()}`;

    // Ensure unique slugs across all fields
    const uniqueFields = ensureUniqueSlugs(fields);

    const fieldsPayload = uniqueFields.map((f, i) => {
      const cfg: any = {};
      if (FIELD_TYPES.find((t) => t.value === f.type)?.needsOptions) {
        cfg.options = f.options.split(',').map((o) => o.trim()).filter(Boolean).map((label, idx) => ({
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
    if (rpcError) { setError(rpcError.message); return; }

    router.push(`/dashboard/${tableId}`);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-8 pr-4 md:pr-8 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> חזור
      </button>

      <h1 className="font-display font-bold text-3xl mb-1">טבלה חדשה</h1>
      <p className="text-gray-500 mb-8">הגדר טבלה חדשה עם השדות שאתה צריך</p>

      {/* Basic info */}
      <div className="card p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">שם הטבלה <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: ספקים" className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">תיאור (אופציונלי)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="עוזר ל-AI להבין מה הטבלה הזו מכילה" className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">אייקון</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((i) => (
              <button key={i} onClick={() => setIcon(i)} type="button"
                className={`w-10 h-10 rounded-lg text-xl transition-all ${
                  icon === i ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-gray-100 hover:bg-gray-200'
                }`}>
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">צבע</label>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} type="button"
                className={`w-9 h-9 rounded-lg ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            מילות מפתח ל-AI (מופרדות בפסיק)
          </label>
          <input type="text" value={aiKeywords} onChange={(e) => setAiKeywords(e.target.value)}
            placeholder="ספק, חשבונית, רכישה" className="input-field" />
          <div className="text-xs text-gray-500 mt-1">
            המילים האלה עוזרות ל-AI להחליט מתי הודעת וואטסאפ שייכת לטבלה הזו
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">שדות</h2>
          <button onClick={addField} className="btn-secondary text-sm">
            <Plus className="w-4 h-4" /> שדה
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((f, i) => {
            const typeInfo = FIELD_TYPES.find((t) => t.value === f.type);
            return (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-6">#{i + 1}</span>
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    placeholder="שם השדה"
                    className="input-field flex-1 text-sm"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                    className="input-field text-sm w-40"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {fields.length > 1 && (
                    <button onClick={() => removeField(i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
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
                      placeholder="אפשרויות מופרדות בפסיק (פתוח, סגור, בעבודה)"
                      className="input-field text-sm flex-1 min-w-[200px]"
                    />
                  )}
                  {typeInfo?.needsRelation && (
                    <select
                      value={f.relation_table_id || ''}
                      onChange={(e) => updateField(i, { relation_table_id: e.target.value })}
                      className="input-field text-sm flex-1 min-w-[200px]"
                    >
                      <option value="">— בחר טבלה לקשר אליה —</option>
                      {existingTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.icon} {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={f.ai_extraction_hint}
                    onChange={(e) => updateField(i, { ai_extraction_hint: e.target.value })}
                    placeholder="רמז ל-AI (אופציונלי)"
                    className="input-field text-sm flex-1 min-w-[200px]"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={f.is_required}
                      onChange={(e) => updateField(i, { is_required: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600"
                    />
                    חובה
                  </label>
                  {i === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                      שדה ראשי
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
        {saving ? 'יוצר...' : 'צור טבלה'}
      </button>
    </div>
  );
}
