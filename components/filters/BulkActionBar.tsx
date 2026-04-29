'use client';

import { useState } from 'react';
import {
  Trash2, X, ChevronDown, Tag, CheckCircle2, XCircle,
  ArrowRightLeft, Loader2, Sparkles, FileSpreadsheet
} from 'lucide-react';
import type { Field, RecordRow, Table } from '@/lib/types/database';

interface BulkActionBarProps {
  /** IDs of selected records */
  selectedIds: Set<string>;
  /** All currently visible records (for context-aware actions) */
  records: RecordRow[];
  /** Table fields - used to detect available smart actions */
  fields: Field[];
  /** Current table */
  table: Table;
  /** User's role - some actions need elevated permission */
  userRole: string;
  /** Called to clear the selection */
  onClearSelection: () => void;
  /** Called after a bulk action mutates data - parent should reload */
  onActionComplete: () => void;
}

/**
 * Smart bulk action bar - actions are computed based on what fields exist
 * in the table. E.g. if there's a `status` field, "Change status" appears.
 * If `approval_required=true`, "Approve" / "Reject" appear.
 */
export default function BulkActionBar({
  selectedIds, records, fields, table, userRole,
  onClearSelection, onActionComplete,
}: BulkActionBarProps) {
  const [busy, setBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const count = selectedIds.size;
  if (count === 0) return null;

  const canEdit = ['owner', 'admin', 'editor'].includes(userRole);
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole);

  // ===== Detect "smart" fields that drive context-aware actions =====
  const statusField = fields.find((f) => f.type === 'status');
  const selectFields = fields.filter((f) => f.type === 'select');
  const approvalRequired = (table as any).approval_required === true;
  const categoryField = fields.find(
    (f) => f.slug === 'category' || f.slug === 'tag'
  );

  // ===== Action handlers =====
  const callBulk = async (action: string, payload?: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/records/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          record_ids: Array.from(selectedIds),
          payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'שגיאה בפעולה');
        return;
      }
      if (json.failed > 0) {
        alert(`${json.succeeded} הצליחו, ${json.failed} נכשלו`);
      }
      onActionComplete();
      onClearSelection();
    } finally {
      setBusy(false);
      setOpenMenu(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`למחוק ${count} רשומות? פעולה זו לא ניתנת לביטול.`)) return;
    await callBulk('delete');
  };

  const handleSetStatus = (value: string) => callBulk('set_status', { value });

  const handleUpdateField = (slug: string, value: string) =>
    callBulk('update_field', { field_slug: slug, value });

  const handleApprove = () => {
    if (!confirm(`לאשר ${count} רשומות?`)) return;
    callBulk('approve');
  };

  const handleReject = () => {
    const reason = prompt('סיבת הדחייה (אופציונלי):') || '';
    callBulk('reject', { reason });
  };

  const handleExport = () => {
    // Client-side CSV export - no server call needed
    const selected = records.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;

    const headers = fields.map((f) => f.name);
    const rows = selected.map((r) =>
      fields.map((f) => {
        const v = r.data?.[f.slug];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        // Escape quotes for CSV
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      })
    );

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    // BOM for Excel Hebrew support
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${table.name}_${selected.length}_records_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop click to close menus */}
      {openMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenu(null)}
        />
      )}

      {/* Floating bar - bottom-center on desktop, bottom-full-width on mobile.
          Uses overflow-x-auto + flex-nowrap so all action buttons remain
          accessible by horizontal scroll if there are many (rather than
          stacking awkwardly). */}
      <div className="fixed bottom-2 sm:bottom-4 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 sm:max-w-[95vw]">
        <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-2 sm:px-3 py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {/* Count + close */}
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-lg">
            <span className="text-sm font-bold">{count} נבחרו</span>
            <button
              onClick={onClearSelection}
              className="hover:bg-gray-700 rounded p-0.5"
              title="ביטול בחירה"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {busy && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}

          {/* Approve / Reject (if approval workflow on this table) */}
          {approvalRequired && canEdit && (
            <>
              <ActionButton
                onClick={handleApprove}
                icon={CheckCircle2}
                label="אשר"
                disabled={busy}
                color="emerald"
              />
              <ActionButton
                onClick={handleReject}
                icon={XCircle}
                label="דחה"
                disabled={busy}
                color="red"
              />
              <Divider />
            </>
          )}

          {/* Change status */}
          {statusField && canEdit && (
            <DropdownAction
              label="שנה סטטוס"
              icon={Tag}
              isOpen={openMenu === 'status'}
              onToggle={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
              disabled={busy}
            >
              {(statusField.config?.options || []).map((opt: any) => (
                <button
                  key={opt.value}
                  onClick={() => handleSetStatus(opt.value)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-right w-full text-gray-900"
                >
                  {opt.color && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className="text-sm">{opt.label}</span>
                </button>
              ))}
            </DropdownAction>
          )}

          {/* Other select fields (category, etc.) */}
          {selectFields.slice(0, 2).map((field) => {
            if (field.slug === 'status') return null; // handled above
            const optionCount = field.config?.options?.length || 0;
            if (optionCount === 0) return null;
            return (
              <DropdownAction
                key={field.id}
                label={field.name}
                icon={Sparkles}
                isOpen={openMenu === field.id}
                onToggle={() => setOpenMenu(openMenu === field.id ? null : field.id)}
                disabled={busy || !canEdit}
              >
                {(field.config?.options || []).map((opt: any) => (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdateField(field.slug, opt.value)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-right w-full text-gray-900"
                  >
                    {opt.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className="text-sm">{opt.label}</span>
                  </button>
                ))}
              </DropdownAction>
            );
          })}

          <Divider />

          {/* Export to CSV - always available */}
          <ActionButton
            onClick={handleExport}
            icon={FileSpreadsheet}
            label="ייצא"
            disabled={busy}
            color="gray"
          />

          {/* Delete - destructive, always last */}
          {canEdit && (
            <ActionButton
              onClick={handleDelete}
              icon={Trash2}
              label="מחק"
              disabled={busy}
              color="red"
            />
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function ActionButton({
  onClick, icon: Icon, label, disabled, color,
}: {
  onClick: () => void;
  icon: any;
  label: string;
  disabled?: boolean;
  color: 'emerald' | 'red' | 'gray';
}) {
  const colorClasses = {
    emerald: 'hover:bg-emerald-700 text-emerald-300',
    red:     'hover:bg-red-700 text-red-300',
    gray:    'hover:bg-gray-700 text-gray-200',
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition disabled:opacity-50 ${colorClasses}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}

function DropdownAction({
  label, icon: Icon, isOpen, onToggle, disabled, children,
}: {
  label: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded hover:bg-gray-700 text-gray-200 transition disabled:opacity-50"
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-2xl p-1 min-w-[160px] max-w-[80vw] max-h-64 overflow-y-auto" dir="rtl">
          {children}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-700 mx-0.5" />;
}
