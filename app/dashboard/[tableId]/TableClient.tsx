'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Table, Field, RecordRow, View, ViewType, MemberRole } from '@/lib/types/database';
import GridView from '@/components/views/GridView';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import RecordModal from '@/components/RecordModal';
import {
  Plus, LayoutList, LayoutGrid as LayoutGridIcon, Calendar as CalendarIcon,
  Search, Download, UserCircle, Settings2,
} from 'lucide-react';

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
}: {
  table: Table;
  fields: Field[];
  initialRecords: RecordRow[];
  views: View[];
  phones: PhoneOption[];
  userRole: MemberRole;
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
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg grid place-items-center text-2xl"
                style={{ background: `${table.color}20` }}
              >
                {table.icon}
              </div>
              <div>
                <h1 className="font-display font-bold text-xl">{table.name}</h1>
                {table.description && (
                  <p className="text-sm text-gray-500">{table.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="btn-ghost text-sm"
                title="ייצוא לקובץ CSV"
              >
                <Download className="w-4 h-4" />
                ייצוא
              </button>
              {canManageTable && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`btn-ghost text-sm ${showSettings ? 'bg-gray-100' : ''}`}
                  title="הגדרות טבלה"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button onClick={openCreateModal} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" />
                  רשומה חדשה
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
            </div>
          </div>
        )}

        {/* Toolbar: view switcher + search */}
        <div className="px-6 py-2 flex items-center justify-between gap-4 border-t border-gray-100">
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

          <div className="flex items-center gap-2 flex-1 max-w-xs">
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
