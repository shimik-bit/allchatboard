// app/dashboard/inbox/insights/InsightsClient.tsx
// אנליטיקה מלאה ל-Inbox + המרת לקוחות לקווים ב-CRM
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Inbox, ArrowRight, TrendingUp, Clock, AlertTriangle, 
  CheckCircle, Users, UserPlus, Sparkles, BarChart3 
} from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  customer_request: '🙋 בקשת לקוח',
  ai_uncertain: '🤖 AI לא בטוח',
  complaint: '😡 תלונה',
  payment: '💰 תשלום',
  technical: '🔧 טכני',
  other: '📋 אחר',
  human_handoff: '👤 העברה לאדם',
  bot_failed: '⚠️ בוט נכשל',
};

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}ש'`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} שעות`;
  const days = Math.round(hours / 24);
  return `${days} ימים`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

function timeAgo(d: string): string {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} ד'`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע'`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
}

export default function InsightsClient({
  kpis,
  byReason,
  topCustomers,
  dailyStats,
}: {
  kpis: any;
  byReason: any[];
  topCustomers: any[];
  dailyStats: any[];
}) {
  const [convertingPhone, setConvertingPhone] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Handler להמרת לקוח לליד CRM
  // (משתמש ב-convert-to-lead שמקבל escalation_id)
  // אנחנו צריכים escalation מסוים, אז שולפים את האחרון של אותו טלפון
  async function handleConvertToLead(phone: string) {
    if (convertingPhone) return;
    setConvertingPhone(phone);
    setToast(null);

    try {
      // קודם שולפים escalation אחרון של הלקוח דרך API
      const escRes = await fetch(`/api/inbox/find-escalation?phone=${encodeURIComponent(phone)}`);
      const escResult = await escRes.json();
      
      if (!escRes.ok || !escResult.escalation_id) {
        setToast({ msg: 'לא נמצא escalation להמרה', type: 'err' });
        return;
      }

      // עכשיו ממירים
      const res = await fetch('/api/inbox/convert-to-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalation_id: escResult.escalation_id }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setToast({ 
          msg: result.error || 'המרה נכשלה', 
          type: 'err' 
        });
        return;
      }

      setToast({
        msg: result.already_exists ? '✅ הליד כבר קיים ב-CRM' : '🎉 ליד נוצר בהצלחה!',
        type: 'ok',
      });

      // הפניה לדף הליד אחרי שנייה
      setTimeout(() => {
        window.location.href = `/dashboard/hub/crm/leads/${result.lead_id}`;
      }, 1500);

    } catch (err) {
      setToast({ msg: 'שגיאת רשת', type: 'err' });
    } finally {
      setTimeout(() => {
        setConvertingPhone(null);
        setToast(null);
      }, 3000);
    }
  }

  // חישוב גרף יומי
  const maxDaily = Math.max(...dailyStats.map((d: any) => Number(d.new_escalations) || 0), 1);
  const dailyReversed = [...dailyStats].reverse().slice(-14); // 14 ימים אחרונים

  // חישוב סה"כ מ-byReason לאחוזים
  const totalByReason = byReason.reduce((s: number, r: any) => s + Number(r.count), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${
            toast.type === 'ok' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">תובנות Inbox</h1>
              <p className="text-sm text-gray-500">אנליטיקה מלאה והמרה ל-CRM</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/dashboard/inbox"
              className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Inbox className="w-4 h-4" />
              <span>חזרה ל-Inbox</span>
            </Link>
          </div>
        </header>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard 
            icon={<AlertTriangle className="w-5 h-5" />} 
            color="#EF4444" 
            value={kpis.urgent_active || 0} 
            label="פניות דחופות פעילות" 
          />
          <KPICard 
            icon={<Inbox className="w-5 h-5" />} 
            color="#3B82F6" 
            value={kpis.open_count || 0} 
            label="פניות פתוחות" 
          />
          <KPICard 
            icon={<Clock className="w-5 h-5" />} 
            color="#F59E0B" 
            value={fmtDuration(kpis.avg_response_seconds)} 
            label="זמן תגובה ממוצע" 
          />
          <KPICard 
            icon={<CheckCircle className="w-5 h-5" />} 
            color="#10B981" 
            value={`${kpis.resolution_rate_percent || 0}%`} 
            label="אחוז פתרון" 
            sub={`${kpis.resolved_count || 0} נפתרו מתוך ${kpis.total_escalations || 0}`}
          />
        </div>

        {/* Recent Activity Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-xs text-gray-500 mb-1">24 שעות אחרונות</div>
            <div className="text-2xl font-bold text-gray-900">{kpis.last_24h || 0}</div>
            <div className="text-xs text-gray-400 mt-1">פניות חדשות</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-xs text-gray-500 mb-1">7 ימים אחרונים</div>
            <div className="text-2xl font-bold text-gray-900">{kpis.last_7d || 0}</div>
            <div className="text-xs text-gray-400 mt-1">פניות חדשות</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-xs text-gray-500 mb-1">זמן פתרון ממוצע</div>
            <div className="text-2xl font-bold text-gray-900">{fmtDuration(kpis.avg_resolution_seconds)}</div>
            <div className="text-xs text-gray-400 mt-1">מפתיחה לסגירה</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          
          {/* Daily Trend */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              מגמה - 14 ימים אחרונים
            </h3>
            
            {dailyReversed.length === 0 ? (
              <div className="text-center text-gray-400 py-8">אין נתונים</div>
            ) : (
              <div className="flex items-end gap-1 h-32" dir="ltr">
                {dailyReversed.map((d: any, idx: number) => {
                  const count = Number(d.new_escalations) || 0;
                  const urgent = Number(d.urgent_count) || 0;
                  const height = (count / maxDaily) * 100;
                  const urgentHeight = count > 0 ? (urgent / count) * height : 0;
                  return (
                    <div 
                      key={idx} 
                      className="flex-1 flex flex-col items-center gap-1 group relative"
                      title={`${fmtDate(d.day)}: ${count} פניות${urgent > 0 ? `, ${urgent} דחופות` : ''}`}
                    >
                      <div className="w-full bg-blue-100 rounded-t flex flex-col-reverse" style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}>
                        {urgent > 0 && (
                          <div className="bg-red-500 rounded-t" style={{ height: `${(urgent / count) * 100}%`, minHeight: '2px' }} />
                        )}
                        <div className="bg-blue-500 rounded-t flex-1" />
                      </div>
                      <div className="text-[9px] text-gray-400">{fmtDate(d.day)}</div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex gap-3 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded" />
                <span className="text-gray-600">פניות רגילות</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded" />
                <span className="text-gray-600">דחופות</span>
              </div>
            </div>
          </div>

          {/* By Reason */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              פילוח לפי סיבה
            </h3>
            
            {byReason.length === 0 ? (
              <div className="text-center text-gray-400 py-8">אין נתונים</div>
            ) : (
              <div className="space-y-2">
                {byReason.slice(0, 6).map((r: any) => {
                  const pct = totalByReason > 0 ? (Number(r.count) / totalByReason) * 100 : 0;
                  return (
                    <div key={r.reason}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700">{REASON_LABELS[r.reason] || r.reason}</span>
                        <span className="font-bold text-gray-900">{r.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            לקוחות עם הכי הרבה פניות
          </h3>
          
          {topCustomers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">אין נתונים</div>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c: any) => (
                <div 
                  key={c.source_phone}
                  className="flex items-center gap-3 p-3 bg-gradient-to-l from-blue-50 to-white rounded-lg border border-blue-100"
                >
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {c.source_phone?.slice(-2) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {c.source_phone}
                      {c.is_lead && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded mr-2">
                          ✓ ליד ב-CRM
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.escalations_count} פניות
                      {c.urgent_count > 0 && <span className="text-red-600 mr-2">· {c.urgent_count} דחופות</span>}
                      {c.active_count > 0 && <span className="text-amber-600 mr-2">· {c.active_count} פתוחות</span>}
                      <span className="mr-2">· {timeAgo(c.last_escalation_at)}</span>
                    </div>
                  </div>
                  
                  {/* Convert to Lead button */}
                  {!c.is_lead ? (
                    <button
                      onClick={() => handleConvertToLead(c.source_phone)}
                      disabled={convertingPhone === c.source_phone}
                      className="text-xs px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center gap-1 whitespace-nowrap"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {convertingPhone === c.source_phone ? 'מעביר...' : 'הפוך לליד'}
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/hub/crm/kanban`}
                      className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1 whitespace-nowrap"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      ל-CRM
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function KPICard({ icon, color, value, label, sub }: { 
  icon: React.ReactNode; 
  color: string; 
  value: any; 
  label: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white mb-3"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
