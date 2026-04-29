'use client';

/**
 * Beauty vertical dashboard
 *
 * Replaces the generic dashboard home for workspaces with vertical='beauty'.
 * Same data sources (records, tables, etc.) but presented through the lens
 * of a salon/spa's daily flow:
 *
 *   - Hero: warm personal greeting with day-of-week + appointment count
 *   - Today's appointments cards (large, avatar-driven)
 *   - Soft KPI pills (clients, appointments, revenue, rating)
 *   - Birthdays this week (delight moment)
 *
 * The data prop comes from the server component that fetches it from
 * the workspace's tables. If those tables don't exist yet (e.g. the
 * workspace hasn't been set up with the beauty template), the dashboard
 * shows soft empty states with seed-data CTAs.
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTheme } from '@/lib/themes/ThemeProvider';

export interface BeautyDashboardData {
  userName: string;
  workspaceName: string;
  /** Dashboard widgets — server passes whatever tables resolved successfully */
  appointmentsToday: AppointmentItem[];
  upcomingBirthdays: BirthdayItem[];
  stats: {
    clientCount: number;
    appointmentsThisWeek: number;
    revenueThisMonth: number;
    averageRating: number | null;
  };
  /** Whether the workspace has the beauty template installed yet */
  hasBeautyTables: boolean;
}

interface AppointmentItem {
  id: string;
  time: string;
  clientName: string;
  service: string;
  duration: string;
  price?: string;
}

interface BirthdayItem {
  id: string;
  name: string;
  daysUntil: number;
  dayLabel: string;
}

export default function BeautyDashboard({ data }: { data: BeautyDashboardData }) {
  const theme = useTheme();
  const hour = new Date().getHours();

  // Avatar gradients for clients - rotate through warm tones for variety.
  // Each client deterministically gets a color based on their name hash.
  const avatarGradients = [
    'from-[#e8a4bf] to-[#c97195]',
    'from-[#d9b8e0] to-[#b48ac4]',
    'from-[#fbcfa3] to-[#e8a87a]',
    'from-[#a8d5c9] to-[#7eb5a6]',
    'from-[#f5c9d1] to-[#d99eaa]',
  ];

  function avatarFor(name: string): string {
    // Simple deterministic hash: sum char codes mod gradient count.
    // Same name always picks the same color, so client identity stays
    // consistent across visits.
    let h = 0;
    for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
    return avatarGradients[h % avatarGradients.length];
  }

  return (
    <div
      className="min-h-full relative"
      style={{
        background: 'linear-gradient(135deg, #fdf2ef 0%, #fbe4dd 35%, #f5d5e0 70%, #ede2f0 100%)',
      }}
    >
      {/* Decorative blob shapes — pure CSS atmospheric depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#f8b3c9] rounded-full blur-3xl opacity-40" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-[#d9b8e0] rounded-full blur-3xl opacity-35" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-[#fce4a3] rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative px-5 py-6 md:py-10 max-w-5xl mx-auto" style={{ color: theme.colors.textBody }}>
        {/* Hero greeting */}
        <header className="mb-8">
          <div className="text-xs font-medium opacity-60 mb-2 tracking-wide">
            {dayOfWeekHebrew()} · {dateHebrew()}
          </div>
          <h1
            className="text-4xl md:text-6xl leading-[1.05] font-light"
            style={{ fontFamily: theme.typography.displayFont }}
          >
            בוקר טוב, <em className="italic font-normal" style={{ color: theme.colors.primary }}>
              {data.userName}
            </em>
            <br />
            <span className="text-2xl md:text-4xl font-extralight">
              {theme.microcopy.subgreeting?.({ hour, appointmentsToday: data.appointmentsToday.length })}
            </span>
          </h1>
        </header>

        {/* Setup nudge if the workspace doesn't have beauty tables yet */}
        {!data.hasBeautyTables && (
          <div className="mb-6 backdrop-blur-md bg-white/55 rounded-3xl p-6 border border-white/60 shadow-lg shadow-[#e8a4bf]/15">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💖</span>
              <h2 className="font-semibold" style={{ fontFamily: theme.typography.displayFont, fontSize: '1.5rem' }}>
                ברוכה הבאה!
              </h2>
            </div>
            <p className="text-sm opacity-75 mb-4">
              נראה שעוד לא הקמת את הטבלאות שלך. בלחיצה אחת אקים לך טבלאות לקוחות, פגישות ושירותים — מותאמות לסטודיו שלך.
            </p>
            <Link
              href="/dashboard/setup/beauty"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                boxShadow: `0 10px 25px -5px ${theme.colors.primary}40`,
              }}
            >
              ✨ התקנה מהירה
            </Link>
          </div>
        )}

        {/* Stats pills */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatPill icon="💖" label="לקוחות פעילות" value={data.stats.clientCount.toString()} note="סך הכל" theme={theme} />
          <StatPill icon="📅" label="פגישות השבוע" value={data.stats.appointmentsThisWeek.toString()} note="בלוח זמנים" theme={theme} />
          <StatPill icon="✨" label="הכנסה החודש" value={`₪${data.stats.revenueThisMonth.toLocaleString()}`} note="מצטבר" theme={theme} />
          <StatPill
            icon="⭐"
            label="דירוג ממוצע"
            value={data.stats.averageRating ? data.stats.averageRating.toFixed(1) : '—'}
            note={data.stats.averageRating ? 'מהלקוחות' : 'אין דירוגים'}
            theme={theme}
          />
        </section>

        {/* Today's appointments */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-2xl" style={{ fontFamily: theme.typography.displayFont }}>
              הפגישות שלך היום
            </h2>
            <Link href="#" className="text-xs font-medium hover:underline underline-offset-4" style={{ color: theme.colors.primary }}>
              לוח זמנים מלא
            </Link>
          </div>

          {data.appointmentsToday.length === 0 ? (
            <div className="backdrop-blur-md bg-white/40 rounded-3xl p-10 text-center border border-white/60">
              <div className="text-5xl mb-3">🌸</div>
              <p className="text-sm opacity-70">היום פנוי לגמרי. זמן מושלם לפנק את עצמך ✨</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.appointmentsToday.map((apt, idx) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  initial={apt.clientName.charAt(0)}
                  avatarBg={avatarFor(apt.clientName)}
                  isNext={idx === 0}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </section>

        {/* Birthdays */}
        {data.upcomingBirthdays.length > 0 && (
          <section className="mb-8">
            <div className="backdrop-blur-md bg-gradient-to-br from-[#fce4a3]/40 to-[#f5d5e0]/40 rounded-3xl p-6 shadow-xl shadow-[#fce4a3]/30 border border-white/60">
              <h3 className="text-xl mb-1 flex items-center gap-2" style={{ fontFamily: theme.typography.displayFont }}>
                ימי הולדת השבוע <span className="text-xl">🎂</span>
              </h3>
              <p className="text-xs opacity-65 mb-4">
                שלחי לחמודות שלך ברכה והנחה של 15%
              </p>
              <ul className="space-y-2.5">
                {data.upcomingBirthdays.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 group cursor-pointer">
                    <div
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarFor(b.name)} grid place-items-center text-white font-medium text-sm`}
                      style={{ fontFamily: theme.typography.displayFont }}
                    >
                      {b.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{b.name}</div>
                      <div className="text-xs opacity-65">{b.dayLabel}</div>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition text-xs px-3 py-1 rounded-full bg-white font-medium shadow-sm" style={{ color: theme.colors.primary }}>
                      שלחי ברכה ✨
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      {/* Floating quick action */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full text-white shadow-2xl grid place-items-center hover:scale-105 transition-transform"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.primaryDark})`,
          boxShadow: `0 25px 50px -12px ${theme.colors.primaryDark}66`,
        }}
        aria-label="הוספה חדשה"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function StatPill({
  icon, label, value, note, theme,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <div className="backdrop-blur-md bg-white/50 rounded-2xl p-4 border border-white/60 shadow-lg shadow-[#e8a4bf]/10">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] font-medium opacity-65">{label}</span>
      </div>
      <div
        className="text-2xl font-medium"
        style={{ fontFamily: theme.typography.displayFont, color: theme.colors.textBody }}
      >
        {value}
      </div>
      <div className="text-[10px] opacity-60 mt-0.5">{note}</div>
    </div>
  );
}

function AppointmentCard({
  appointment, initial, avatarBg, isNext, theme,
}: {
  appointment: AppointmentItem;
  initial: string;
  avatarBg: string;
  isNext: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <div
      className={`relative backdrop-blur-md rounded-2xl p-4 transition-all hover:scale-[1.01] cursor-pointer ${
        isNext
          ? 'bg-white/70 border-2 shadow-2xl'
          : 'bg-white/55 border border-white/60 shadow-lg'
      }`}
      style={{
        borderColor: isNext ? theme.colors.accent : undefined,
        boxShadow: isNext ? `0 25px 50px -12px ${theme.colors.accent}40` : undefined,
      }}
    >
      {isNext && (
        <div
          className="absolute -top-2.5 right-5 px-2.5 py-0.5 text-white rounded-full text-[10px] font-bold tracking-wide"
          style={{ background: theme.colors.primary }}
        >
          הבא בתור ✨
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="text-center shrink-0 w-14">
          <div
            className="text-2xl"
            style={{ fontFamily: theme.typography.displayFont, color: theme.colors.textBody }}
          >
            {appointment.time}
          </div>
          <div className="text-[10px] opacity-60 -mt-0.5">{appointment.duration}</div>
        </div>

        <div className="w-px h-12 opacity-15" style={{ background: theme.colors.textBody }} />

        <div
          className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarBg} grid place-items-center text-white text-xl shadow-md shrink-0`}
          style={{ fontFamily: theme.typography.displayFont }}
        >
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" style={{ color: theme.colors.textBody }}>
            {appointment.clientName}
          </div>
          <div className="text-xs opacity-75 mb-0.5">{appointment.service}</div>
        </div>

        {appointment.price && (
          <div className="text-left shrink-0">
            <div
              className="text-xl"
              style={{ fontFamily: theme.typography.displayFont, color: theme.colors.primary }}
            >
              {appointment.price}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers - Hebrew date formatters
// ============================================================================

function dayOfWeekHebrew(): string {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `יום ${days[new Date().getDay()]}`;
}

function dateHebrew(): string {
  const months = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
