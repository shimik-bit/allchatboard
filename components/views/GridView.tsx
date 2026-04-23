'use client';

import { useState, useRef, useEffect } from 'react';
import type { Field, RecordRow } from '@/lib/types/database';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { MessageSquare, Bell, Check, Pencil } from 'lucide-react';
import RelationCell from '@/components/RelationCell';

export default function GridView({
  fields, records, phones, onRecordClick, onRecordUpdate,
}: {
  fields: Field[];
  records: RecordRow[];
  phones?: { id: string; display_name: string; job_title: string | null }[];
  onRecordClick: (r: RecordRow) => void;
  onRecordUpdate?: (recordId: string, patch: { data?: any; notes?: string; assignee_phone_id?: string | null }, opts?: { notify?: boolean }) => Promise<void>;
}) {
  if (records.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-5xl mb-3">📭</div>
        <p>אין עדיין רשומות בטבלה הזו</p>
        <p className="text-sm mt-2">צרו רשומה חדשה או חברו וואטסאפ</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            {fields.map((f) => (
              <th
                key={f.id}
                className="text-right px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap"
              >
                {f.name}
              </th>
            ))}
            <th className="text-right px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
              בטיפול
            </th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
              הערות
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              נפתח
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              ע"י
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              עודכן סטטוס
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">מקור</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <RecordRowComponent
              key={r.id}
              record={r}
              fields={fields}
              phones={phones || []}
              onRowClick={() => onRecordClick(r)}
              onUpdate={onRecordUpdate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordRowComponent({
  record, fields, phones, onRowClick, onUpdate,
}: {
  record: RecordRow;
  fields: Field[];
  phones: { id: string; display_name: string; job_title: string | null }[];
  onRowClick: () => void;
  onUpdate?: (recordId: string, patch: { data?: any; notes?: string; assignee_phone_id?: string | null }, opts?: { notify?: boolean }) => Promise<void>;
}) {
  return (
    <tr
      className="border-b border-gray-100 hover:bg-brand-50/30 transition-colors group"
    >
      {fields.map((f) => (
        <td key={f.id} className="px-4 py-2 align-top">
          <EditableCell
            field={f}
            record={record}
            value={record.data?.[f.slug]}
            onChange={(newVal, opts) => {
              if (!onUpdate) return Promise.resolve();
              return onUpdate(record.id, { data: { [f.slug]: newVal } }, opts);
            }}
            onRowClick={onRowClick}
          />
        </td>
      ))}
      {/* בטיפול (assignee) */}
      <td className="px-4 py-2 align-top whitespace-nowrap">
        <AssigneeCell
          record={record}
          phones={phones}
          onChange={async (phoneId) => {
            if (onUpdate) await onUpdate(record.id, { assignee_phone_id: phoneId });
          }}
        />
      </td>
      {/* הערות */}
      <td className="px-4 py-2 align-top max-w-xs">
        <NotesCell
          record={record}
          onChange={async (notes) => { await onUpdate?.(record.id, { notes }); }}
        />
      </td>
      {/* נפתח */}
      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap align-top">
        {record.created_at && (
          <div title={format(new Date(record.created_at), 'dd/MM/yyyy HH:mm')}>
            {format(new Date(record.created_at), 'dd/MM/yy HH:mm', { locale: he })}
          </div>
        )}
      </td>
      {/* ע"י */}
      <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap align-top">
        {record._phone_name || (record.source === 'manual' ? '—' : '?')}
      </td>
      {/* עודכן סטטוס */}
      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap align-top">
        {record.status_updated_at ? (
          <div title={format(new Date(record.status_updated_at), 'dd/MM/yyyy HH:mm')}>
            {format(new Date(record.status_updated_at), 'dd/MM/yy HH:mm', { locale: he })}
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      {/* מקור */}
      <td className="px-4 py-2 text-xs text-gray-400 align-top">
        <button
          onClick={onRowClick}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-brand-600 hover:underline"
        >
          <Pencil className="w-3 h-3" /> פתח
        </button>
        <div className="mt-1">
          {record.source === 'whatsapp' && '💬'}
          {record.source === 'manual' && '✏️'}
          {record.source === 'import' && '📥'}
        </div>
      </td>
    </tr>
  );
}

// =============================================================================
// ASSIGNEE CELL — dropdown to change who's handling the record
// =============================================================================

function AssigneeCell({
  record, phones, onChange,
}: {
  record: RecordRow;
  phones: { id: string; display_name: string; job_title: string | null }[];
  onChange: (phoneId: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentPhoneId = record.assignee_phone_id;
  const currentName = record._assignee_name;

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={currentPhoneId || ''}
        onBlur={() => setEditing(false)}
        onChange={async (e) => {
          setEditing(false);
          setBusy(true);
          try { await onChange(e.target.value || null); } finally { setBusy(false); }
        }}
        className="px-2 py-1 rounded border border-brand-400 text-xs bg-white"
      >
        <option value="">— ללא —</option>
        {phones.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}{p.job_title ? ` (${p.job_title})` : ''}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:ring-2 hover:ring-brand-400 transition disabled:opacity-50 text-right"
      title="שינוי אחראי"
    >
      {currentName ? (
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
          {currentName}
          <Pencil className="w-3 h-3 opacity-40" />
        </span>
      ) : (
        <span className="text-gray-300">+ הקצה</span>
      )}
    </button>
  );
}

// =============================================================================
// EDITABLE CELL — handles status/select inline + click-to-open for others
// =============================================================================

function EditableCell({
  field, record, value, onChange, onRowClick,
}: {
  field: Field;
  record: RecordRow;
  value: any;
  onChange: (newVal: any, opts?: { notify?: boolean }) => Promise<void>;
  onRowClick: () => void;
}) {
  // Relation fields get their own picker
  if (field.type === 'relation') {
    return (
      <RelationCell
        field={field}
        value={value || null}
        onChange={async (newId) => { await onChange(newId); }}
      />
    );
  }

  // Inline editing only for these types — others open the modal
  const isInlineEditable = ['select', 'status', 'checkbox'].includes(field.type);
  const isTextEditable = ['text', 'number', 'currency'].includes(field.type);

  if (isInlineEditable) {
    return <SelectCell field={field} record={record} value={value} onChange={onChange} />;
  }

  if (isTextEditable) {
    return <TextCell field={field} value={value} onChange={onChange} onRowClick={onRowClick} />;
  }

  // For non-editable types, fallback to display + open modal on click
  return (
    <div onClick={onRowClick} className="cursor-pointer">
      <DisplayValue field={field} value={value} />
    </div>
  );
}

function SelectCell({
  field, record, value, onChange,
}: {
  field: Field;
  record: RecordRow;
  value: any;
  onChange: (newVal: any, opts?: { notify?: boolean }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingNotify, setConfirmingNotify] = useState<{ newVal: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (field.type === 'checkbox') {
    return (
      <button
        onClick={async (e) => {
          e.stopPropagation();
          setBusy(true);
          try { await onChange(!value); } finally { setBusy(false); }
        }}
        disabled={busy}
        className="text-lg disabled:opacity-50"
      >
        {value ? '✅' : '⬜'}
      </button>
    );
  }

  const opts = field.config?.options || [];
  const currentOpt = opts.find((o) => o.value === value);

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value || ''}
        onBlur={() => setEditing(false)}
        onChange={async (e) => {
          const newVal = e.target.value || null;
          const newLabel = opts.find((o) => o.value === newVal)?.label || newVal;
          setEditing(false);

          // Detect "completed" / "טופל" type values to offer notification
          const isCompletionStatus = newVal && /טופל|בוצע|סגור|הושלם|done|closed|resolved/i.test(
            String(newVal) + ' ' + String(newLabel)
          );

          if (isCompletionStatus && record.source_chat_id) {
            setConfirmingNotify({ newVal: newVal || '', label: newLabel || '' });
            // Save first, then ask about notification
            setBusy(true);
            try {
              await onChange(newVal);
            } finally {
              setBusy(false);
            }
          } else {
            setBusy(true);
            try { await onChange(newVal); } finally { setBusy(false); }
          }
        }}
        className="px-2 py-1 rounded border border-brand-400 text-sm bg-white"
      >
        <option value="">— ללא —</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        disabled={busy}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:ring-2 hover:ring-brand-400 transition disabled:opacity-50"
        style={{
          background: currentOpt?.color ? `${currentOpt.color}20` : '#f3f4f6',
          color: currentOpt?.color || '#374151',
        }}
        title="לחץ לעריכה"
      >
        {currentOpt?.label || value || '—'}
        <Pencil className="w-3 h-3 opacity-40" />
      </button>

      {confirmingNotify && (
        <NotifyConfirmDialog
          recordId={record.id}
          newStatusLabel={confirmingNotify.label}
          phoneName={record._phone_name || 'הפונה'}
          onClose={() => setConfirmingNotify(null)}
          onSend={async (customMsg) => {
            // Send notification — re-uses the same onChange but with notify flag
            // We hit the API directly since we already saved
            await fetch(`/api/records/${record.id}/update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notify: true,
                notifyMessage: customMsg || `✅ עדכון: הסטטוס שונה ל-"${confirmingNotify.label}"`,
              }),
            });
            setConfirmingNotify(null);
          }}
        />
      )}
    </>
  );
}

function TextCell({
  field, value, onChange, onRowClick,
}: {
  field: Field;
  value: any;
  onChange: (newVal: any) => Promise<void>;
  onRowClick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  async function commit() {
    setEditing(false);
    if (draft === (value?.toString() ?? '')) return;
    setBusy(true);
    try {
      let parsed: any = draft.trim() === '' ? null : draft;
      if (field.type === 'number' || field.type === 'currency') {
        parsed = draft.trim() === '' ? null : Number(draft);
      }
      await onChange(parsed);
    } finally { setBusy(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value?.toString() ?? ''); setEditing(false); }
        }}
        className="px-2 py-1 rounded border border-brand-400 text-sm bg-white w-full max-w-xs"
        disabled={busy}
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(value?.toString() ?? ''); }}
      className="cursor-text hover:bg-gray-100 -mx-1 px-1 py-0.5 rounded min-h-[1.5rem]"
      title="לחץ לעריכה"
    >
      <DisplayValue field={field} value={value} />
    </div>
  );
}

function NotesCell({
  record, onChange,
}: {
  record: RecordRow;
  onChange?: (notes: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.notes || '');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(record.notes || ''); }, [record.notes]);

  async function commit() {
    setEditing(false);
    if (draft === (record.notes || '')) return;
    setBusy(true);
    try { await onChange?.(draft); } finally { setBusy(false); }
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={2}
        className="px-2 py-1 rounded border border-brand-400 text-sm bg-white w-full max-w-xs"
        placeholder="הערה..."
        disabled={busy}
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="cursor-text hover:bg-gray-100 -mx-1 px-1 py-0.5 rounded min-h-[1.5rem] text-xs text-gray-600 max-w-xs"
      title="הוסף הערה"
    >
      {record.notes ? (
        <span className="line-clamp-2">{record.notes}</span>
      ) : (
        <span className="text-gray-300">+ הערה</span>
      )}
    </div>
  );
}

// =============================================================================
// NOTIFY CONFIRMATION DIALOG
// =============================================================================

function NotifyConfirmDialog({
  recordId, newStatusLabel, phoneName, onClose, onSend,
}: {
  recordId: string;
  newStatusLabel: string;
  phoneName: string;
  onClose: () => void;
  onSend: (customMsg?: string) => Promise<void>;
}) {
  const [customMsg, setCustomMsg] = useState(`✅ עדכון: הסטטוס של הרשומה שלך עודכן ל-"${newStatusLabel}"`);
  const [sending, setSending] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-600" />
            <h3 className="font-display font-bold text-lg">לעדכן את {phoneName}?</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            הסטטוס שונה ל-&quot;{newStatusLabel}&quot;. רוצה לשלוח הודעת WhatsApp?
          </p>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">הודעה</label>
          <textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            rows={3}
            className="input-field text-sm"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50/50">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={sending}>
            לא, רק לשמור
          </button>
          <button
            onClick={async () => {
              setSending(true);
              try { await onSend(customMsg); } finally { setSending(false); }
            }}
            disabled={sending}
            className="btn-primary text-sm"
          >
            {sending ? 'שולח...' : <><MessageSquare className="w-4 h-4" />שלח הודעה</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DISPLAY (read-only formatting)
// =============================================================================

function DisplayValue({ field, value }: { field: Field; value: any }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-300">—</span>;
  }

  switch (field.type) {
    case 'currency':
      return <span className="font-medium">₪{Number(value).toLocaleString()}</span>;
    case 'number':
      return <span>{Number(value).toLocaleString()}</span>;
    case 'date':
      try { return <span>{format(new Date(value), 'dd/MM/yyyy')}</span>; }
      catch { return <span>{value}</span>; }
    case 'datetime':
      try { return <span>{format(new Date(value), 'dd/MM/yyyy HH:mm')}</span>; }
      catch { return <span>{value}</span>; }
    case 'multiselect':
      return (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(value) ? value : [value]).map((v, i) => {
            const opt = field.config?.options?.find((o) => o.value === v);
            return (
              <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100">
                {opt?.label || v}
              </span>
            );
          })}
        </div>
      );
    case 'phone':
      return <a href={`tel:${value}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline" dir="ltr">{value}</a>;
    case 'email':
      return <a href={`mailto:${value}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline" dir="ltr">{value}</a>;
    case 'url':
      return <a href={value} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline truncate inline-block max-w-[200px]" dir="ltr">{value}</a>;
    case 'longtext':
      return <span className="text-gray-700 line-clamp-2 max-w-md">{value}</span>;
    case 'rating':
      return <span>{'⭐'.repeat(Number(value) || 0)}</span>;
    default:
      return <span className="text-gray-900">{String(value)}</span>;
  }
}
