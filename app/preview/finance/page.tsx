/**
 * Finance vertical preview
 *
 * Aesthetic: Editorial / financial-paper. Dark slate + warm sand,
 * serif display font (Playfair Display) for numbers + headings,
 * mono font (JetBrains Mono) for figures, dense information layout.
 * Inspired by FT.com, Stripe Atlas, and quarterly reports.
 *
 * This is a STATIC preview using fake data — it's a design-validation
 * artifact, not a working dashboard. Production version would pull
 * from the workspace's actual records.
 */
'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, TrendingUp, FileText, Calendar, Building2, ChevronLeft } from 'lucide-react';

export default function FinancePreview() {
  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#0a1628]" dir="rtl">
      {/* Custom font imports for this preview only.
          Playfair Display for editorial weight on numbers/headings,
          IBM Plex Sans for body, IBM Plex Mono for figures. */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,800;1,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .font-display { font-family: 'Playfair Display', serif; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      <div className="font-body">
        {/* Top navigation strip - thin, restrained */}
        <header className="border-b border-[#0a1628]/10 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-xs text-[#0a1628]/60 hover:text-[#0a1628]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              חזרה לדשבורד הרגיל
            </Link>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#0a1628]/40 font-mono">
              Q2 · 2026 · רואה חשבון
            </div>
          </div>
        </header>

        {/* Editorial masthead */}
        <section className="border-b-2 border-[#0a1628] bg-white">
          <div className="max-w-7xl mx-auto px-6 py-10 md:py-14">
            <div className="flex items-baseline justify-between gap-6 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#0a1628]/50 font-mono mb-2">
                  סקירת רבעון · יום שלישי, 28 באפריל 2026
                </div>
                <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
                  הסקירה<br />
                  <em className="font-display italic text-[#8b6914]">הפיננסית</em>
                </h1>
              </div>
              <div className="text-[11px] text-[#0a1628]/50 font-mono leading-loose text-left">
                קבלן שלד ירין<br />
                ע.ר. 514293012<br />
                בנק לאומי 10-800
              </div>
            </div>
          </div>
        </section>

        {/* KPI band - dense, editorial */}
        <section className="border-b border-[#0a1628]/10 bg-[#0a1628] text-[#fafaf7]">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-[#fafaf7]/15">
            <KPI
              label="הכנסות רבעון"
              value="₪ 450,210"
              change="+12.4%"
              changeKind="up"
              note="מול ₪ 400,510 ב-Q1"
            />
            <KPI
              label="הוצאות רבעון"
              value="₪ 180,335"
              change="-3.1%"
              changeKind="up"
              note="חיסכון של ₪5,800"
            />
            <KPI
              label="רווח גולמי"
              value="₪ 269,875"
              change="+19.8%"
              changeKind="up"
              note="שיעור רווח 60%"
              highlight
            />
            <KPI
              label="מע״מ לדיווח"
              value="₪ 32,144"
              change="חודש זה"
              changeKind="neutral"
              note="עד 15 במאי"
            />
          </div>
        </section>

        {/* Two-column layout - revenue vs expense */}
        <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
          <div className="grid md:grid-cols-12 gap-8">
            {/* Cashflow chart - takes 8/12 */}
            <article className="md:col-span-8">
              <div className="border-b border-[#0a1628]/20 pb-3 mb-6">
                <h2 className="font-display text-2xl">תזרים מזומנים · רבעון אחרון</h2>
                <p className="text-xs text-[#0a1628]/60 mt-1 font-mono">
                  הכנסות לעומת הוצאות, פירוט חודשי
                </p>
              </div>

              {/* Pure CSS bar chart - no external lib needed for the mockup */}
              <div className="space-y-4">
                {[
                  { month: 'פברואר', income: 132000, expense: 58000 },
                  { month: 'מרץ', income: 145000, expense: 62000 },
                  { month: 'אפריל', income: 173210, expense: 60335 },
                ].map((m) => {
                  const max = 200000;
                  return (
                    <div key={m.month}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="font-display text-sm">{m.month}</span>
                        <span className="font-mono text-xs text-[#0a1628]/60">
                          רווח: ₪ {(m.income - m.expense).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#0a1628]/40 w-12">הכנסות</span>
                          <div className="flex-1 h-7 bg-[#0a1628]/5 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-[#0a1628] flex items-center justify-end pl-2"
                              style={{ width: `${(m.income / max) * 100}%` }}
                            >
                              <span className="font-mono text-[10px] text-white">
                                ₪{m.income.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#0a1628]/40 w-12">הוצאות</span>
                          <div className="flex-1 h-7 bg-[#0a1628]/5 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-[#8b6914] flex items-center justify-end pl-2"
                              style={{ width: `${(m.expense / max) * 100}%` }}
                            >
                              <span className="font-mono text-[10px] text-white">
                                ₪{m.expense.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            {/* Sidebar - critical reminders */}
            <aside className="md:col-span-4 border-r border-[#0a1628]/10 md:pr-8">
              <div className="border-b border-[#0a1628]/20 pb-3 mb-6">
                <h2 className="font-display text-2xl">לטיפול</h2>
                <p className="text-xs text-[#0a1628]/60 mt-1 font-mono">
                  4 פעולות דורשות תשומת לב
                </p>
              </div>

              <ul className="space-y-4">
                <Reminder
                  badge="מע״מ"
                  title="דיווח מע״מ למרץ-אפריל"
                  meta="עד 15.05 · ₪ 32,144"
                  urgent
                />
                <Reminder
                  badge="חשבונית"
                  title="3 חשבוניות ממתינות לאישור"
                  meta="סך ₪ 4,820"
                />
                <Reminder
                  badge="גבייה"
                  title="אופק בנייה - חוב פתוח"
                  meta="60 יום · ₪ 18,500"
                />
                <Reminder
                  badge="מס"
                  title="מקדמת מס הכנסה"
                  meta="עד 30.04"
                />
              </ul>
            </aside>
          </div>
        </section>

        {/* Recent transactions - tabular, dense */}
        <section className="max-w-7xl mx-auto px-6 pb-14">
          <div className="border-b border-[#0a1628]/20 pb-3 mb-6 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-2xl">תנועות אחרונות</h2>
              <p className="text-xs text-[#0a1628]/60 mt-1 font-mono">
                12 התנועות האחרונות מבנק לאומי
              </p>
            </div>
            <Link href="#" className="text-xs underline underline-offset-4 text-[#0a1628]/70 hover:text-[#0a1628]">
              צפייה בכל התנועות
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#0a1628] text-[10px] uppercase tracking-[0.1em] font-mono text-[#0a1628]/60">
                  <th className="text-right py-3 pl-3 font-normal">תאריך</th>
                  <th className="text-right py-3 px-3 font-normal">תיאור</th>
                  <th className="text-right py-3 px-3 font-normal">קטגוריה</th>
                  <th className="text-left py-3 px-3 font-normal">סכום</th>
                  <th className="text-right py-3 pr-3 font-normal">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0a1628]/10">
                {[
                  { date: '28.04', desc: 'אבן גבריאל בע״מ', cat: 'לקוח', amount: 18000, status: 'התקבל' },
                  { date: '27.04', desc: 'כל צרכי הנגרות', cat: 'ספק', amount: -168, status: 'שולם' },
                  { date: '26.04', desc: 'אופק בנייה', cat: 'לקוח', amount: 22500, status: 'ממתין' },
                  { date: '25.04', desc: 'ביטוח לאומי', cat: 'מס', amount: -2440, status: 'שולם' },
                  { date: '24.04', desc: 'בית חכם השקעות', cat: 'לקוח', amount: 35000, status: 'התקבל' },
                  { date: '22.04', desc: 'דלק - תחנת פז', cat: 'תפעול', amount: -380, status: 'שולם' },
                ].map((t, i) => (
                  <tr key={i} className="hover:bg-[#0a1628]/[0.02] transition-colors">
                    <td className="py-3 pl-3 font-mono text-xs text-[#0a1628]/70">{t.date}</td>
                    <td className="py-3 px-3 font-medium">{t.desc}</td>
                    <td className="py-3 px-3 text-xs text-[#0a1628]/60 font-mono uppercase tracking-wider">
                      {t.cat}
                    </td>
                    <td className={`py-3 px-3 text-left font-mono ${t.amount > 0 ? 'text-[#0a1628]' : 'text-[#8b6914]'}`}>
                      {t.amount > 0 ? '+' : ''}₪ {t.amount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                        t.status === 'התקבל' || t.status === 'שולם'
                          ? 'border-[#0a1628]/30 text-[#0a1628]/80'
                          : 'border-[#8b6914] text-[#8b6914] bg-[#8b6914]/5'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer note */}
        <footer className="border-t border-[#0a1628]/15 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] font-mono text-[#0a1628]/40">
            <span>TaskFlow Finance · גרסת תצוגה</span>
            <span>שורות חדשות יסומנו אוטומטית</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function KPI({
  label, value, change, changeKind, note, highlight = false,
}: {
  label: string;
  value: string;
  change: string;
  changeKind: 'up' | 'down' | 'neutral';
  note: string;
  highlight?: boolean;
}) {
  return (
    <div className={`px-6 py-7 ${highlight ? 'bg-[#fafaf7]/[0.04]' : ''}`}>
      <div className="text-[10px] uppercase tracking-[0.15em] font-mono text-[#fafaf7]/50 mb-3">
        {label}
      </div>
      <div className="font-display text-3xl md:text-4xl mb-1.5 font-mono tracking-tight">
        {value}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        {changeKind === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-300" />}
        {changeKind === 'down' && <ArrowDownRight className="w-3 h-3 text-red-300" />}
        <span className={changeKind === 'up' ? 'text-emerald-300' : changeKind === 'down' ? 'text-red-300' : 'text-[#fafaf7]/50'}>
          {change}
        </span>
        <span className="text-[#fafaf7]/40">·</span>
        <span className="text-[#fafaf7]/50">{note}</span>
      </div>
    </div>
  );
}

function Reminder({
  badge, title, meta, urgent = false,
}: {
  badge: string;
  title: string;
  meta: string;
  urgent?: boolean;
}) {
  return (
    <li className="group">
      <div className="flex items-baseline gap-3">
        <span className={`text-[9px] uppercase tracking-[0.15em] font-mono px-1.5 py-0.5 border ${
          urgent ? 'border-[#8b6914] bg-[#8b6914]/5 text-[#8b6914]' : 'border-[#0a1628]/30 text-[#0a1628]/60'
        }`}>
          {badge}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-snug">{title}</div>
          <div className="font-mono text-[11px] text-[#0a1628]/50 mt-0.5">{meta}</div>
        </div>
      </div>
    </li>
  );
}
