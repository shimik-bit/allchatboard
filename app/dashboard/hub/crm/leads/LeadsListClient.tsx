// app/dashboard/hub/crm/leads/LeadsListClient.tsx
//
// Interactive leads list. All filtering / sorting is client-side; the server
// gives us up to 500 rows from v_lead_360 ordered by recency. That's plenty
// for the foreseeable scale and avoids a server round-trip on every keystroke.
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Phone, MessageSquare, Sparkles, ArrowRight, Plus,
  ArrowUpDown, ChevronDown, X, Filter,
} from 'lucide-react';
import AddLeadModal from '../AddLeadModal';

interface LeadRow {
  workspace_id: string;
  lead_id: string;
  lead_title: string | null;
  contact_name: string | null;
  phone: string | null;
  stage: string | null;
  value: number | null;
  ai_score: number | null;
  lead_created_at: string;
  lead_updated_at: string;
  calls_count: number | null;
  calls_inbound: number | null;
  calls_outbound: number | null;
  last_call_at: string | null;
  calls_duration_seconds: number | null;
}

const STAGES = [
  { key: 'new', label: 'חדש', color: '#3B82F6', bg: 'bg-blue-100', text: 'text-blue-800' },
  { key: 'contacted', label: 'יצרנו קשר', color: '#8B5CF6', bg: 'bg-purple-100', text: 'text-purple-800' },
  { key: 'qualified', label: 'מוסמך', color: '#F59E0B', bg: 'bg-amber-100', text: 'text-amber-800' },
  { key: 'proposal', label: 'הצעה', color: '#FB923C', bg: 'bg-orange-100', text: 'text-orange-800' },
  { key: 'negotiation', label: 'משא ומתן', color: '#EC4899', bg: 'bg-pink-100', text: 'text-pink-800' },
  { key: 'won', label: 'נסגר', color: '#10B981', bg: 'bg-green-100', text: 'text-green-800' },
  { key: 'lost', label: 'אבוד', color: '#EF4444', bg: 'bg-red-100', text: 'text-red-800' },
];

type SortKey = 'recent' | 'value_desc' | 'score_desc' | 'oldest' | 'no_contact';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'עודכן לאחרונה' },
  { key: 'value_desc', label: 'ערך — גבוה לנמוך' },
  { key: 'score_desc', label: 'ציון AI — גבוה לנמוך' },
  { key: 'no_contact', label: 'הכי הרבה זמן ללא מגע' },
  { key: 'oldest', label: 'ישנים ביותר' },
];

function fmt(n: any): string {
  if (n === null || n === undefined || n === '') return '₪0';
  const num = Number(n);
  if (!isFinite(num)) return '₪0';
  if (num >= 1_000_000) return '₪' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '₪' + Math.round(num / 1_000) + 'K';
  return '₪' + num.toLocaleString('he-IL');
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'עכשיו';
    if (m < 60) return `${m}ד׳`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}שע׳`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}י׳`;
    const months = Math.floor(d / 30);
    return `${months}ח׳`;
  } catch {
    return '—';
  }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function normalizePhoneForWa(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

export default function LeadsListClient({
  initialLeads,
  workspaceId,
}: {
  initialLeads: LeadRow[];
  workspaceId: string;
}) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [search, setSearch] = useState('');
  const [activeStages, setActiveStages] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Counts per stage (computed from the unfiltered list so the chips reflect
  // the full pipeline, not the current view).
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) {
      const k = l.stage || 'new';
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const totalValue = useMemo(
    () => leads.reduce((s, l) => s + Number(l.value || 0), 0),
    [leads]
  );

  // Active filtering + sorting
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = leads.filter(l => {
      if (activeStages.size > 0 && !activeStages.has(l.stage || 'new')) return false;
      if (q) {
        const hay = [l.lead_title, l.contact_name, l.phone].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'recent':
          return new Date(b.lead_updated_at).getTime() - new Date(a.lead_updated_at).getTime();
        case 'oldest':
          return new Date(a.lead_created_at).getTime() - new Date(b.lead_created_at).getTime();
        case 'value_desc':
          return Number(b.value || 0) - Number(a.value || 0);
        case 'score_desc':
          return Number(b.ai_score || 0) - Number(a.ai_score || 0);
        case 'no_contact': {
          const aD = daysSince(a.last_call_at) ?? 9999;
          const bD = daysSince(b.last_call_at) ?? 9999;
          return bD - aD;
        }
      }
    });

    return out;
  }, [leads, search, activeStages, sortKey]);

  function toggleStage(key: string) {
    const next = new Set(activeStages);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActiveStages(next);
  }

  function clearFilters() {
    setActiveStages(new Set());
    setSearch('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">

        {/* === Header === */}
        <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
            >
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">כל הלידים</h1>
              <p className="text-sm text-gray-500">
                {leads.length} לידים · ערך כולל {fmt(totalValue)}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>ליד חדש</span>
            </button>
            <Link
              href="/dashboard/hub/crm/kanban"
              className="text-sm bg-white px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              🎯 קנבן
            </Link>
            <Link
              href="/dashboard/hub/crm"
              className="text-sm bg-white px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              דשבורד
            </Link>
          </div>
        </header>

        {/* === Search bar === */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border mb-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם, טלפון, או כותרת…"
                className="w-full pr-9 pl-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 ${
                showFilters || activeStages.size > 0
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden md:inline">סינון</span>
              {activeStages.size > 0 && (
                <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeStages.size}
                </span>
              )}
            </button>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="px-3 py-2.5 border rounded-lg text-sm bg-white"
              title="מיון"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Stage filter chips */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">סנן לפי שלב:</span>
                {(activeStages.size > 0 || search) && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-purple-600 hover:text-purple-800 mr-auto"
                  >
                    נקה הכל
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map(s => {
                  const isActive = activeStages.has(s.key);
                  const cnt = stageCounts[s.key] || 0;
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleStage(s.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                        isActive
                          ? 'text-white shadow-sm'
                          : `${s.bg} ${s.text} hover:opacity-80`
                      }`}
                      style={isActive ? { backgroundColor: s.color } : {}}
                    >
                      <span>{s.label}</span>
                      <span className={`text-[10px] ${isActive ? 'bg-white/30' : 'bg-white'} px-1.5 rounded-full`}>
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* === Result count === */}
        {(search || activeStages.size > 0) && (
          <div className="text-sm text-gray-600 mb-2 px-1">
            {filtered.length === 0 ? 'אין תוצאות' : `${filtered.length} תוצאות מתוך ${leads.length}`}
          </div>
        )}

        {/* === Empty state === */}
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">אין לידים עדיין</h2>
            <p className="text-gray-500 mb-6">צור ליד ראשון כדי להתחיל</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + ליד חדש
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-700 font-medium mb-1">לא נמצאו לידים</p>
            <p className="text-sm text-gray-500 mb-4">נסה לבטל סינון או לחפש מילה אחרת</p>
            <button
              onClick={clearFilters}
              className="text-sm text-purple-600 hover:text-purple-800"
            >
              נקה את כל הסינונים
            </button>
          </div>
        ) : (
          /* === Results list === */
          <div className="space-y-2">
            {filtered.map(l => (
              <LeadRowCard key={l.lead_id} lead={l} />
            ))}
          </div>
        )}

      </div>

      {/* Add lead modal */}
      <AddLeadModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(newLead: any) => {
          // The modal returns a record-shape; project it into v_lead_360 shape
          // so the new lead shows immediately at the top of the list. Counts
          // start at 0 — they'll fill on next page load.
          const projected: LeadRow = {
            workspace_id: workspaceId,
            lead_id: newLead.id,
            lead_title: newLead.data?.title || null,
            contact_name: newLead.data?.contact_name || newLead.data?.customer_name || null,
            phone: newLead.data?.phone || null,
            stage: newLead.data?.stage || 'new',
            value: Number(newLead.data?.value || newLead.data?.estimated_value || 0),
            ai_score: Number(newLead.data?.ai_score || 0),
            lead_created_at: newLead.created_at || new Date().toISOString(),
            lead_updated_at: newLead.updated_at || new Date().toISOString(),
            calls_count: 0,
            calls_inbound: 0,
            calls_outbound: 0,
            last_call_at: null,
            calls_duration_seconds: 0,
          };
          setLeads([projected, ...leads]);
          setShowAddModal(false);
        }}
        defaultStage="new"
      />
    </div>
  );
}

// ============ Row Card ============
function LeadRowCard({ lead }: { lead: LeadRow }) {
  const stage = STAGES.find(s => s.key === lead.stage) || STAGES[0];
  const score = Number(lead.ai_score || 0);
  const scoreColor = score >= 80 ? 'text-red-600' : score >= 60 ? 'text-orange-600' : score >= 40 ? 'text-blue-600' : 'text-gray-400';

  const days = daysSince(lead.last_call_at);
  const showStaleWarning = days !== null && days > 5 && !['won', 'lost'].includes(lead.stage || '');

  const phoneClean = lead.phone ? lead.phone.trim() : '';
  const hasPhone = phoneClean.length > 0;

  // Avoid the row becoming a focusable button on mobile keyboards.
  return (
    <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition overflow-hidden">
      <Link
        href={`/dashboard/hub/crm/leads/${lead.lead_id}`}
        className="block p-3 md:p-4 hover:bg-gray-50/50"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-gray-900 break-words">
                {lead.lead_title || lead.contact_name || 'ליד ללא כותרת'}
              </h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.bg} ${stage.text}`}
              >
                {stage.label}
              </span>
              {showStaleWarning && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                  ⏰ {days} ימים ללא מגע
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {lead.contact_name && lead.contact_name !== lead.lead_title && (
                <span>👤 {lead.contact_name}</span>
              )}
              {hasPhone && <span dir="ltr">📞 {phoneClean}</span>}
              <span>📅 עודכן {timeAgo(lead.lead_updated_at)}</span>
              {(lead.calls_count || 0) > 0 && (
                <span>📞 {lead.calls_count} שיחות</span>
              )}
            </div>
          </div>

          {/* Right side: value + score */}
          <div className="text-left flex-shrink-0">
            <div className="text-lg font-bold text-gray-900">{fmt(lead.value)}</div>
            {score > 0 && (
              <div className={`text-xs flex items-center gap-1 justify-end ${scoreColor} font-bold`}>
                <Sparkles className="w-3 h-3" />
                {score}/100
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Quick action footer (NOT inside the Link, so taps don't navigate) */}
      {hasPhone && (
        <div className="border-t border-gray-100 px-3 py-2 flex gap-2 bg-gray-50/50">
          <a
            href={`tel:${phoneClean}`}
            onClick={e => e.stopPropagation()}
            className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 flex items-center gap-1"
          >
            <Phone className="w-3 h-3" />
            התקשר
          </a>
          <a
            href={`https://wa.me/${normalizePhoneForWa(phoneClean)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded-md hover:bg-green-100 flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            WhatsApp
          </a>
          <Link
            href={`/dashboard/hub/crm/leads/${lead.lead_id}`}
            className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 flex items-center gap-1 mr-auto"
          >
            פתח תיק לקוח
            <ArrowRight className="w-3 h-3 rotate-180" />
          </Link>
        </div>
      )}
    </div>
  );
}
