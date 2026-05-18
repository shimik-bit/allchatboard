'use client';

/**
 * Form Builder — the heart of the Forms feature.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Toolbar: title, save, publish/unpublish, view-public, delete │
 *   ├─────────────────┬────────────────────────────────────────────┤
 *   │ Available       │                                            │
 *   │ fields (table's │  Active form structure (sortable)          │
 *   │ fields that     │  + per-field settings drawer               │
 *   │ aren't exposed) │                                            │
 *   │                 │                                            │
 *   │ + Settings tab  │                                            │
 *   │ (theme, branding│                                            │
 *   │  notifications) │                                            │
 *   └─────────────────┴────────────────────────────────────────────┘
 *
 * State management:
 *   - `form` is the local working copy. Every change calls `markDirty()`.
 *   - "Save" PATCHes the whole form. Auto-saves on blur of any input.
 *   - field_settings is a plain object keyed by field_id. Drag-and-drop
 *     updates the `position` value in field_settings.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Menu,
  Palette,
  Pencil,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { FieldSettings, FormRow, FormTheme } from '@/lib/forms/types';
import { isPublicSafeFieldType } from '@/lib/forms/types';

type Field = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_required: boolean;
  is_primary: boolean;
  position: number | null;
  config: any;
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'טקסט קצר',
  longtext: 'טקסט ארוך',
  email: 'אימייל',
  phone: 'טלפון',
  url: 'קישור',
  number: 'מספר',
  currency: 'סכום',
  date: 'תאריך',
  datetime: 'תאריך ושעה',
  select: 'בחירה',
  multiselect: 'בחירה מרובה',
  checkbox: "צ'קבוקס",
  rating: 'דירוג',
  status: 'סטטוס',
  city: 'עיר',
};

// ============================================================================
// Main component
// ============================================================================
export default function FormBuilderClient({
  initialForm,
  availableFields,
}: {
  initialForm: FormRow;
  availableFields: Field[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormRow>(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [sidePanel, setSidePanel] = useState<'fields' | 'settings'>('fields');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Mobile: sidebar is hidden by default and toggles open as a drawer.
  // Desktop (md+): sidebar always visible as a fixed-width column.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Only show fields whose types we can render publicly
  const safeFields = useMemo(
    () => availableFields.filter((f) => isPublicSafeFieldType(f.type)),
    [availableFields],
  );

  // Split into "exposed" and "available" based on field_settings.visible
  const { exposedFields, hiddenFields } = useMemo(() => {
    const exposed: Field[] = [];
    const hidden: Field[] = [];
    for (const f of safeFields) {
      const settings = form.field_settings[f.id];
      if (settings && settings.visible !== false) {
        exposed.push(f);
      } else if (settings && settings.visible === false) {
        hidden.push(f);
      } else {
        hidden.push(f);
      }
    }
    // Order exposed by their position in field_settings
    exposed.sort((a, b) => {
      const ap = form.field_settings[a.id]?.position ?? 999;
      const bp = form.field_settings[b.id]?.position ?? 999;
      return ap - bp;
    });
    return { exposedFields: exposed, hiddenFields: hidden };
  }, [safeFields, form.field_settings]);

  // ---- Mutation helpers ----
  const updateField = useCallback((patch: Partial<FormRow>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateFieldSettings = useCallback(
    (fieldId: string, patch: Partial<FieldSettings>) => {
      setForm((prev) => ({
        ...prev,
        field_settings: {
          ...prev.field_settings,
          [fieldId]: { ...prev.field_settings[fieldId], ...patch },
        },
      }));
    },
    [],
  );

  // ---- Add / remove fields from the form ----
  const addFieldToForm = (fieldId: string) => {
    const maxPos = Math.max(
      0,
      ...Object.values(form.field_settings)
        .filter((s) => s.visible !== false)
        .map((s) => s.position ?? 0),
    );
    updateFieldSettings(fieldId, { visible: true, position: maxPos + 1 });
  };

  const removeFieldFromForm = (fieldId: string) => {
    updateFieldSettings(fieldId, { visible: false });
  };

  // ---- Drag and drop reorder ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = exposedFields.findIndex((f) => f.id === active.id);
    const newIndex = exposedFields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(exposedFields, oldIndex, newIndex);
    // Re-number positions 1..n and write to field_settings
    const newSettings = { ...form.field_settings };
    reordered.forEach((f, i) => {
      newSettings[f.id] = { ...newSettings[f.id], position: i + 1 };
    });
    setForm((prev) => ({ ...prev, field_settings: newSettings }));
  };

  // ---- Save ----
  const handleSave = async (overrides?: Partial<FormRow>) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form, ...overrides };
      // Only PATCH fields the API accepts (it whitelists, so we can send anything)
      const res = await fetch(`/api/forms/${form.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.message ?? data.error ?? 'שמירה נכשלה');
        return false;
      }
      setForm(data.form);
      setLastSavedAt(new Date());
      return true;
    } catch {
      setSaveError('שגיאת רשת. נסה שוב.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Publish / unpublish ----
  const handleTogglePublish = async () => {
    const next = form.status === 'published' ? 'draft' : 'published';
    if (next === 'published' && exposedFields.length === 0) {
      setSaveError('הוסף לפחות שדה אחד לטופס לפני פרסום.');
      return;
    }
    await handleSave({ status: next });
  };

  // ---- Delete ----
  const handleDelete = async () => {
    if (!confirm('למחוק את הטופס? פעולה זו אינה הפיכה. ההגשות בטבלה יישארו.')) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/forms/${form.slug}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/forms');
      } else {
        const data = await res.json();
        setSaveError(data.message ?? 'מחיקה נכשלה');
        setIsSaving(false);
      }
    } catch {
      setSaveError('שגיאת רשת');
      setIsSaving(false);
    }
  };

  const editingField = editingFieldId
    ? safeFields.find((f) => f.id === editingFieldId)
    : null;

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toolbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Mobile-only sidebar toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 -ms-1 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            aria-label="פתח פאנל"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            href="/dashboard/forms"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="hidden sm:inline">כל הטפסים</span>
          </Link>

          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField({ title: e.target.value })}
            onBlur={() => handleSave()}
            className="font-bold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 px-1 min-w-[100px] flex-1 sm:min-w-[160px] max-w-md text-base"
            placeholder="שם הטופס"
          />

          <div className="flex items-center gap-1.5 sm:gap-2 ms-auto">
            <StatusBadge status={form.status} />
            {lastSavedAt && !isSaving && (
              <span className="text-xs text-gray-400 hidden md:inline">
                נשמר {new Date(lastSavedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {isSaving && (
              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">שומר...</span>
              </span>
            )}
            {form.status === 'published' ? (
              <button
                onClick={handleTogglePublish}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">העבר לטיוטה</span>
              </button>
            ) : (
              <button
                onClick={handleTogglePublish}
                disabled={isSaving || exposedFields.length === 0}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                פרסם
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div className="px-4 sm:px-6 py-2 bg-red-50 border-t border-red-100 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
            <button
              onClick={() => setSaveError(null)}
              className="ms-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {form.status === 'published' && (
          <div className="px-4 sm:px-6 py-2 bg-green-50 border-t border-green-100 text-sm text-green-800 flex items-center gap-2 flex-wrap">
            <Check className="w-4 h-4 shrink-0" />
            הטופס פעיל בכתובת:
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono font-bold hover:underline inline-flex items-center gap-1"
              dir="ltr"
            >
              /f/{form.slug}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </header>

      {/* Main 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile drawer backdrop */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-20 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar: fields + settings.
            On mobile: fixed drawer that slides in from the right. Toggleable.
            On desktop: always visible as a 320px column. */}
        <aside
          className={`
            bg-white border-l border-gray-200 flex flex-col
            md:relative md:w-80 md:translate-x-0
            fixed z-30 top-0 bottom-0 right-0 w-[85%] max-w-sm transition-transform duration-200
            ${mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
        >
          {/* Mobile-only close button */}
          <div className="md:hidden flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-500">פאנל</span>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded"
              aria-label="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="border-b border-gray-200 flex">
            <button
              onClick={() => setSidePanel('fields')}
              className={`flex-1 px-4 py-3 text-sm font-bold transition relative ${
                sidePanel === 'fields' ? 'text-purple-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              שדות
              {sidePanel === 'fields' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setSidePanel('settings')}
              className={`flex-1 px-4 py-3 text-sm font-bold transition relative ${
                sidePanel === 'settings' ? 'text-purple-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              הגדרות
              {sidePanel === 'settings' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {sidePanel === 'fields' ? (
              <FieldsPanel
                hiddenFields={hiddenFields}
                onAdd={(id) => {
                  addFieldToForm(id);
                  // Auto-close drawer on mobile after adding a field
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setMobileSidebarOpen(false);
                  }
                }}
              />
            ) : (
              <SettingsPanel form={form} onUpdate={updateField} onBlur={() => handleSave()} />
            )}
          </div>

          {/* Delete button at bottom of sidebar */}
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={handleDelete}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              מחק טופס
            </button>
          </div>
        </aside>

        {/* Main: live preview of the form structure */}
        <main className="flex-1 overflow-y-auto bg-gray-100 w-full">
          <div className="max-w-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            <FormPreview
              form={form}
              exposedFields={exposedFields}
              onEditField={setEditingFieldId}
              onRemoveField={removeFieldFromForm}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            />
          </div>
        </main>
      </div>

      {/* Field editor drawer */}
      {editingField && (
        <FieldEditorDrawer
          field={editingField}
          settings={form.field_settings[editingField.id] ?? {}}
          allExposedFields={exposedFields.filter((f) => f.id !== editingField.id)}
          onUpdate={(patch) => updateFieldSettings(editingField.id, patch)}
          onClose={() => {
            setEditingFieldId(null);
            handleSave();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Status badge
// ============================================================================
function StatusBadge({ status }: { status: FormRow['status'] }) {
  const meta: Record<string, { label: string; classes: string }> = {
    draft: { label: 'טיוטה', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    published: { label: 'פעיל', classes: 'bg-green-50 text-green-700 border-green-200' },
    archived: { label: 'בארכיון', classes: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const m = meta[status] ?? meta.draft;
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full border ${m.classes}`}>
      {m.label}
    </span>
  );
}

// ============================================================================
// Sidebar: fields panel
// ============================================================================
function FieldsPanel({
  hiddenFields,
  onAdd,
}: {
  hiddenFields: Field[];
  onAdd: (fieldId: string) => void;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-3">
        שדות הטבלה שעוד לא מופיעים בטופס. לחץ על שדה כדי להוסיף אותו.
      </div>
      {hiddenFields.length === 0 ? (
        <div className="text-center py-8">
          <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <div className="text-sm text-gray-600">כל השדות בטופס</div>
        </div>
      ) : (
        <div className="space-y-1">
          {hiddenFields.map((f) => (
            <button
              key={f.id}
              onClick={() => onAdd(f.id)}
              className="w-full text-right p-2.5 bg-gray-50 hover:bg-purple-50 hover:border-purple-200 border border-gray-200 rounded-lg transition group flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 transition" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{f.name}</div>
                <div className="text-[11px] text-gray-500">
                  {FIELD_TYPE_LABELS[f.type] ?? f.type}
                  {f.is_required && <span className="text-red-500 ms-1">חובה</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sidebar: settings panel
// ============================================================================
function SettingsPanel({
  form,
  onUpdate,
  onBlur,
}: {
  form: FormRow;
  onUpdate: (patch: Partial<FormRow>) => void;
  onBlur: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Branding section */}
      <Section icon={<Palette className="w-3.5 h-3.5" />} title="עיצוב ומיתוג">
        <SmallInput
          label="כותרת ראשית"
          value={form.hero_title ?? ''}
          onChange={(v) => onUpdate({ hero_title: v })}
          onBlur={onBlur}
        />
        <SmallInput
          label="תת-כותרת"
          value={form.hero_subtitle ?? ''}
          onChange={(v) => onUpdate({ hero_subtitle: v })}
          onBlur={onBlur}
        />
        <SmallInput
          label="כיתוב כפתור התחלה"
          value={form.cta_label ?? 'התחל'}
          onChange={(v) => onUpdate({ cta_label: v })}
          onBlur={onBlur}
        />
        <SmallSelect
          label="ערכת צבעים"
          value={form.theme}
          onChange={(v) => {
            onUpdate({ theme: v as FormTheme });
            // Persist immediately on dropdown change
            setTimeout(onBlur, 0);
          }}
          options={[
            { value: 'cream', label: 'קרם (Diagnostic)' },
            { value: 'purple', label: 'סגול (TaskFlow)' },
            { value: 'dark', label: 'כהה' },
            { value: 'minimal', label: 'מינימליסטי' },
          ]}
        />
      </Section>

      {/* Thank you section */}
      <Section icon={<Sparkles className="w-3.5 h-3.5" />} title="מסך תודה">
        <SmallInput
          label="כותרת"
          value={form.thank_you_title ?? ''}
          onChange={(v) => onUpdate({ thank_you_title: v })}
          onBlur={onBlur}
        />
        <SmallTextarea
          label="הודעת תודה"
          value={form.thank_you_message ?? ''}
          onChange={(v) => onUpdate({ thank_you_message: v })}
          onBlur={onBlur}
        />
        <SmallInput
          label="הפניה אחרי שליחה (URL)"
          value={form.success_redirect_url ?? ''}
          onChange={(v) => onUpdate({ success_redirect_url: v })}
          onBlur={onBlur}
          dir="ltr"
          placeholder="https://..."
        />
      </Section>

      {/* Behaviour */}
      <Section icon={<Settings className="w-3.5 h-3.5" />} title="התנהגות">
        <Toggle
          label="הצג שורת התקדמות"
          value={form.show_progress_bar}
          onChange={(v) => {
            onUpdate({ show_progress_bar: v });
            setTimeout(onBlur, 0);
          }}
        />
        <Toggle
          label="חייב טלפון"
          value={form.require_phone}
          onChange={(v) => {
            onUpdate({ require_phone: v });
            setTimeout(onBlur, 0);
          }}
        />
        <Toggle
          label="חייב אימייל"
          value={form.require_email}
          onChange={(v) => {
            onUpdate({ require_email: v });
            setTimeout(onBlur, 0);
          }}
        />
      </Section>

      {/* Notifications */}
      <Section icon={<Sparkles className="w-3.5 h-3.5" />} title="התראות">
        <SmallTextarea
          label="כתובות מייל להתראה (אחת בכל שורה)"
          value={(form.notification_emails ?? []).join('\n')}
          onChange={(v) =>
            onUpdate({
              notification_emails: v
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          onBlur={onBlur}
          dir="ltr"
        />
      </Section>
    </div>
  );
}

// ============================================================================
// Form preview (the right column) — sortable list of exposed fields
// ============================================================================
function FormPreview({
  form,
  exposedFields,
  onEditField,
  onRemoveField,
  onDragEnd,
  sensors,
}: {
  form: FormRow;
  exposedFields: Field[];
  onEditField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: any;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Mock hero preview */}
      <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-b border-gray-200">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {form.hero_title || form.title}
          </h2>
          {form.hero_subtitle && (
            <p className="text-sm text-gray-600">{form.hero_subtitle}</p>
          )}
          <div className="mt-4">
            <span className="inline-block px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">
              {form.cta_label || 'התחל'}
            </span>
          </div>
        </div>
      </div>

      {/* Field list */}
      <div className="p-6">
        {exposedFields.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-50 rounded-full mb-3">
              <Plus className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">הוסף שדות מהפאנל הצדדי</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              לחץ על שדות מצד שמאל כדי להוסיף אותם לטופס. גרור לסידור.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={exposedFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {exposedFields.map((f) => (
                  <SortableFieldRow
                    key={f.id}
                    field={f}
                    settings={form.field_settings[f.id] ?? {}}
                    onEdit={() => onEditField(f.id)}
                    onRemove={() => onRemoveField(f.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableFieldRow({
  field,
  settings,
  onEdit,
  onRemove,
}: {
  field: Field;
  settings: FieldSettings;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const required = settings.required_override ?? field.is_required;
  const hasCondition = (settings.conditional_rules?.show_if?.length ?? 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-white border border-gray-200 rounded-lg p-3 hover:border-purple-300 transition flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 group-hover:text-gray-500 transition cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">
            {settings.label_override || field.name}
          </span>
          {required && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold">
              חובה
            </span>
          )}
          {hasCondition && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
              תנאי
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {FIELD_TYPE_LABELS[field.type] ?? field.type}
          {settings.placeholder && <span className="ms-2">· {settings.placeholder}</span>}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition"
        title="עריכה"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onRemove}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
        title="הסר מהטופס"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// Field editor drawer
// ============================================================================
function FieldEditorDrawer({
  field,
  settings,
  allExposedFields,
  onUpdate,
  onClose,
}: {
  field: Field;
  settings: FieldSettings;
  allExposedFields: Field[];
  onUpdate: (patch: Partial<FieldSettings>) => void;
  onClose: () => void;
}) {
  const conditionalRule = settings.conditional_rules?.show_if?.[0] ?? null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex justify-start" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 truncate">{field.name}</h3>
            <div className="text-xs text-gray-500">{FIELD_TYPE_LABELS[field.type] ?? field.type}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <SmallInput
            label="תווית מותאמת (אם ריק — שם השדה)"
            value={settings.label_override ?? ''}
            onChange={(v) => onUpdate({ label_override: v })}
          />
          <SmallInput
            label="טקסט עזר (placeholder)"
            value={settings.placeholder ?? ''}
            onChange={(v) => onUpdate({ placeholder: v })}
          />
          <SmallTextarea
            label="הסבר מתחת לשדה"
            value={settings.help_text ?? ''}
            onChange={(v) => onUpdate({ help_text: v })}
          />
          <Toggle
            label={`שדה חובה (ברירת מחדל: ${field.is_required ? 'כן' : 'לא'})`}
            value={settings.required_override ?? field.is_required}
            onChange={(v) => onUpdate({ required_override: v })}
          />

          {/* Conditional logic */}
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm font-bold text-gray-900 mb-2">תצוגה מותנית</div>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              הצג את השדה רק אם שדה אחר עונה על תנאי מסוים.
            </p>

            {allExposedFields.length === 0 ? (
              <div className="text-xs text-gray-400 italic">
                הוסף שדות נוספים לטופס כדי להגדיר תנאים.
              </div>
            ) : (
              <ConditionalRuleEditor
                rule={conditionalRule}
                otherFields={allExposedFields}
                onChange={(rule) => {
                  if (!rule) {
                    onUpdate({ conditional_rules: undefined });
                  } else {
                    onUpdate({ conditional_rules: { show_if: [rule] } });
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionalRuleEditor({
  rule,
  otherFields,
  onChange,
}: {
  rule: NonNullable<FieldSettings['conditional_rules']>['show_if'][0] | null;
  otherFields: Field[];
  onChange: (rule: NonNullable<FieldSettings['conditional_rules']>['show_if'][0] | null) => void;
}) {
  const targetField = rule ? otherFields.find((f) => f.id === rule.field_id) : null;

  if (!rule) {
    return (
      <button
        onClick={() =>
          onChange({
            field_id: otherFields[0].id,
            op: 'equals',
            value: '',
          })
        }
        className="w-full text-sm text-purple-600 hover:bg-purple-50 border border-dashed border-purple-300 rounded-lg p-3 transition"
      >
        + הוסף תנאי
      </button>
    );
  }

  return (
    <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
      <SmallSelect
        label="שדה"
        value={rule.field_id}
        onChange={(v) => onChange({ ...rule, field_id: v })}
        options={otherFields.map((f) => ({ value: f.id, label: f.name }))}
      />
      <SmallSelect
        label="תנאי"
        value={rule.op}
        onChange={(v) => onChange({ ...rule, op: v as any })}
        options={[
          { value: 'equals', label: 'שווה ל' },
          { value: 'not_equals', label: 'לא שווה ל' },
          { value: 'contains', label: 'מכיל' },
          { value: 'is_empty', label: 'ריק' },
          { value: 'not_empty', label: 'לא ריק' },
          { value: 'gt', label: 'גדול מ' },
          { value: 'lt', label: 'קטן מ' },
        ]}
      />
      {rule.op !== 'is_empty' && rule.op !== 'not_empty' && (
        <SmallInput
          label="ערך"
          value={String(rule.value ?? '')}
          onChange={(v) => onChange({ ...rule, value: v })}
        />
      )}
      <button
        onClick={() => onChange(null)}
        className="text-xs text-red-600 hover:bg-red-50 rounded px-2 py-1 transition"
      >
        הסר תנאי
      </button>
    </div>
  );
}

// ============================================================================
// Small reusable inputs (kept inline to keep the builder self-contained)
// ============================================================================
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
        {icon}
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  onBlur,
  dir,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  dir?: 'rtl' | 'ltr';
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        dir={dir}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
      />
    </label>
  );
}

function SmallTextarea({
  label,
  value,
  onChange,
  onBlur,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        dir={dir}
        rows={3}
        className="w-full px-2.5 py-1.5 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition resize-none"
      />
    </label>
  );
}

function SmallSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex w-9 h-5 rounded-full transition ${
          value ? 'bg-purple-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
            value ? 'right-0.5' : 'right-4'
          }`}
        />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
