'use client';

/**
 * Full view of a single diagnostic submission.
 *
 * Layout (mobile-first, two-column at lg+):
 *   - Main column: business details, financial X-ray, tech & ops, summary
 *   - Side column: status, contact card, internal notes, danger zone
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Cog,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Save,
  Stethoscope,
  Target,
  Trash2,
  User,
} from 'lucide-react';

type Submission = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  is_complete: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;

  company_name: string | null;
  company_id: string | null;
  years_in_industry: string | null;
  team_size: string | null;
  annual_revenue: string | null;
  active_projects: string | null;
  activity_type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;

  q_cashflow_tracking: string | null;
  q_payment_terms: string | null;
  q_payment_followup: string | null;
  q_project_profitability: string | null;
  q_credit_lines: string | null;
  q_known_exposures: string | null;
  q_insurance: string | null;
  q_litigation_exposure: string | null;
  q_prevention_system: string | null;
  q_legal_coverage: string | null;
  q_financial_health_score: number | null;

  q_software_used: string | null;
  q_quote_time: string | null;
  q_field_reporting: string | null;
  q_document_storage: string | null;
  q_manual_processes: string | null;
  q_morning_dashboard: string | null;
  q_people_dependency: number | null;
  q_first_delegate: string | null;

  q_top_three_priorities: string | null;
  q_urgency: number | null;
  q_budget: string | null;
  q_when_to_start: string | null;

  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  residential: 'מגורים',
  commercial: 'מסחרי',
  infrastructure: 'תשתיות',
  renovation: 'שיפוצים',
  mixed: 'מגוון',
};

const WHEN_LABELS: Record<string, string> = {
  immediately: 'מיידית',
  this_month: 'החודש',
  next_month: 'בחודש הבא',
  this_quarter: 'ברבעון הקרוב',
  exploring: 'בבחינה',
};

export default function DiagnosticDetailClient({
  submission: initial,
}: {
  submission: Submission;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isTogglingReview, setIsTogglingReview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const notesChanged = notes !== (s.notes ?? '');

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/diagnostic/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const data = await res.json();
        setS(data.submission);
      } else {
        alert('שמירה נכשלה.');
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleToggleReview = async () => {
    setIsTogglingReview(true);
    try {
      const body = s.reviewed_at ? { unmark_reviewed: true } : { mark_reviewed: true };
      const res = await fetch(`/api/admin/diagnostic/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setS(data.submission);
      }
    } finally {
      setIsTogglingReview(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('למחוק הגשה זו לצמיתות?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/diagnostic/${s.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/diagnostic');
      } else {
        alert('מחיקה נכשלה.');
        setIsDeleting(false);
      }
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back link */}
        <Link
          href="/admin/diagnostic"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לרשימה
        </Link>

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">
                {s.company_name || 'ללא שם חברה'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
                {s.company_id && <span>ח.פ. {s.company_id}</span>}
                {s.activity_type && (
                  <span>· {ACTIVITY_TYPE_LABELS[s.activity_type] ?? s.activity_type}</span>
                )}
                {(s.submitted_at || s.created_at) && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(s.submitted_at ?? s.created_at).toLocaleString('he-IL')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!s.is_complete && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                  <Clock className="w-3 h-3" />
                  טיוטה לא הוגשה
                </span>
              )}
              {s.is_complete && (
                <button
                  onClick={handleToggleReview}
                  disabled={isTogglingReview}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
                    s.reviewed_at
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {isTogglingReview ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : s.reviewed_at ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      נבדק · בטל
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      סמן כנבדק
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business details */}
            <Card icon={<Building2 className="w-4 h-4" />} title="פרטי העסק">
              <KvGrid
                items={[
                  ['ותק בענף', s.years_in_industry],
                  ['מס׳ עובדים', s.team_size],
                  ['מחזור שנתי', s.annual_revenue],
                  ['פרויקטים פעילים', s.active_projects],
                ]}
              />
            </Card>

            {/* Financial X-ray */}
            <Card icon={<Stethoscope className="w-4 h-4" />} title="רנטגן פיננסי">
              {s.q_financial_health_score != null && (
                <ScoreBar
                  label="דירוג בריאות פיננסית"
                  value={s.q_financial_health_score}
                  scale="health"
                />
              )}
              <QaList
                items={[
                  ['מעקב תזרים', s.q_cashflow_tracking],
                  ['תנאי תשלום', s.q_payment_terms],
                  ['מעקב תשלומים', s.q_payment_followup],
                  ['רווחיות פרויקטים', s.q_project_profitability],
                  ['מסגרות אשראי', s.q_credit_lines],
                  ['חשיפות ידועות', s.q_known_exposures],
                  ['ביטוחים', s.q_insurance],
                  ['חשיפה לתביעות', s.q_litigation_exposure],
                  ['מערכת מניעת תביעות', s.q_prevention_system],
                  ['כיסוי משפטי', s.q_legal_coverage],
                ]}
              />
            </Card>

            {/* Tech & operations */}
            <Card icon={<Cog className="w-4 h-4" />} title="סיסטם עבודה טכנולוגי">
              {s.q_people_dependency != null && (
                <ScoreBar
                  label="תלות באנשים ספציפיים"
                  value={s.q_people_dependency}
                  scale="dependency"
                />
              )}
              <QaList
                items={[
                  ['תוכנות בשימוש', s.q_software_used],
                  ['זמן הצעת מחיר', s.q_quote_time],
                  ['דיווחי שטח', s.q_field_reporting],
                  ['אחסון מסמכים', s.q_document_storage],
                  ['תהליכים ידניים', s.q_manual_processes],
                  ['דאשבורד בוקר', s.q_morning_dashboard],
                  ['ראשון להעביר לעוזר', s.q_first_delegate],
                ]}
              />
            </Card>

            {/* Summary / action */}
            <Card icon={<Target className="w-4 h-4" />} title="סיכום ופעולה">
              {s.q_urgency != null && (
                <ScoreBar label="רמת דחיפות" value={s.q_urgency} scale="urgency" />
              )}
              <QaList
                items={[
                  ['3 דברים לטפל בהם מיד', s.q_top_three_priorities],
                  ['תקציב משוער', s.q_budget],
                  ['מתי להתחיל', s.q_when_to_start ? WHEN_LABELS[s.q_when_to_start] ?? s.q_when_to_start : null],
                ]}
              />
            </Card>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            {/* Contact card */}
            <Card icon={<User className="w-4 h-4" />} title="איש קשר">
              <div className="space-y-3 text-sm">
                {s.contact_name && (
                  <div>
                    <div className="text-xs text-gray-500">שם</div>
                    <div className="font-medium text-gray-900">{s.contact_name}</div>
                  </div>
                )}
                {s.contact_phone && (
                  <div>
                    <div className="text-xs text-gray-500">טלפון</div>
                    <a
                      href={`tel:${s.contact_phone}`}
                      className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium"
                      dir="ltr"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {s.contact_phone}
                    </a>
                  </div>
                )}
                {s.contact_email && (
                  <div>
                    <div className="text-xs text-gray-500">אימייל</div>
                    <a
                      href={`mailto:${s.contact_email}`}
                      className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium break-all"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      {s.contact_email}
                    </a>
                  </div>
                )}
                {!s.contact_name && !s.contact_phone && !s.contact_email && (
                  <div className="text-sm text-gray-400">לא נמסרו פרטי קשר</div>
                )}
              </div>
            </Card>

            {/* Notes */}
            <Card title="הערות פנימיות" icon={<RotateCcw className="w-4 h-4" />}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="הערות לעצמך — לא נחשפות ללקוח..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-none"
              />
              <button
                onClick={handleSaveNotes}
                disabled={!notesChanged || isSavingNotes}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isSavingNotes ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                שמור הערות
              </button>
            </Card>

            {/* Metadata */}
            {(s.utm_source || s.utm_medium || s.referer) && (
              <Card title="מקור" icon={<Target className="w-4 h-4" />}>
                <KvGrid
                  items={[
                    ['UTM Source', s.utm_source],
                    ['UTM Medium', s.utm_medium],
                    ['UTM Campaign', s.utm_campaign],
                    ['Referer', s.referer],
                  ]}
                  small
                />
              </Card>
            )}

            {/* Danger zone */}
            <div className="border border-red-200 bg-red-50/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                איזור מסוכן
              </h3>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:bg-red-100 border border-red-200 rounded-lg font-medium transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                מחק הגשה לצמיתות
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function Card({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
        {icon && <span className="text-gray-500">{icon}</span>}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KvGrid({
  items,
  small,
}: {
  items: Array<[string, string | null | undefined]>;
  small?: boolean;
}) {
  const filled = items.filter(([, v]) => v != null && v !== '');
  if (filled.length === 0) {
    return <div className="text-sm text-gray-400">— לא נמסר —</div>;
  }
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {filled.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-gray-500">{k}</dt>
          <dd className={`${small ? 'text-xs' : 'text-sm'} text-gray-900 font-medium break-words`}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function QaList({ items }: { items: Array<[string, string | null | undefined]> }) {
  const filled = items.filter(([, v]) => v != null && v !== '');
  if (filled.length === 0) {
    return <div className="text-sm text-gray-400 mt-3">— לא נענה —</div>;
  }
  return (
    <div className="space-y-4 mt-4">
      {filled.map(([q, a]) => (
        <div key={q}>
          <div className="text-xs font-semibold text-gray-500 mb-1">{q}</div>
          <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{a}</div>
        </div>
      ))}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  scale,
}: {
  label: string;
  value: number;
  scale: 'health' | 'dependency' | 'urgency';
}) {
  // For health: high = good (green). For dependency/urgency: high = bad (red).
  const inverted = scale === 'dependency' || scale === 'urgency';
  const color = inverted
    ? value >= 7
      ? 'bg-red-500'
      : value >= 4
        ? 'bg-amber-500'
        : 'bg-green-500'
    : value >= 7
      ? 'bg-green-500'
      : value >= 4
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value}/10</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  );
}
