/**
 * Vertical preview hub
 *
 * Landing page that lets the viewer compare the two vertical mockups
 * (finance vs beauty) side-by-side. This is a design-validation surface,
 * not a production page — it's how Shimi can show "same product, different
 * vibe" to potential customers.
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PreviewHub() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 md:p-12" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700&display=swap');
      `}</style>

      <div className="max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          חזרה לדשבורד
        </Link>

        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3 font-medium">
            Design Preview · Vertical-aware UX
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Fraunces, serif' }}>
            אותה מערכת. <em className="italic font-normal text-purple-600">חוויה שונה.</em>
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            כדי שהמערכת תרגיש שנבנתה במיוחד עבור הלקוח, היא יודעת להתאים את עצמה לתחום שלו.
            לחץ על כל אחד מהבקרים למטה כדי לראות איך זה מרגיש.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Finance card */}
          <Link
            href="/preview/finance"
            className="group relative overflow-hidden rounded-3xl bg-[#0a1628] text-white p-8 md:p-10 hover:shadow-2xl transition-shadow"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#8b6914]/30 rounded-full blur-3xl" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-3 font-mono">
                Vertical 01
              </div>
              <h2 className="text-3xl mb-3" style={{ fontFamily: 'Fraunces, serif' }}>
                Finance
              </h2>
              <p className="text-white/70 text-sm mb-6">
                לרואי חשבון ויועצים פיננסיים. עיצוב editorial עם ספרים שמרניים, פונט serif אלגנטי, וטבלאות צפופות.
              </p>
              <ul className="space-y-1 text-xs text-white/60 mb-6">
                <li>📊 גרפים, KPIs, תזרים מזומנים</li>
                <li>📋 טבלאות תנועות צפופות לקריאה מהירה</li>
                <li>🎯 שפה מקצועית: "סך הכנסות", "מע״מ לדיווח"</li>
              </ul>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-white border-b border-white/30 pb-1 group-hover:border-white transition">
                לפתוח את הדמו
                <ArrowLeft className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Beauty card */}
          <Link
            href="/preview/beauty"
            className="group relative overflow-hidden rounded-3xl p-8 md:p-10 hover:shadow-2xl transition-shadow"
            style={{
              background: 'linear-gradient(135deg, #fdf2ef 0%, #fbe4dd 35%, #f5d5e0 70%, #ede2f0 100%)',
            }}
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#e8a4bf]/40 rounded-full blur-3xl" />
            <div className="relative text-[#3d2535]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#3d2535]/50 mb-3 font-medium">
                Vertical 02
              </div>
              <h2 className="text-3xl mb-3" style={{ fontFamily: 'Fraunces, serif' }}>
                Beauty
              </h2>
              <p className="text-[#3d2535]/75 text-sm mb-6">
                לקוסמטיקאיות, ספריות וסטודיואים. עיצוב soft+organic עם פסטלים, פונט מעוגל וקלפים יפים.
              </p>
              <ul className="space-y-1 text-xs text-[#3d2535]/65 mb-6">
                <li>💖 קלפי לקוחות עם אווטרים צבעוניים</li>
                <li>📅 פגישות בלוח זמנים ויזואלי</li>
                <li>✨ שפה רגשית: "החמודות שלך", "היום שלך"</li>
              </ul>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-[#3d2535] border-b border-[#3d2535]/30 pb-1 group-hover:border-[#3d2535] transition">
                לפתוח את הדמו
                <ArrowLeft className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          שתי הדוגמאות הן <strong>סטטיות</strong> עם נתונים פיקטיביים — מטרתן להראות את כיוון העיצוב.
          <br />
          לאחר אישור הכיוון, נבנה את המנגנון שמתאים את החוויה אוטומטית לפי תחום ה-workspace.
        </div>
      </div>
    </div>
  );
}
