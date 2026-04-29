/**
 * Beauty/cosmetics vertical preview
 *
 * Aesthetic: Soft organic. Cream + dusty rose + sage gradient,
 * Fraunces serif for warmth, Plus Jakarta Sans for body.
 * Inspired by editorial beauty magazines and boutique salon brands.
 *
 * Design choices:
 *   - Cards over tables (stylists scan visually, not data-densely)
 *   - Larger touch targets (often used on tablet/phone in salon)
 *   - Soft shadows, generous radius, no sharp corners
 *   - Emotional language: "היום שלך" not "Dashboard"
 *   - Avatar-driven: appointments lead with the client's face/initial
 */
'use client';

import Link from 'next/link';
import { Heart, Sparkles, Calendar, Clock, ChevronLeft, Plus, Star } from 'lucide-react';

export default function BeautyPreview() {
  return (
    <div
      className="min-h-screen relative"
      dir="rtl"
      style={{
        background: 'linear-gradient(135deg, #fdf2ef 0%, #fbe4dd 35%, #f5d5e0 70%, #ede2f0 100%)',
      }}
    >
      {/* Custom fonts - Fraunces for warmth, Plus Jakarta for body */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..700,30..100&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .font-fraunces { font-family: 'Fraunces', serif; font-variation-settings: 'SOFT' 80; }
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {/* Decorative blob shapes — pure CSS, atmospheric depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#f8b3c9] rounded-full blur-3xl opacity-40" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-[#d9b8e0] rounded-full blur-3xl opacity-35" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-[#fce4a3] rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative font-jakarta text-[#3d2535]">
        {/* Top nav */}
        <header className="px-5 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-[#3d2535]/60 hover:text-[#3d2535] backdrop-blur-sm bg-white/30 px-3 py-1.5 rounded-full"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            חזרה לדשבורד הרגיל
          </Link>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e8a4bf] to-[#d987af] grid place-items-center text-white font-fraunces text-lg shadow-lg shadow-[#e8a4bf]/30">
            ר
          </div>
        </header>

        {/* Hero greeting */}
        <section className="px-5 py-8 md:py-12">
          <div className="max-w-5xl mx-auto">
            <div className="text-xs font-medium text-[#3d2535]/60 mb-2 tracking-wide">
              יום שלישי, 28 באפריל ✨
            </div>
            <h1 className="font-fraunces text-4xl md:text-6xl leading-[1.05] font-light text-[#3d2535]">
              בוקר טוב, <em className="italic font-normal text-[#a8527a]">רותי</em>
              <br />
              <span className="text-2xl md:text-4xl font-extralight">יש לך 4 פגישות היום</span>
            </h1>
          </div>
        </section>

        {/* Stats - soft pill style */}
        <section className="px-5 mb-8">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill icon="💖" label="לקוחות פעילות" value="127" change="+8 החודש" />
            <StatPill icon="📅" label="פגישות השבוע" value="32" change="84% תפוסה" />
            <StatPill icon="✨" label="הכנסה החודש" value="₪14,200" change="יעד: ₪18K" />
            <StatPill icon="⭐" label="דירוג ממוצע" value="4.9" change="מתוך 47 ביקורות" />
          </div>
        </section>

        {/* Today's appointments - card-based, beautiful */}
        <section className="px-5 mb-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-fraunces text-2xl text-[#3d2535]">הפגישות שלך היום</h2>
              <Link href="#" className="text-xs text-[#a8527a] font-medium hover:underline underline-offset-4">
                לוח זמנים מלא
              </Link>
            </div>

            <div className="space-y-3">
              <AppointmentCard
                time="11:00"
                duration="45 דק׳"
                clientName="שני כהן"
                initial="ש"
                avatarBg="from-[#e8a4bf] to-[#c97195]"
                service="פדיקור לק ג׳ל"
                price="₪220"
                tags={['לקוחה קבועה', '6 ביקורים']}
                done
              />
              <AppointmentCard
                time="14:00"
                duration="90 דק׳"
                clientName="מאי לוי"
                initial="מ"
                avatarBg="from-[#d9b8e0] to-[#b48ac4]"
                service="איפור כלות + עיצוב גבות"
                price="₪450"
                tags={['חבילת כלה', 'אירוע 03.05']}
                next
              />
              <AppointmentCard
                time="16:30"
                duration="60 דק׳"
                clientName="אורית בן-דוד"
                initial="א"
                avatarBg="from-[#fbcfa3] to-[#e8a87a]"
                service="טיפול פנים + מסכת זהב"
                price="₪280"
                tags={['ביקור ראשון', 'הופנתה ע״י שני']}
              />
              <AppointmentCard
                time="18:00"
                duration="30 דק׳"
                clientName="עינב אברהם"
                initial="ע"
                avatarBg="from-[#a8d5c9] to-[#7eb5a6]"
                service="עיצוב גבות עם חוט"
                price="₪80"
                tags={['חברתי']}
              />
            </div>
          </div>
        </section>

        {/* Bottom split - top services + birthdays */}
        <section className="px-5 pb-12">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4">
            {/* Top services */}
            <div className="backdrop-blur-md bg-white/50 rounded-3xl p-6 shadow-xl shadow-[#e8a4bf]/20 border border-white/60">
              <h3 className="font-fraunces text-xl mb-4 text-[#3d2535]">השירותים הפופולריים</h3>
              <ul className="space-y-3">
                {[
                  { name: 'פדיקור לק ג׳ל', count: 47, emoji: '💅' },
                  { name: 'איפור ערב', count: 32, emoji: '💄' },
                  { name: 'עיצוב גבות', count: 28, emoji: '✨' },
                  { name: 'טיפול פנים', count: 19, emoji: '🌸' },
                ].map((s) => (
                  <li key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{s.emoji}</span>
                      <span className="font-medium text-sm">{s.name}</span>
                    </div>
                    <span className="text-xs text-[#3d2535]/60">{s.count} השבוע</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Birthdays - delight moment */}
            <div className="backdrop-blur-md bg-gradient-to-br from-[#fce4a3]/40 to-[#f5d5e0]/40 rounded-3xl p-6 shadow-xl shadow-[#fce4a3]/30 border border-white/60">
              <h3 className="font-fraunces text-xl mb-1 text-[#3d2535] flex items-center gap-2">
                ימי הולדת השבוע
                <span className="text-xl">🎂</span>
              </h3>
              <p className="text-xs text-[#3d2535]/60 mb-4">
                שלחי לחמודות שלך ברכה והנחה של 15%
              </p>
              <ul className="space-y-2.5">
                {[
                  { name: 'אורית בן-דוד', day: 'מחר', initial: 'א', color: 'from-[#fbcfa3] to-[#e8a87a]' },
                  { name: 'דנה זילבר', day: 'יום ה׳', initial: 'ד', color: 'from-[#a8d5c9] to-[#7eb5a6]' },
                  { name: 'הילה עזרא', day: 'שבת', initial: 'ה', color: 'from-[#d9b8e0] to-[#b48ac4]' },
                ].map((b) => (
                  <li key={b.name} className="flex items-center gap-3 group cursor-pointer">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${b.color} grid place-items-center text-white font-fraunces text-sm`}>
                      {b.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{b.name}</div>
                      <div className="text-xs text-[#3d2535]/55">{b.day}</div>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition text-xs px-3 py-1 rounded-full bg-white text-[#a8527a] font-medium shadow-sm">
                      שלחי ברכה ✨
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Floating quick action button */}
        <button className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#e8a4bf] to-[#a8527a] text-white shadow-2xl shadow-[#a8527a]/40 grid place-items-center hover:scale-105 transition-transform">
          <Plus className="w-6 h-6" />
        </button>

        {/* Footer hint */}
        <footer className="px-5 pb-4 text-center text-[10px] text-[#3d2535]/40 font-medium tracking-wide">
          TaskFlow Beauty · גרסת תצוגה
        </footer>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, change }: { icon: string; label: string; value: string; change: string }) {
  return (
    <div className="backdrop-blur-md bg-white/50 rounded-2xl p-4 border border-white/60 shadow-lg shadow-[#e8a4bf]/10">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] font-medium text-[#3d2535]/60">{label}</span>
      </div>
      <div className="font-fraunces text-2xl font-medium text-[#3d2535]">{value}</div>
      <div className="text-[10px] text-[#3d2535]/55 mt-0.5">{change}</div>
    </div>
  );
}

function AppointmentCard({
  time, duration, clientName, initial, avatarBg, service, price, tags, done, next,
}: {
  time: string;
  duration: string;
  clientName: string;
  initial: string;
  avatarBg: string;
  service: string;
  price: string;
  tags: string[];
  done?: boolean;
  next?: boolean;
}) {
  return (
    <div className={`relative backdrop-blur-md rounded-2xl p-4 transition-all hover:scale-[1.01] cursor-pointer ${
      done
        ? 'bg-white/30 border border-white/40 opacity-70'
        : next
        ? 'bg-white/70 border-2 border-[#e8a4bf] shadow-2xl shadow-[#e8a4bf]/30'
        : 'bg-white/55 border border-white/60 shadow-lg shadow-[#e8a4bf]/15'
    }`}>
      {next && (
        <div className="absolute -top-2.5 right-5 px-2.5 py-0.5 bg-[#a8527a] text-white rounded-full text-[10px] font-bold tracking-wide">
          הבא בתור ✨
        </div>
      )}
      <div className="flex items-center gap-4">
        {/* Time block */}
        <div className="text-center shrink-0 w-14">
          <div className={`font-fraunces text-2xl ${done ? 'line-through text-[#3d2535]/40' : 'text-[#3d2535]'}`}>
            {time}
          </div>
          <div className="text-[10px] text-[#3d2535]/55 -mt-0.5">{duration}</div>
        </div>

        {/* Vertical separator */}
        <div className="w-px h-12 bg-[#3d2535]/10" />

        {/* Client avatar */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarBg} grid place-items-center text-white font-fraunces text-xl shadow-md shrink-0`}>
          {initial}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-[#3d2535] truncate">{clientName}</div>
          <div className="text-xs text-[#3d2535]/70 mb-1.5">{service}</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-[#3d2535]/70 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="text-left shrink-0">
          <div className={`font-fraunces text-xl ${done ? 'text-[#3d2535]/40' : 'text-[#a8527a]'}`}>
            {price}
          </div>
          {done && <div className="text-[10px] text-[#3d2535]/40">בוצע</div>}
        </div>
      </div>
    </div>
  );
}
