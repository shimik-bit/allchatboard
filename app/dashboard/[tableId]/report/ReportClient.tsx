'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, Plus, X, Filter, Calendar as CalIcon,
  TrendingUp, BarChart3, PieChart as PieIcon, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line,
} from 'recharts';
import type { Field, RecordRow, Table } from '@/lib/types/database';
import { getDefaultWidgets, type DefaultWidget, type WidgetType } from '@/lib/dashboard/default-widgets';
import { computeWidget } from '@/lib/dashboard/compute-widget';
import { createClient } from '@/lib/supabase/client';

type CustomWidget = {
  id: string;
  type: string;
  title: string;
  config: any;
};

export default function ReportClient({
  table, fields, records, customWidgets, canEdit,
}: {
  table: Table;
  fields: Field[];
  records: RecordRow[];
  customWidgets: CustomWidget[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  
  // ─── Filters ───
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // ─── Add widget modal ───
  const [adding, setAdding] = useState(false);
  
  // Filter records based on date preset
  const filteredRecords = useMemo(() => {
    let from: Date | null = null;
    let to: Date | null = null;
    const now = new Date();
    
    if (datePreset === '7d') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (datePreset === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (datePreset === '90d') from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (datePreset === 'custom') {
      if (customFrom) from = new Date(customFrom);
      if (customTo) to = new Date(customTo + 'T23:59:59');
    }
    
    return records.filter(r => {
      const created = new Date(r.created_at);
      if (from && created < from) return false;
      if (to && created > to) return false;
      
      // Status filter
      if (statusFilter) {
        const statusField = fields.find(f => f.type === 'status' || f.type === 'select');
        if (statusField) {
          const v = r.data?.[statusField.slug];
          if (v !== statusFilter) return false;
        }
      }
      
      return true;
    });
  }, [records, datePreset, customFrom, customTo, statusFilter, fields]);
  
  // Auto-generated default widgets + user custom widgets
  const defaultWidgets = useMemo(
    () => getDefaultWidgets(fields, filteredRecords.length),
    [fields, filteredRecords.length]
  );
  
  const allWidgets: (DefaultWidget | CustomWidget)[] = [
    ...defaultWidgets,
    ...customWidgets,
  ];
  
  // Get status options for filter
  const statusField = fields.find(f => f.type === 'status' || f.type === 'select');
  const statusOptions = statusField?.config?.options || [];
  
  async function deleteWidget(widgetId: string) {
    const { error } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', widgetId);
    if (!error) router.refresh();
  }
  
  // Separate KPIs from charts
  const kpiWidgets = allWidgets.filter(w => w.type === 'kpi');
  const chartWidgets = allWidgets.filter(w => w.type !== 'kpi');
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <Link
            href={`/dashboard/${table.id}`}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-purple-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">חזרה לטבלה</span>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <span className="truncate">דוח: {table.icon} {table.name}</span>
            </h1>
            <p className="text-xs text-gray-500">
              {filteredRecords.length} מתוך {records.length} רשומות
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setAdding(true)}
              className="btn-primary text-xs md:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">הוסף גרף</span>
            </button>
          )}
        </div>
        
        {/* Filters bar */}
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center gap-2 flex-wrap text-sm">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500 text-xs">פילטרים:</span>
            
            {/* Date preset */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
              {[
                { v: 'all', l: 'הכל' },
                { v: '7d', l: '7 ימים' },
                { v: '30d', l: '30 ימים' },
                { v: '90d', l: '3 חודשים' },
                { v: 'custom', l: 'מותאם' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setDatePreset(opt.v as any)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    datePreset === opt.v
                      ? 'bg-purple-100 text-purple-700 font-bold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1"
                />
                <span className="text-gray-400">←</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1"
                />
              </div>
            )}
            
            {/* Status filter */}
            {statusField && statusOptions.length > 0 && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value="">{statusField.name}: הכל</option>
                {statusOptions.map((opt: any) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            
            {(statusFilter || datePreset !== '30d') && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setDatePreset('30d');
                  setCustomFrom('');
                  setCustomTo('');
                }}
                className="text-xs text-gray-500 hover:text-purple-600 mr-auto"
              >
                נקה פילטרים
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Empty state */}
        {filteredRecords.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-700 font-medium">אין נתונים להציג</p>
            <p className="text-sm text-gray-500 mt-1">
              {records.length === 0
                ? 'הטבלה ריקה - הוסף רשומות כדי לראות דוח'
                : 'הפילטר לא מתאים לאף רשומה. נסה פילטר אחר.'}
            </p>
          </div>
        )}
        
        {/* KPI cards row */}
        {kpiWidgets.length > 0 && filteredRecords.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {kpiWidgets.map(w => {
              const computed = computeWidget(w as any, filteredRecords, fields);
              if (!computed || computed.type !== 'kpi') return null;
              const isCustom = !('isDefault' in w);
              return (
                <div
                  key={w.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow relative group"
                >
                  {isCustom && canEdit && (
                    <button
                      onClick={() => deleteWidget(w.id)}
                      className="absolute top-2 left-2 p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <div className="text-xs text-gray-500 mb-1">{w.title}</div>
                  <div className="text-2xl md:text-3xl font-display font-black text-gray-900">
                    {computed.value}
                  </div>
                  {computed.hint && (
                    <div className="text-[10px] text-gray-400 mt-1">{computed.hint}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Charts grid */}
        {chartWidgets.length > 0 && filteredRecords.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chartWidgets.map(w => {
              const computed = computeWidget(w as any, filteredRecords, fields);
              if (!computed || computed.type === 'kpi') return null;
              const isCustom = !('isDefault' in w);
              const isWide = w.type === 'line' || w.type === 'area';
              return (
                <div
                  key={w.id}
                  className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow relative group ${
                    isWide ? 'md:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-base">{w.title}</h3>
                    <div className="flex items-center gap-2">
                      {computed.totalValue !== undefined && (
                        <span className="text-xs text-gray-500">
                          סה״כ: <span className="font-bold text-gray-800">{computed.totalValue}</span>
                        </span>
                      )}
                      {isCustom && canEdit && (
                        <button
                          onClick={() => deleteWidget(w.id)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {computed.data.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                      אין מספיק נתונים
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart(w.type as WidgetType, computed.data)}
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {adding && (
        <AddWidgetModal
          tableId={table.id}
          workspaceId={table.workspace_id}
          fields={fields}
          existingPositions={customWidgets.length}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function renderChart(type: WidgetType, data: any[]): React.ReactElement {
  const COLORS = ['#7B3FE4', '#FF2D8A', '#FFB800', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  
  if (type === 'area') {
    return (
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7B3FE4" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#7B3FE4" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke="#7B3FE4" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
      </AreaChart>
    );
  }
  
  if (type === 'line') {
    return (
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#7B3FE4" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    );
  }
  
  if (type === 'bar') {
    return (
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" fill="#7B3FE4" radius={[4, 4, 0, 0]}>
          {data.map((entry: any, idx: number) => (
            <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    );
  }
  
  // pie / donut
  return (
    <PieChart>
      <Pie
        data={data}
        cx="50%" cy="50%"
        innerRadius={type === 'donut' ? 60 : 0}
        outerRadius={90}
        paddingAngle={2}
        dataKey="value"
        label={(entry: any) => `${entry.name} (${entry.value})`}
        labelLine={false}
      >
        {data.map((entry: any, idx: number) => (
          <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 11 }} />
    </PieChart>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function AddWidgetModal({
  tableId, workspaceId, fields, existingPositions, onClose, onAdded,
}: {
  tableId: string;
  workspaceId: string;
  fields: Field[];
  existingPositions: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const supabase = createClient();
  const [chartType, setChartType] = useState<WidgetType>('bar');
  const [title, setTitle] = useState('');
  const [groupByField, setGroupByField] = useState('');
  const [valueField, setValueField] = useState('');
  const [aggregation, setAggregation] = useState<'sum' | 'avg' | 'min' | 'max' | 'count'>('count');
  const [busy, setBusy] = useState(false);
  
  const groupable = fields.filter(f => 
    ['status', 'select', 'multiselect', 'city', 'user', 'date', 'datetime'].includes(f.type)
  );
  const numeric = fields.filter(f => ['number', 'currency', 'rating'].includes(f.type));
  
  const isTimeseries = chartType === 'line' || chartType === 'area';
  const isDistribution = chartType === 'bar' || chartType === 'pie' || chartType === 'donut';
  const isKpi = chartType === 'kpi';
  
  async function handleAdd() {
    if (!title.trim()) return;
    setBusy(true);
    
    let config: any = { aggregation };
    if (isKpi) {
      if (aggregation !== 'count') config.field_slug = valueField;
    } else if (isTimeseries) {
      config.date_field = groupByField || '__created_at__';
      config.period = 'day';
    } else if (isDistribution) {
      if (!groupByField) { setBusy(false); return; }
      config.group_by = groupByField;
    }
    
    const { error } = await supabase.from('dashboard_widgets').insert({
      table_id: tableId,
      workspace_id: workspaceId,
      type: chartType,
      title: title.trim(),
      config,
      position: existingPositions + 100,
    });
    
    setBusy(false);
    if (!error) onAdded();
    else alert('שגיאה: ' + error.message);
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">הוסף גרף חדש</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">כותרת הגרף</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="לדוגמה: לידים לפי חודש"
              className="input-field"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">סוג גרף</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'kpi', l: 'KPI', icon: TrendingUp },
                { v: 'bar', l: 'עמודות', icon: BarChart3 },
                { v: 'donut', l: 'דונאט', icon: PieIcon },
                { v: 'pie', l: 'פאי', icon: PieIcon },
                { v: 'area', l: 'שטח', icon: Activity },
                { v: 'line', l: 'קו', icon: TrendingUp },
              ].map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setChartType(opt.v as any)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      chartType === opt.v
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{opt.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Field selectors based on type */}
          {isKpi && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">חישוב</label>
                <select
                  value={aggregation}
                  onChange={e => setAggregation(e.target.value as any)}
                  className="input-field"
                >
                  <option value="count">ספירה</option>
                  <option value="sum">סכום</option>
                  <option value="avg">ממוצע</option>
                  <option value="min">מינימום</option>
                  <option value="max">מקסימום</option>
                </select>
              </div>
              {aggregation !== 'count' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">שדה</label>
                  <select
                    value={valueField}
                    onChange={e => setValueField(e.target.value)}
                    className="input-field"
                  >
                    <option value="">בחר שדה...</option>
                    {numeric.map(f => (
                      <option key={f.id} value={f.slug}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          
          {isTimeseries && (
            <div>
              <label className="block text-sm font-medium mb-1.5">שדה תאריך</label>
              <select
                value={groupByField}
                onChange={e => setGroupByField(e.target.value)}
                className="input-field"
              >
                <option value="">תאריך יצירה (ברירת מחדל)</option>
                {fields.filter(f => f.type === 'date' || f.type === 'datetime').map(f => (
                  <option key={f.id} value={f.slug}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {isDistribution && (
            <div>
              <label className="block text-sm font-medium mb-1.5">שדה לקבוצות</label>
              <select
                value={groupByField}
                onChange={e => setGroupByField(e.target.value)}
                className="input-field"
              >
                <option value="">בחר שדה...</option>
                {groupable.map(f => (
                  <option key={f.id} value={f.slug}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary">ביטול</button>
          <button
            onClick={handleAdd}
            disabled={busy || !title.trim() || (isDistribution && !groupByField) || (isKpi && aggregation !== 'count' && !valueField)}
            className="btn-primary"
          >
            {busy ? 'יוצר...' : 'צור גרף'}
          </button>
        </div>
      </div>
    </div>
  );
}
