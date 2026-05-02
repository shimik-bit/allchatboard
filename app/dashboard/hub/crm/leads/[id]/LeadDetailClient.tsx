// app/dashboard/hub/crm/leads/[id]/LeadDetailClient.tsx
// תצוגת ליד מלאה - אינטראקטיבית, עם שינוי סטטוס, שיחות, SMS
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Phone, Mail, MessageSquare, Sparkles, Calendar, User } from 'lucide-react';

const STAGES = [
  { key: 'new', label: 'חדש', color: '#3B82F6' },
  { key: 'contacted', label: 'יצרנו קשר', color: '#8B5CF6' },
  { key: 'qualified', label: 'מוסמך', color: '#F59E0B' },
  { key: 'proposal', label: 'הצעה נשלחה', color: '#FB923C' },
  { key: 'negotiation', label: 'משא ומתן', color: '#EC4899' },
  { key: 'won', label: 'נסגר', color: '#10B981' },
  { key: 'lost', label: 'אבוד', color: '#EF4444' },
];

const SOURCES: Record<string, string> = {
  referral: '🤝 הפניה',
  website: '🌐 אתר',
  google: '🔍 גוגל',
  whatsapp: '💬 וואטסאפ',
  facebook: '📘 פייסבוק',
  instagram: '📷 אינסטגרם',
  cold_call: '📞 שיחת קור',
  other: '➕ אחר',
};

function fmt(n: any): string {
  if (!n) return '₪0';
  const num = Number(n);
  if (num >= 1_000_000) return '₪' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '₪' + Math.round(num / 1_000) + 'K';
  return '₪' + num.toLocaleString('he-IL');
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('he-IL', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit' 
  });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} ד'`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export default function LeadDetailClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lead = data.lead;
  const leadData = lead.data || {};
  const interactions = data.interactions || {};
  const calls = data.calls || [];
  const sms = data.sms || [];
  const whatsapp = data.whatsapp || [];

  const currentStage = STAGES.find(s => s.key === leadData.stage) || STAGES[0];
  const aiScore = parseInt(leadData.ai_score || 0);
  const scoreColor = aiScore >= 80 ? '#EF4444' : aiScore >= 60 ? '#F59E0B' : '#94A3B8';

  // איחוד וסידור היסטוריה
  type HistoryItem = {
    type: 'call' | 'sms' | 'whatsapp';
    icon: string;
    date: string;
    title: string;
    content: string;
    direction?: string;
  };

  const history: HistoryItem[] = [
    ...calls.map((c: any) => ({
      type: 'call' as const, icon: '📞', date: c.datetime,
      title: c.subject || 'שיחת טלפון',
      content: c.summary || '',
      direction: c.direction,
    })),
    ...sms.map((s: any) => ({
      type: 'sms' as const, icon: '💬', date: s.sent_at,
      title: s.direction === 'outbound' ? 'SMS יוצא' : 'SMS נכנס',
      content: s.message,
      direction: s.direction,
    })),
    ...whatsapp.map((w: any) => ({
      type: 'whatsapp' as const, icon: '🟢', date: w.received_at,
      title: 'WhatsApp',
      content: w.text,
      direction: w.direction,
    })),
  ].filter(h => h.date).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  async function handleStageChange(newStage: string) {
    if (newStage === leadData.stage || updating) return;
    
    setUpdating(true);
    setError(null);

    // עדכון אופטימי
    const oldData = { ...data };
    setData({
      ...data,
      lead: { ...lead, data: { ...leadData, stage: newStage } }
    });

    try {
      const res = await fetch('/api/crm/lead-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, new_stage: newStage }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setData(oldData);
        setError(result.error || 'עדכון נכשל');
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      setData(oldData);
      setError('שגיאת רשת');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <Link
            href="/dashboard/hub/crm/kanban"
            className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>חזרה לקנבן</span>
          </Link>
          <span className="text-xs text-gray-500">
            עודכן {timeAgo(lead.updated_at)}
          </span>
        </header>

        {/* Error toast */}
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
            ❌ {error}
          </div>
        )}

        {/* Lead Title & Stage */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border mb-4">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {leadData.title || 'ללא כותרת'}
              </h1>
              <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
                {leadData.contact_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {leadData.contact_name}
                  </span>
                )}
                {leadData.source && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                    {SOURCES[leadData.source] || leadData.source}
                  </span>
                )}
              </div>
            </div>
            <div className="text-left">
              <div className="text-3xl font-bold text-gray-900">{fmt(leadData.value)}</div>
              <div className="text-xs text-gray-500">ערך הזדמנות</div>
            </div>
          </div>

          {/* Contact Info */}
          {(leadData.phone || leadData.email) && (
            <div className="flex gap-2 flex-wrap pt-3 border-t border-gray-100">
              {leadData.phone && (
                <a 
                  href={`tel:${leadData.phone}`}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
                >
                  <Phone className="w-4 h-4" />
                  {leadData.phone}
                </a>
              )}
              {leadData.phone && (
                <a 
                  href={`https://wa.me/972${leadData.phone.replace(/^0/, '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {leadData.email && (
                <a 
                  href={`mailto:${leadData.email}`}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
                >
                  <Mail className="w-4 h-4" />
                  {leadData.email}
                </a>
              )}
            </div>
          )}

          {/* Stage Selector */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">שלב נוכחי - לחץ לשינוי:</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map(s => (
                <button
                  key={s.key}
                  onClick={() => handleStageChange(s.key)}
                  disabled={updating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    s.key === leadData.stage
                      ? 'text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${updating ? 'opacity-50 cursor-wait' : ''}`}
                  style={s.key === leadData.stage ? { backgroundColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <div className="text-2xl font-bold" style={{ color: scoreColor }}>{aiScore}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" /> ציון AI
            </div>
            {leadData.ai_score_reason && (
              <div className="text-[10px] text-gray-400 mt-1 truncate" title={leadData.ai_score_reason}>
                {leadData.ai_score_reason}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <div className="text-2xl font-bold text-purple-600">{interactions.total || 0}</div>
            <div className="text-xs text-gray-500 mt-1">אינטראקציות</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <div className="text-2xl font-bold text-cyan-600">{calls.length}</div>
            <div className="text-xs text-gray-500 mt-1">📞 שיחות</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">{sms.length + whatsapp.length}</div>
            <div className="text-xs text-gray-500 mt-1">💬 הודעות</div>
          </div>
        </div>

        {/* Notes */}
        {leadData.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <div className="text-xs font-medium text-yellow-800 mb-1">📌 הערות</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{leadData.notes}</p>
          </div>
        )}

        {/* History Timeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            ציר זמן ({history.length})
          </h3>
          
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm">אין אינטראקציות עם הליד עדיין</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item, idx) => {
                const isOut = item.direction === 'outbound';
                return (
                  <div key={idx} className="flex gap-3 relative">
                    {idx < history.length - 1 && (
                      <div className="absolute right-5 top-10 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg flex-shrink-0 z-10">
                      {item.icon}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {item.title}
                          {item.direction && (
                            <span className="text-xs text-gray-500 mr-2">
                              {isOut ? '↗ יוצא' : '↙ נכנס'}
                            </span>
                          )}
                        </h4>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {fmtDate(item.date)}
                        </span>
                      </div>
                      {item.content && (
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                          {item.type === 'call' ? `"${item.content}"` : item.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
