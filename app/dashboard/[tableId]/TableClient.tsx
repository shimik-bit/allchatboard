'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Table, Field, RecordRow, View, ViewType, MemberRole } from '@/lib/types/database';
import GridView from '@/components/views/GridView';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import RecordModal from '@/components/RecordModal';
import MoveRecordModal from '@/components/MoveRecordModal';
import TablePermissionsModal from '@/components/TablePermissionsModal';
import FieldsManagerModal from '@/components/FieldsManagerModal';
import {
  Plus, LayoutList, LayoutGrid as LayoutGridIcon, Calendar as CalendarIcon,
  Search, Download, UserCircle, Settings2, Shield, Database, Trash2,
} from 'lucide-react';
import { DevModeOnly } from '@/components/DevMode';

type PhoneOption = {
  id: string;
  display_name: string;
  job_title: string | null;
  permission?: string;
  is_active?: boolean;
};

export default function TableClient({
  table: initialTable,
  fields,
  initialRecords,
  views,
  phones,
  userRole,
  focusRecordId,
}: {
  table: Table;
  fields: Field[];
  initialRecords: RecordRow[];
  views: View[];
  phones: PhoneOption[];
  userRole: MemberRole;
  focusRecordId?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [table, setTable] = useState<Table>(initialTable);
  const [records, setRecords] = useState<RecordRow[]>(initialRecords);
  const [activeView, setActiveView] = useState<ViewType>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordRow | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  // For "Move record" feature - load list of other tables in workspace lazily
  const [otherTables, setOtherTables] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [moveTargetRecord, setMoveTargetRecord] = useState<RecordRow | null>(null);

  // Load other tables when needed (called when user clicks "Move to...")
  const loadOtherTables = useCallback(async () => {
    if (otherTables.length > 0) return;  // already loaded
    const { data } = await supabase
      .from('tables')
      .select('id, name, icon')
      .eq('workspace_id', table.workspace_id)
      .eq('is_archived', false)
      .neq('id', table.id)
      .order('position');
    setOtherTables(data || []);
  }, [supabase, table.workspace_id, table.id, otherTables.length]);

  function openMoveModal(record: RecordRow) {
    loadOtherTables();
    setMoveTargetRecord(record);
    setModalOpen(false);  // Close the record modal
    setEditingRecord(null);
  }

  // When the URL has ?focus=<recordId> (e.g. from a WhatsApp short link
  // /r/<recordId>), open that record's detail modal automatically.
  // useEffect runs after first render so the records array is populated.
  useEffect(() => {
    if (!focusRecordId) return;
    const target = initialRecords.find(r => r.id === focusRecordId);
    if (target) {
      setEditingRecord(target);
      setModalOpen(true);
    }
    // intentionally no dep on initialRecords — this should fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRecordId]);

  const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'editor';
  const canManageTable = userRole === 'owner' || userRole === 'admin';

  // Primary field, group-by field for kanban, date field for calendar
  const primaryField = useMemo(
    () => fields.find((f) => f.is_primary) || fields[0] || null,
    [fields]
  );

  const groupByField = useMemo(
    () => fields.find((f) => f.type === 'select' || f.type === 'status') || null,
    [fields]
  );

  const dateField = useMemo(
    () => fields.find((f) => f.type === 'date' || f.type === 'datetime') || null,
    [fields]
  );

  // Filter records by search term
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase();
    return records.filter((r) => {
      const values = Object.values(r.data || {});
      return values.some((v) => String(v).toLowerCase().includes(q));
    });
  }, [records, searchTerm]);

  // Handlers
  const openCreateModal = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEditModal = (record: RecordRow) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleInlineUpdate = useCallback(
    async (recordId: string, patch: { data?: any; notes?: string; assignee_phone_id?: string | null }, opts?: { notify?: boolean }) => {
      // Optimistic update
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== recordId) return r;
          const next = {
            ...r,
            data: patch.data ? { ...r.data, ...patch.data } : r.data,
            notes: patch.notes !== undefined ? patch.notes : r.notes,
            updated_at: new Date().toISOString(),
          } as any;
          if (patch.assignee_phone_id !== undefined) {
            next.assignee_phone_id = patch.assignee_phone_id;
            const phone = phones.find((p) => p.id === patch.assignee_phone_id);
            next._assignee_name = phone
              ? (phone.job_title ? `${phone.display_name} (${phone.job_title})` : phone.display_name)
              : null;
          }
          return next;
        })
      );

      const res = await fetch(`/api/records/${recordId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, notify: opts?.notify || false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('שגיאה בעדכון: ' + (err.error || res.statusText));
      }
    },
    [phones]
  );

  // Update table's default assignee
  const updateDefaultAssignee = useCallback(
    async (phoneId: string | null) => {
      if (!canManageTable) return;
      setTable((prev) => ({ ...prev, default_assignee_phone_id: phoneId }));
      const { error } = await supabase
        .from('tables')
        .update({ default_assignee_phone_id: phoneId })
        .eq('id', table.id);
      if (error) alert('שגיאה: ' + error.message);
    },
    [canManageTable, table.id, supabase]
  );

  const handleArchiveTable = useCallback(async () => {
    if (!canManageTable) return;
    const confirmText = `הסרת הטבלה "${table.name}" תעביר אותה לארכיון.\n\nהנתונים נשארים ב-DB אבל הטבלה לא תוצג עוד.\n\nכדי לאשר, הקלד את שם הטבלה:`;
    const userInput = prompt(confirmText);
    if (userInput !== table.name) {
      if (userInput !== null) alert('הטקסט לא תואם — הפעולה בוטלה');
      return;
    }
    const { error } = await supabase
      .from('tables')
      .update({ is_archived: true })
      .eq('id', table.id);
    if (error) {
      alert('שגיאה: ' + error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }, [canManageTable, table.id, table.name, supabase, router]);

  const handleSave = useCallback(
    async (data: Record<string, any>) => {
      if (editingRecord) {
        // Update
        const { data: updated, error } = await supabase
          .from('records')
          .update({ data, updated_at: new Date().toISOString() })
          .eq('id', editingRecord.id)
          .select()
          .single();

        if (error) {
          alert('שגיאה בעדכון: ' + error.message);
          return;
        }
        if (updated) {
          setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }
      } else {
        // Create
        const { data: created, error } = await supabase
          .from('records')
          .insert({
            table_id: table.id,
            workspace_id: table.workspace_id,
            data,
            source: 'manual',
            assignee_phone_id: table.default_assignee_phone_id,
          })
          .select('*, assignee:assignee_phone_id(display_name, job_title)')
          .single();

        if (error) {
          alert('שגיאה ביצירה: ' + error.message);
          return;
        }
        if (created) {
          const enriched: any = {
            ...created,
            _assignee_name: (created as any).assignee?.display_name
              ? ((created as any).assignee.job_title
                  ? `${(created as any).assignee.display_name} (${(created as any).assignee.job_title})`
                  : (created as any).assignee.display_name)
              : null,
          };
          setRecords((prev) => [enriched, ...prev]);
        }
      }
      setModalOpen(false);
      setEditingRecord(null);
    },
    [editingRecord, table.id, table.workspace_id, supabase]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('למחוק את הרשומה הזו?')) return;
      const { error } = await supabase.from('records').delete().eq('id', id);
      if (error) {
        alert('שגיאה במחיקה: ' + error.message);
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setModalOpen(false);
      setEditingRecord(null);
    },
    [supabase]
  );

  const handleExportCSV = () => {
    const headers = fields.map((f) => f.name);
    const rows = filteredRecords.map((r) =>
      fields.map((f) => {
        const v = r.data?.[f.slug];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v).replace(/"/g, '""');
      })
    );
    const csv = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');
    // Add BOM for Hebrew in Excel
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.slug || table.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        {/* Mobile: pr-14 leaves room for the hamburger button (top-3 right-3
            on RTL = top-right corner visually). Smaller padding/icon on mobile. */}
        <div className="px-4 md:px-6 py-3 md:py-4 pr-14 md:pr-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div
                className="w-9 h-9 md:w-10 md:h-10 rounded-lg grid place-items-center text-xl md:text-2xl shrink-0"
                style={{ background: `${table.color}20` }}
              >
                {table.icon}
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-lg md:text-xl truncate">{table.name}</h1>
                {table.description && (
                  <p className="text-xs md:text-sm text-gray-500 line-clamp-1">{table.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <button
                onClick={handleExportCSV}
                className="btn-ghost text-xs md:text-sm"
                title="ייצוא לקובץ CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">ייצוא</span>
              </button>
              {canManageTable && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`btn-ghost text-xs md:text-sm ${showSettings ? 'bg-gray-100' : ''}`}
                  title="הגדרות טבלה"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button onClick={openCreateModal} className="btn-primary text-xs md:text-sm">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">רשומה חדשה</span>
                  <span className="sm:hidden">חדש</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table settings panel (collapsible) */}
        {showSettings && canManageTable && (
          <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100">
            <div className="flex items-start gap-6 flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <UserCircle className="w-3.5 h-3.5" />
                  אחראי טיפול ברירת מחדל
                </label>
                <select
                  value={table.default_assignee_phone_id || ''}
                  onChange={(e) => updateDefaultAssignee(e.target.value || null)}
                  className="input-field text-sm"
                >
                  <option value="">— ללא ברירת מחדל —</option>
                  {phones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}{p.job_title ? ` — ${p.job_title}` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  רשומות חדשות יסומנו אוטומטית עם האחראי הזה
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-[180px]">
                <button
                  onClick={() => setShowAddField(true)}
                  className="btn-secondary text-sm flex items-center gap-2 justify-center"
                  title="הוסף שדה חדש לטבלה"
                >
                  <Database className="w-4 h-4" />
                  ניהול שדות
                </button>
                <DevModeOnly fallback={
                  <div className="text-[11px] text-gray-400 text-center py-1.5 px-2 rounded border border-dashed border-gray-200">
                    🔒 הרשאות + מחיקת טבלה — דורש מצב מפתח
                  </div>
                }>
                  <button
                    onClick={() => setShowPermissions(true)}
                    className="btn-secondary text-sm flex items-center gap-2 justify-center"
                    title="קבע מי רואה ועורך"
                  >
                    <Shield className="w-4 h-4" />
                    הרשאות גישה
                  </button>
                  <button
                    onClick={handleArchiveTable}
                    className="text-sm flex items-center gap-2 justify-center px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-medium"
                    title="הסר את הטבלה מסביבת העבודה (לארכיון)"
                  >
                    <Trash2 className="w-4 h-4" />
                    הסר טבלה
                  </button>
                </DevModeOnly>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar: view switcher + search */}
        <div className="px-4 md:px-6 py-2 flex items-center justify-between gap-2 md:gap-4 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <ViewButton
              active={activeView === 'grid'}
              onClick={() => setActiveView('grid')}
              icon={<LayoutList className="w-4 h-4" />}
              label="טבלה"
            />
            <ViewButton
              active={activeView === 'kanban'}
              onClick={() => setActiveView('kanban')}
              icon={<LayoutGridIcon className="w-4 h-4" />}
              label="קנבן"
            />
            <ViewButton
              active={activeView === 'calendar'}
              onClick={() => setActiveView('calendar')}
              icon={<CalendarIcon className="w-4 h-4" />}
              label="לוח שנה"
            />
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש..."
                className="w-full pr-9 pl-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div className="text-xs text-gray-500 shrink-0">
              {filteredRecords.length} / {records.length}
            </div>
          </div>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
        {activeView === 'grid' && (
          <div className="card">
            <GridView
              fields={fields}
              records={filteredRecords}
              phones={phones}
              onRecordClick={openEditModal}
              onRecordUpdate={handleInlineUpdate}
            />
          </div>
        )}
        {activeView === 'kanban' && (
          <KanbanView
            fields={fields}
            records={filteredRecords}
            groupByField={groupByField}
            primaryField={primaryField}
            onRecordClick={openEditModal}
            onRecordUpdate={canEdit ? (id, patch) => handleInlineUpdate(id, patch) : undefined}
          />
        )}
        {activeView === 'calendar' && (
          <CalendarView
            records={filteredRecords}
            dateField={dateField}
            primaryField={primaryField}
            onRecordClick={openEditModal}
          />
        )}
      </div>

      {/* Record modal */}
      {modalOpen && (
        <RecordModal
          table={table}
          fields={fields}
          record={editingRecord}
          canEdit={canEdit}
          onClose={() => {
            setModalOpen(false);
            setEditingRecord(null);
          }}
          onSave={handleSave}
          onDelete={editingRecord ? handleDelete : undefined}
          onMove={canEdit ? openMoveModal : undefined}
        />
      )}

      {/* Move record modal */}
      {moveTargetRecord && (
        <MoveRecordModal
          record={moveTargetRecord}
          sourceTable={{ id: table.id, name: table.name }}
          sourceFields={fields.map(f => ({ id: f.id, name: f.name, slug: f.slug, type: f.type, is_primary: f.is_primary }))}
          allTables={otherTables}
          onClose={() => setMoveTargetRecord(null)}
          onMoved={(newRecordId, newTableId) => {
            setMoveTargetRecord(null);
            // Refresh records (the source might have changed status or been archived)
            router.refresh();
            // Optional: navigate to new record
            // router.push(`/dashboard/${newTableId}?focus=${newRecordId}`);
          }}
        />
      )}

      {/* Permissions modal */}
      {showPermissions && (
        <TablePermissionsModal
          tableId={table.id}
          tableName={table.name}
          onClose={() => setShowPermissions(false)}
        />
      )}

      {/* Fields management modal */}
      {showAddField && (
        <FieldsManagerModal
          tableId={table.id}
          tableName={table.name}
          workspaceId={table.workspace_id}
          onClose={() => setShowAddField(false)}
          onChange={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ViewButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
