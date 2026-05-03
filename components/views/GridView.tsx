'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Field, RecordRow } from '@/lib/types/database';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { MessageSquare, Bell, Check, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import RelationCell from '@/components/RelationCell';
import SummaryRow from '@/components/SummaryRow';
import { useT } from '@/lib/i18n/useT';
import type { SortState } from '@/lib/grid/sort';
import { useColumnWidths } from '@/lib/hooks/useColumnWidths';
import { evalColorRules, type ColorRule } from '@/lib/grid/color-rules';

export default function GridView({
  fields, records, phones, onRecordClick, onRecordUpdate,
  selectedIds, onToggleSelect, onSelectAll,
  sort, onSortChange, activeCell, onCellActivate,
  workspaceCode, tableId,
}: {
  fields: Field[];
  records: RecordRow[];
  phones?: { id: string; display_name: string; job_title: string | null }[];
  onRecordClick: (r: RecordRow) => void;
  onRecordUpdate?: (recordId: string, patch: { data?: any; notes?: string; assignee_phone_id?: string | null }, opts?: { notify?: boolean }) => Promise<void>;
  /** Selection state — when undefined, the checkbox column is hidden entirely */
  selectedIds?: Set<string>;
  /** Toggle a single record's selection */
  onToggleSelect?: (id: string) => void;
  /** Toggle all visible records (true = check all, false = uncheck all) */
  onSelectAll?: (allChecked: boolean) => void;
  /** Current sort state (null = unsorted) */
  sort?: SortState | null;
  /** Called when a header is clicked */
  onSortChange?: (fieldSlug: string) => void;
  /** Currently active (keyboard-selected) cell - row/col indices */
  activeCell?: { row: number; col: number } | null;
  /** Called when a cell is clicked - sets the active cell */
  onCellActivate?: (coord: { row: number; col: number }) => void;
  /** Workspace's short code (KBL, BEA, etc.) - rendered as a leading column
      together with each record's record_number, e.g. "KBL-EXP-0042". This
      gives accountants and multi-workspace users an unambiguous reference
      for any record. Only shown when workspaceCode AND record_number exist. */
  workspaceCode?: string | null;
  /** Table ID — used to scope per-column-width localStorage entries so each
      table remembers its own custom widths separately. */
  tableId?: string;
}) {
  const { widths, setWidth } = useColumnWidths(tableId || 'default');
  const { t } = useT();
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
    // overscroll-contain prevents the page from scrolling when the user
    // reaches the end of horizontal scroll inside the table.
    // The right shadow gradient is a subtle visual hint that there's
    // more content off-screen — Excel/Sheets do similar.
    <div className="overflow-x-auto overscroll-x-contain relative">
      {/* table-auto + min-w-max lets columns size to their content instead of
          getting squeezed together. Combined with the parent overflow-x-auto,
          this gives natural horizontal scroll on mobile while looking normal
          on desktop. */}
      <table className="text-sm table-auto min-w-max">
        {/* Sticky thead - column headers stay visible during vertical scroll.
            top-0 anchors to the scroll container (the parent overflow-x-auto
            div). The bg-gray-50 ensures rows underneath don't bleed through.
            z-20 keeps it above the active-cell ring (z-10) and below the
            tfoot summary (also z-10) — order works because tfoot sticks bottom. */}
        <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur shadow-sm">
          <tr className="border-b border-gray-200">
            {selectedIds !== undefined && onSelectAll && (
              <th className="px-3 py-2.5 text-center w-10 sticky right-0 bg-gray-50/50">
                <input
                  type="checkbox"
                  checked={records.length > 0 && records.every((r) => selectedIds.has(r.id))}
                  ref={(el) => {
                    if (el) {
                      const someChecked = records.some((r) => selectedIds.has(r.id));
                      const allChecked = records.length > 0 && records.every((r) => selectedIds.has(r.id));
                      el.indeterminate = someChecked && !allChecked;
                    }
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded cursor-pointer"
                  title="בחר הכל"
                />
              </th>
            )}
            {/* Global ID column — only renders when this workspace has a code
                AND at least one record has a record_number. Otherwise it would
                just be a column of em-dashes wasting horizontal real estate. */}
            {workspaceCode && records.some((r) => r.record_number) && (
              <th className="text-right px-2 sm:px-3 py-2 sm:py-2.5 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide">
                מזהה
              </th>
            )}
            {fields.map((f) => {
              const isSorted = sort?.fieldSlug === f.slug;
              const sortDir = isSorted ? sort!.direction : null;
              const customWidth = widths[f.slug];
              return (
                <th
                  key={f.id}
                  data-field-slug={f.slug}
                  className={`text-right px-2 sm:px-4 py-2 sm:py-2.5 font-medium text-gray-700 whitespace-nowrap relative ${
                    onSortChange ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  } ${isSorted ? 'bg-emerald-50/50 text-emerald-800' : ''}`}
                  onClick={onSortChange ? () => onSortChange(f.slug) : undefined}
                  title={onSortChange ? 'לחץ למיון · גרור את הקצה לשינוי רוחב' : undefined}
                  style={customWidth ? { width: customWidth, minWidth: customWidth, maxWidth: customWidth } : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {f.name}
                    {/* Sort indicator: only render an icon when active to keep
                        headers visually quiet when no sort is applied */}
                    {sortDir === 'asc' && <ArrowUp className="w-3 h-3 text-emerald-600" />}
                    {sortDir === 'desc' && <ArrowDown className="w-3 h-3 text-emerald-600" />}
                  </span>
                  {/* Resize handle - thin draggable strip on the LEFT edge.
                      In RTL, "left" of a header visually means the boundary
                      between this column and the next one (since columns
                      flow right-to-left). Mouse-down here begins a drag;
                      mousemove updates width via setWidth; mouseup ends.
                      We skip this on the rightmost column (sticky to right
                      edge) to avoid the handle being cut off. */}
                  <ResizeHandle
                    onResize={(deltaPx) => {
                      const currentWidth =
                        customWidth ??
                        // Read the current rendered width as the starting
                        // baseline when the user has never resized this col
                        // before. We wrap in a tiny try/catch because some
                        // server-side renders don't have getBoundingClientRect.
                        (() => {
                          try {
                            const el = document.querySelector(
                              `[data-field-slug="${f.slug}"]`
                            ) as HTMLElement | null;
                            return el?.getBoundingClientRect().width ?? 150;
                          } catch {
                            return 150;
                          }
                        })();
                      // In RTL, dragging the handle TO THE LEFT widens the
                      // column (the column extends further left). In LTR
                      // it'd be the opposite. Since the dashboard is locked
                      // RTL, we negate the delta.
                      setWidth(f.slug, currentWidth - deltaPx);
                    }}
                  />
                </th>
              );
            })}
            <th className="text-right px-2 sm:px-4 py-2 sm:py-2.5 font-medium text-gray-700 whitespace-nowrap">
              {t('records.assignee')}
            </th>
            <th className="text-right px-2 sm:px-4 py-2 sm:py-2.5 font-medium text-gray-700 whitespace-nowrap">
              {t('common.notes')}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              {t('records.created_at')}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              {t('records.assignee')}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-right font-medium text-gray-500 text-xs whitespace-nowrap">
              {t('records.last_updated')}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-right font-medium text-gray-500 text-xs"  >{t('common.type')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, rowIndex) => (
            <RecordRowComponent
              key={r.id}
              record={r}
              rowIndex={rowIndex}
              fields={fields}
              phones={phones || []}
              onRowClick={() => onRecordClick(r)}
              onUpdate={onRecordUpdate}
              isSelected={selectedIds?.has(r.id)}
              showCheckbox={selectedIds !== undefined}
              onToggleSelect={onToggleSelect}
              activeCell={activeCell}
              onCellActivate={onCellActivate}
              workspaceCode={workspaceCode}
              showIdColumn={!!workspaceCode && records.some((rr) => rr.record_number)}
              columnWidths={widths}
            />
          ))}
        </tbody>
        {records.length > 0 && (
          <tfoot className="group">
            <SummaryRow
              fields={fields}
              records={records}
              showCheckbox={selectedIds !== undefined}
              showIdColumn={!!workspaceCode && records.some((r) => r.record_number)}
            />
          </tfoot>
        )}
      </table>
    </div>
  );
}

function RecordRowComponent({
  record, rowIndex, fields, phones, onRowClick, onUpdate,
  isSelected, showCheckbox, onToggleSelect,
  activeCell, onCellActivate,
  workspaceCode, showIdColumn, columnWidths,
}: {
  record: RecordRow;
  rowIndex: number;
  fields: Field[];
  phones: { id: string; display_name: string; job_title: string | null }[];
  onRowClick: () => void;
  onUpdate?: (recordId: string, patch: { data?: any; notes?: string; assignee_phone_id?: string | null }, opts?: { notify?: boolean }) => Promise<void>;
  isSelected?: boolean;
  showCheckbox?: boolean;
  onToggleSelect?: (id: string) => void;
  activeCell?: { row: number; col: number } | null;
  onCellActivate?: (coord: { row: number; col: number }) => void;
  workspaceCode?: string | null;
  showIdColumn?: boolean;
  /** Map of fieldSlug → custom width (px). Cells with a custom width get
      style.width applied so the row's td widths track the th widths. */
  columnWidths?: Record<string, number>;
}) {
  const { t } = useT();
  // Pre-compute the global ID once per row. Cheap since record_number rarely
  // changes between renders. Returns null when either the workspace doesn't
  // have a code or this specific record doesn't have a number yet (edge case
  // for very old records pre-numbering migration).
  const globalId =
    workspaceCode && record.record_number
      ? `${workspaceCode}-${record.record_number}`
      : null;
  return (
    <tr
      onClick={onRowClick}
      className={`border-b border-gray-100 transition-colors group cursor-pointer ${
        isSelected ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-brand-50/40'
      }`}
      title={t('records.edit')}
    >
      {showCheckbox && (
        <td
          className="px-3 py-2 text-center align-middle sticky right-0 bg-inherit"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={() => onToggleSelect?.(record.id)}
            className="rounded cursor-pointer"
          />
        </td>
      )}
      {/* Global ID cell — only rendered when showIdColumn is true (i.e. the
          workspace has a code AND at least some records have record_numbers).
          The cell uses a monospace tabular-num font and gray text so it reads
          as metadata, not data. Per-row em-dash fallback so unnumbered
          records (very old, pre-numbering migration) still occupy the column. */}
      {showIdColumn && (
        <td
          className="px-2 sm:px-3 py-2 align-middle whitespace-nowrap font-mono text-xs text-gray-500 tabular-nums"
          onClick={(e) => e.stopPropagation()}
          title={globalId ? `מזהה גלובלי: ${globalId}` : 'אין מזהה'}
        >
          {globalId || <span className="text-gray-300">—</span>}
        </td>
      )}
      {fields.map((f, colIndex) => {
        const isActive = activeCell?.row === rowIndex && activeCell?.col === colIndex;
        // Apply the same custom width as the header so columns line up.
        // When no custom width, fall back to Tailwind's max-w utilities.
        const customWidth = columnWidths?.[f.slug];

        // Conditional formatting — read rules from the field config and
        // pick the first one that matches the cell value. Active cell still
        // wins visually (we only set background when the cell isn't active),
        // text color is always applied so highlighted-but-active cells still
        // read correctly.
        const cellValue = record.data?.[f.slug];
        const colorRules = (f.config as { color_rules?: ColorRule[] } | undefined)?.color_rules;
        const colorStyle = evalColorRules(colorRules, cellValue);
        const tdStyle: React.CSSProperties = customWidth
          ? { width: customWidth, minWidth: customWidth, maxWidth: customWidth }
          : {};
        if (!isActive && colorStyle.backgroundColor) tdStyle.backgroundColor = colorStyle.backgroundColor;
        if (colorStyle.color) tdStyle.color = colorStyle.color;

        return (
          <td
            key={f.id}
            className={`px-2 sm:px-4 py-2 align-top transition-shadow ${
              !customWidth ? 'max-w-[200px] sm:max-w-[280px]' : ''
            } ${isActive ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40' : ''}`}
            data-cell-row={rowIndex}
            data-cell-col={colIndex}
            style={tdStyle}
            onClick={(e) => {
              // Single click → set as active. Double click is what actually
              // edits, handled by EditableCell (existing behavior).
              if (onCellActivate) {
                e.stopPropagation();
                onCellActivate({ row: rowIndex, col: colIndex });
              }
            }}
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
        );
      })}
      {/* בטיפול (assignee) */}
      <td className="px-2 sm:px-4 py-2 align-top whitespace-nowrap">
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
  const { t } = useT();
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

/**
 * ResizeHandle — invisible drag-handle strip rendered on the column boundary.
 *
 * Pointer down: capture the start position. Pointer move: emit deltas to
 * the parent header which decides what the new width is. Pointer up:
 * release and dispatch a final resize.
 *
 * Visual: 4px wide strip flush against the column edge. Becomes a blue line
 * only on hover so the headers don't look noisy when not in use.
 *
 * Why pointer events instead of mouse events? Pointer events normalize
 * touch + mouse + pen, and pointer capture means we keep getting moves
 * even if the cursor leaves the element — which it will when the column
 * gets narrow.
 */
function ResizeHandle({ onResize }: { onResize: (deltaPx: number) => void }) {
  const startXRef = useRef<number | null>(null);

  return (
    <div
      // Position: absolutely placed at the start (left in RTL) of the cell.
      // The 1px width with 4px hit area trick = visible strip is 1px but
      // pointer hit zone is ~5px so it's easier to grab.
      className="absolute top-0 bottom-0 left-0 w-1 cursor-col-resize bg-transparent hover:bg-brand-500 transition-colors"
      // Stop sort from firing when user clicks the handle
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        startXRef.current = e.clientX;
        // Capture so we keep getting moves even when leaving the strip
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (startXRef.current === null) return;
        const delta = e.clientX - startXRef.current;
        // Throttle: only fire once we've moved at least 1px
        if (Math.abs(delta) < 1) return;
        onResize(delta);
        startXRef.current = e.clientX;
      }}
      onPointerUp={(e) => {
        startXRef.current = null;
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore — capture might already be released
        }
      }}
      onPointerCancel={() => {
        startXRef.current = null;
      }}
    />
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
  const { t } = useT();
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
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The cell wrapper is focusable so it can receive keyboard events even
  // when not in edit mode. tabIndex=-1 keeps it out of the tab cycle but
  // still focusable programmatically.
  const wrapRef = useRef<HTMLDivElement>(null);

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
      ref={wrapRef}
      tabIndex={-1}
      onClick={(e) => {
        // First click on a cell selects it (the parent td handles activation
        // via the data-cell-row/col attributes). We don't auto-open the
        // editor on first click — that's now reserved for double-click,
        // matching Excel/Sheets convention.
        e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        // Double-click opens the inline editor — this is the Excel pattern
        // users already expect.
        e.stopPropagation();
        setDraft(value?.toString() ?? '');
        setEditing(true);
      }}
      onKeyDown={(e) => {
        // F2 or Enter on a focused but-not-editing cell opens the editor.
        // We don't preventDefault on Enter inside an input (handled in the
        // editor block above), only when the cell is the focused element.
        if (e.key === 'F2' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value?.toString() ?? '');
          setEditing(true);
          return;
        }
        // Typing a printable character opens the editor with that char as
        // the new initial value (Excel: "type to overwrite"). Filter out
        // navigation keys, modifiers, and special keys that shouldn't
        // accidentally start an edit.
        if (
          e.key.length === 1 &&
          !e.ctrlKey && !e.metaKey && !e.altKey
        ) {
          e.preventDefault();
          e.stopPropagation();
          setDraft(e.key);
          setEditing(true);
        }
      }}
      className="cursor-text hover:bg-gray-100 -mx-1 px-1 py-0.5 rounded min-h-[1.5rem] focus:outline-none"
      title={`${t('common.edit')} (לחיצה כפולה / F2)`}
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
  const { t } = useT();
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
