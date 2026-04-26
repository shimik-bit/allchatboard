'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
        <p>{t('records.no_records')}</p>
        <p className="text-sm mt-2">{t('records.no_records_hint')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* table-auto + min-w-max lets columns size to their content instead of
          getting squeezed together. Combined with the parent overflow-x-auto,
          this gives natural horizontal scroll on mobile while looking normal
          on desktop. */}
      <table className="text-sm table-auto min-w-max">
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
              {t('records.assignee')}
            </th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
              {t('common.notes')}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              {t('records.created_at')}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              {t('records.assignee')}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              {t('records.last_updated')}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs"  >{t('common.type')}</th>
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
      onClick={onRowClick}
      className="border-b border-gray-100 hover:bg-brand-50/40 transition-colors group cursor-pointer"
      title={t('records.edit')}
    >
      {fields.map((f) => (
        <td
          key={f.id}
          className="px-4 py-2 align-top max-w-[280px]"
        >
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
          onClick={(e) => { e.stopPropagation(); onRowClick(); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors text-xs font-medium"
          title={t('records.edit')}
        >
          <Pencil className="w-3 h-3" /> {t('common.open')}
        </button>
        <div className="mt-1 flex items-center gap-1">
          {record.source === 'whatsapp' && <span title={t('records.source_whatsapp')}>💬</span>}
          {record.source === 'manual' && <span title={t('records.source_manual')}>✏️</span>}
          {record.source === 'import' && <span title={t('records.source_api')}>📥</span>}
          {record.attachment_url && (
            <span title={t('fields.file')} className="text-gray-400">📎</span>
          )}
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
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const currentPhoneId = record.assignee_phone_id;
  const currentName = record._assignee_name || record.assignee_raw_name;
  const notifiedAt = record.assignee_notified_at;

  // Manual notify — for records that pre-date assignment_rules, or where
  // the routing rule didn't fire but the user still wants to notify.
  // After a successful send, refresh the page so the green ✓ shows up.
  async function handleManualNotify(e: React.MouseEvent) {
    e.stopPropagation();
    if (notifying) return;
    setNotifying(true);
    try {
      const res = await fetch(`/api/records/${record.id}/notify-assignee`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message || json.error || t('errors.generic'));
        return;
      }
      router.refresh();
    } catch (err: any) {
      alert(t('common.error') + ': ' + err.message);
    } finally {
      setNotifying(false);
    }
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={currentPhoneId || ''}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => setEditing(false)}
        onChange={async (e) => {
          e.stopPropagation();
          setEditing(false);
          setBusy(true);
          try { await onChange(e.target.value || null); } finally { setBusy(false); }
        }}
        className="px-2 py-1 rounded border border-brand-400 text-xs bg-white"
      >
        <option value="">— {t('common.no')} —</option>
        {phones.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}{p.job_title ? ` (${p.job_title})` : ''}
          </option>
        ))}
      </select>
    );
  }

  const notifiedTooltip = notifiedAt
    ? `התראה נשלחה ב-${new Date(notifiedAt).toLocaleString('he-IL', {
        day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit'
      })}`
    : null;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        disabled={busy}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:ring-2 hover:ring-brand-400 transition disabled:opacity-50 text-right"
        title={t('records.assignee')}
      >
        {currentName ? (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            {notifiedAt ? (
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500 text-white text-[9px] font-bold leading-none"
                title={notifiedTooltip || ''}
              >
                ✓
              </span>
            ) : (
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-white text-[9px] leading-none"
                title={t('common.loading')}
              >
                📲
              </span>
            )}
            {currentName}
            <Pencil className="w-3 h-3 opacity-40" />
          </span>
        ) : (
          <span className="text-gray-300">+ {t('common.add')}</span>
        )}
      </button>

      {/* Manual notify button — only shown when there's an assignee but
          no notification was sent yet. Lets users push a notification
          for records that pre-date assignment_rules. */}
      {currentName && !notifiedAt && (
        <button
          onClick={handleManualNotify}
          disabled={notifying}
          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 disabled:opacity-50 transition"
          title={t('common.info')}
        >
          {notifying ? '…' : t('common.confirm')}
        </button>
      )}
    </div>
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
        onClick={(e) => e.stopPropagation()}
        onBlur={() => setEditing(false)}
        onChange={async (e) => {
          e.stopPropagation();
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
        <option value="">— {t('common.no')} —</option>
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
        title={t('common.edit')}
      >
        {currentOpt?.label || value || '—'}
        <Pencil className="w-3 h-3 opacity-40" />
      </button>

      {confirmingNotify && (
        <NotifyConfirmDialog
          recordId={record.id}
          newStatusLabel={confirmingNotify.label}
          phoneName={record._phone_name || t('records.assignee')}
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
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
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
      title={t('common.edit')}
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
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={2}
        className="px-2 py-1 rounded border border-brand-400 text-sm bg-white w-full max-w-xs"
        placeholder={t('common.notes')}
        disabled={busy}
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="cursor-text hover:bg-gray-100 -mx-1 px-1 py-0.5 rounded min-h-[1.5rem] text-xs text-gray-600 max-w-xs"
      title={t('common.notes')}
    >
      {record.notes ? (
        <span className="line-clamp-2">{record.notes}</span>
      ) : (
        <span className="text-gray-300">+ {t('common.notes')}</span>
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
      return <span className="text-gray-700 line-clamp-2 break-words">{value}</span>;
    case 'rating':
      return <span>{'⭐'.repeat(Number(value) || 0)}</span>;
    default:
      // break-words instead of letting the browser break mid-word (which on
      // Hebrew + narrow columns produces vertical-letter-stack disasters)
      return <span className="text-gray-900 break-words">{String(value)}</span>;
  }
}
