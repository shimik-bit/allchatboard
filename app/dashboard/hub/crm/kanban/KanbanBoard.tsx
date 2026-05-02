// app/dashboard/hub/crm/kanban/KanbanBoard.tsx
// קנבן לידים אינטראקטיבי עם drag-and-drop
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Phone, MessageSquare, Sparkles } from 'lucide-react';

// ============ Types ============
interface Lead {
  id: string;
  data: any;
  updated_at: string;
}

interface Stage {
  key: string;
  label: string;
  color: string;
  bg: string;
}

const STAGES: Stage[] = [
  { key: 'new', label: 'חדש', color: '#3B82F6', bg: 'bg-blue-50 border-blue-200' },
  { key: 'contacted', label: 'יצרנו קשר', color: '#8B5CF6', bg: 'bg-purple-50 border-purple-200' },
  { key: 'qualified', label: 'מוסמך', color: '#F59E0B', bg: 'bg-amber-50 border-amber-200' },
  { key: 'proposal', label: 'הצעה נשלחה', color: '#FB923C', bg: 'bg-orange-50 border-orange-200' },
  { key: 'negotiation', label: 'משא ומתן', color: '#EC4899', bg: 'bg-pink-50 border-pink-200' },
  { key: 'won', label: 'נסגר', color: '#10B981', bg: 'bg-green-50 border-green-200' },
  { key: 'lost', label: 'אבוד', color: '#EF4444', bg: 'bg-red-50 border-red-200' },
];

function fmt(n: any): string {
  if (!n) return '₪0';
  const num = Number(n);
  if (num >= 1_000_000) return '₪' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '₪' + Math.round(num / 1_000) + 'K';
  return '₪' + num.toLocaleString('he-IL');
}

// ============ Card Component ============
function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const data = lead.data || {};
  const aiScore = parseInt(data.ai_score || 0);
  const scoreColor = aiScore >= 80 ? '#EF4444' : aiScore >= 60 ? '#F59E0B' : '#94A3B8';

  return (
    <div className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 ${isDragging ? 'shadow-xl rotate-2' : 'hover:shadow-md'} transition-all cursor-grab active:cursor-grabbing`}>
      <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">
        {data.title || 'ללא כותרת'}
      </h4>
      
      {data.contact_name && (
        <p className="text-xs text-gray-600 mb-2">
          👤 {data.contact_name}
        </p>
      )}
      
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-gray-900">{fmt(data.value)}</span>
        {aiScore > 0 && (
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" style={{ color: scoreColor }} />
            <span className="font-bold" style={{ color: scoreColor }}>{aiScore}</span>
          </div>
        )}
      </div>
      
      {(data.phone || data.source) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          {data.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {data.phone}
            </span>
          )}
          {data.source && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded mr-auto">{data.source}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Sortable Card ============
function SortableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: lead.id,
    data: { type: 'lead', lead }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} />
    </div>
  );
}

// ============ Column Component ============
function KanbanColumn({ stage, leads }: { stage: Stage; leads: Lead[] }) {
  const totalValue = leads.reduce((s, l) => s + Number(l.data?.value || 0), 0);

  const { setNodeRef } = useSortable({ 
    id: `column-${stage.key}`,
    data: { type: 'column', stage: stage.key }
  });

  return (
    <div className="flex-shrink-0 w-72 md:w-80">
      <div className={`rounded-xl border-2 ${stage.bg} p-3 h-full min-h-[400px]`}>
        
        {/* Header */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-bold text-sm text-gray-900">{stage.label}</h3>
            </div>
            <span 
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: stage.color }}
            >
              {leads.length}
            </span>
          </div>
          {totalValue > 0 && (
            <p className="text-xs text-gray-500">סה"כ: {fmt(totalValue)}</p>
          )}
        </div>

        {/* Cards */}
        <div ref={setNodeRef} className="space-y-2 min-h-[100px]">
          <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-8 border-2 border-dashed border-gray-200 rounded-lg">
                אין לידים בשלב זה
                <div className="text-[10px] mt-1">גרור לכאן</div>
              </div>
            ) : (
              leads.map(lead => (
                <SortableLeadCard key={lead.id} lead={lead} />
              ))
            )}
          </SortableContext>
        </div>

      </div>
    </div>
  );
}

// ============ Main Board ============
export default function KanbanBoard({ 
  initialLeads, 
  hasLeadsTable 
}: { 
  initialLeads: Lead[]; 
  hasLeadsTable: boolean;
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Sensors - תמיכה בעכבר, מגע, ומקלדת
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // קיבוץ לידים לפי stage
  const leadsByStage: Record<string, Lead[]> = {};
  STAGES.forEach(s => { leadsByStage[s.key] = []; });
  leads.forEach(lead => {
    const stage = lead.data?.stage || 'new';
    if (leadsByStage[stage]) {
      leadsByStage[stage].push(lead);
    } else {
      leadsByStage.new.push(lead); // fallback
    }
  });

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find(l => l.id === event.active.id);
    if (lead) setActiveLead(lead);
    setUpdateError(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    
    const { active, over } = event;
    if (!over) return;

    const draggedLead = leads.find(l => l.id === active.id);
    if (!draggedLead) return;

    // מציאת שלב היעד
    let newStage: string | null = null;
    
    // אם נגררנו על עמודה ריקה
    if (typeof over.id === 'string' && over.id.startsWith('column-')) {
      newStage = over.id.replace('column-', '');
    } else {
      // נגררנו על כרטיס - מוצאים את השלב של הכרטיס היעד
      const overLead = leads.find(l => l.id === over.id);
      if (overLead) {
        newStage = overLead.data?.stage || 'new';
      }
    }

    if (!newStage) return;
    if (newStage === draggedLead.data?.stage) return; // אין שינוי

    // 1. עדכון אופטימי ב-UI מיד
    const updatedLeads = leads.map(l => 
      l.id === draggedLead.id 
        ? { ...l, data: { ...l.data, stage: newStage } }
        : l
    );
    setLeads(updatedLeads);

    // 2. שולחים ל-server
    try {
      const response = await fetch('/api/crm/lead-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: draggedLead.id,
          new_stage: newStage,
        }),
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        // החזר חזרה אם נכשל
        setLeads(leads);
        setUpdateError(result.error || 'עדכון נכשל');
        setTimeout(() => setUpdateError(null), 3000);
      }
    } catch (err) {
      setLeads(leads);
      setUpdateError('שגיאת רשת - נסה שוב');
      setTimeout(() => setUpdateError(null), 3000);
    }
  }

  // אם אין טבלת לידים בכלל
  if (!hasLeadsTable) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-md shadow-sm border text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">CRM Pack לא מותקן</h2>
          <p className="text-gray-600 mb-6">
            עדיין לא התקנת את חבילת ה-CRM ב-workspace הזה.
          </p>
          <Link
            href="/dashboard/hub"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            חזרה ל-Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir="rtl">
      
      {/* Header */}
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
          >🎯</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">קנבן לידים</h1>
            <p className="text-sm text-gray-500">גרור כרטיסים בין שלבים כדי לעדכן סטטוס</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/dashboard/hub/crm" 
            className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>חזרה ל-CRM</span>
          </Link>
        </div>
      </header>

      {/* Error toast */}
      {updateError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          ❌ {updateError}
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STAGES.filter(s => s.key !== 'lost').slice(0, 6).map(stage => {
          const count = leadsByStage[stage.key]?.length || 0;
          if (count === 0) return null;
          return (
            <div 
              key={stage.key}
              className="bg-white rounded-lg px-3 py-1.5 border text-xs flex items-center gap-2"
              style={{ borderColor: stage.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="text-gray-700">{stage.label}: <strong>{count}</strong></span>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין לידים עדיין</h2>
          <p className="text-gray-500 mb-6">הוסף ליד ראשון כדי להתחיל</p>
        </div>
      ) : (
        /* Kanban Board */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollSnapType: 'x mandatory' }}>
            <SortableContext items={STAGES.map(s => `column-${s.key}`)}>
              {STAGES.map(stage => (
                <div key={stage.key} style={{ scrollSnapAlign: 'start' }}>
                  <KanbanColumn 
                    stage={stage} 
                    leads={leadsByStage[stage.key] || []} 
                  />
                </div>
              ))}
            </SortableContext>
          </div>

          <DragOverlay>
            {activeLead && <LeadCard lead={activeLead} isDragging={true} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Mobile hint */}
      <div className="md:hidden mt-4 text-xs text-gray-500 text-center">
        💡 החזק לחיצה על כרטיס למשך שניה לפני גרירה
      </div>

    </div>
  );
}
