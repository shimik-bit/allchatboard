import Link from 'next/link';
import { MessageSquare, Sparkles, LayoutGrid, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-brand-50/30">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl">AllChatBoard</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="btn-ghost">התחברות</Link>
            <Link href="/auth/signup" className="btn-primary">התחל חינם</Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          חדש: AI מסווג אוטומטית כל הודעה לטבלה הנכונה
        </div>
        <h1 className="font-display font-bold text-5xl md:text-7xl leading-tight mb-6">
          הפכו צ׳אטים של וואטסאפ
          <br />
          <span className="bg-gradient-to-l from-brand-600 to-purple-500 bg-clip-text text-transparent">
            ללוחות מנוהלים
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          AllChatBoard לוקח את כל ההודעות מקבוצות הוואטסאפ של העסק שלך, מסווג אותן עם AI,
          וממלא אוטומטית טבלאות מותאמות לתחום שלך.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/auth/signup" className="btn-primary text-base px-6 py-3">
            התחל ניסיון חינם של 14 יום
          </Link>
          <Link href="#features" className="btn-secondary text-base px-6 py-3">
            איך זה עובד?
          </Link>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<MessageSquare className="w-6 h-6" />}
          title="חיבור פשוט לוואטסאפ"
          desc="חברו את הקבוצות תוך 2 דקות באמצעות AllChat. אנחנו מקשיבים לכל ההודעות."
        />
        <FeatureCard
          icon={<Sparkles className="w-6 h-6" />}
          title="AI שמבין את העסק שלכם"
          desc="ה-AI לומד את הענף שלכם — מוסך, מסעדה, נדל״ן — ומסווג כל הודעה לטבלה הנכונה."
        />
        <FeatureCard
          icon={<LayoutGrid className="w-6 h-6" />}
          title="לוחות שמתאימים בדיוק לכם"
          desc="טבלאות, קנבן, לוח שנה — כל תצוגה לכל סוג נתונים. בנו את העסק שלכם בצורה ויזואלית."
        />
      </section>

      <footer className="border-t border-gray-100 mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          © 2026 AllChatBoard. נבנה עם <Zap className="w-3.5 h-3.5 inline text-brand-500" /> בישראל.
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon, title, desc,
}: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
