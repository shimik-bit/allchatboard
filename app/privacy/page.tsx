import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TERMS_LAST_UPDATED_DISPLAY } from '@/lib/terms/version';

export const metadata = {
  title: 'מדיניות פרטיות',
  description: 'מדיניות הפרטיות של TaskFlow AI',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/taskflow-logo.png" alt="TaskFlow AI" className="h-10 w-auto object-contain" />
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            חזרה לעמוד הבית
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl text-gray-900 mb-2">
            מדיניות פרטיות
          </h1>
          <div className="text-sm text-gray-500">
            עדכון אחרון: {TERMS_LAST_UPDATED_DISPLAY}
          </div>
        </div>

        <article className="prose prose-gray max-w-none bg-white rounded-2xl p-8 shadow-sm border border-gray-100">

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">איזה מידע אנחנו אוספים?</h2>
            <p className="text-gray-700 leading-relaxed mb-3">בעת הרשמה ושימוש בשירות, אנחנו אוספים:</p>
            <ul className="list-disc pr-6 space-y-1 text-gray-700">
              <li><strong>פרטי חשבון</strong>: שם, אימייל, מספר טלפון, שם עסק</li>
              <li><strong>נתוני שימוש</strong>: הודעות וואטסאפ שעוברות דרך השירות, תוכן שיוצר על ידי AI</li>
              <li><strong>פרטי תשלום</strong>: מעובדים על ידי Cardcom (לא נשמרים אצלנו)</li>
              <li><strong>נתונים טכניים</strong>: כתובת IP, סוג דפדפן, זמני התחברות</li>
              <li><strong>נתוני קבוצות וואטסאפ</strong>: שמות קבוצות, רשימת חברים, היסטוריית הודעות</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">איך אנחנו משתמשים במידע?</h2>
            <ul className="list-disc pr-6 space-y-2 text-gray-700">
              <li>מתן השירות (סיווג הודעות, ניהול לוחות, התראות)</li>
              <li>שיפור השירות (ניתוח ביצועים, תיקון באגים)</li>
              <li>תקשורת איתך (התראות, עדכונים, חיובים)</li>
              <li>בטיחות (זיהוי שימוש לרעה, מניעת הונאה)</li>
              <li>קיום חובות חוקיות</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">עם מי המידע משותף?</h2>
            <p className="text-gray-700 leading-relaxed mb-3">המידע משותף עם <strong>ספקי תשתית</strong> בלבד:</p>
            <ul className="list-disc pr-6 space-y-1 text-gray-700">
              <li><strong>Supabase</strong> (בסיס נתונים) - אירופה</li>
              <li><strong>Vercel</strong> (אחסון אתר) - גלובלי</li>
              <li><strong>OpenAI</strong> (סיווג הודעות AI) - ארה&quot;ב</li>
              <li><strong>Anthropic</strong> (חלופת AI) - ארה&quot;ב</li>
              <li><strong>Green API</strong> (גישת WhatsApp) - אירופה</li>
              <li><strong>Cardcom</strong> (תשלומים) - ישראל</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              אנחנו <strong>לא מוכרים</strong> את המידע שלך לאף אחד.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">הזכויות שלך</h2>
            <ul className="list-disc pr-6 space-y-1 text-gray-700">
              <li><strong>גישה</strong>: בקשת עותק מהמידע שלנו עליך</li>
              <li><strong>תיקון</strong>: עדכון מידע לא מדויק</li>
              <li><strong>מחיקה</strong>: בקשה למחיקת חשבון ונתונים</li>
              <li><strong>ייצוא</strong>: הורדת המידע שלך בפורמט סטנדרטי</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              לכל בקשה: <a href="mailto:privacy@taskflow-ai.com" className="text-purple-600 hover:underline">privacy@taskflow-ai.com</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              אנחנו משתמשים ב-cookies הכרחיים בלבד (התחברות, העדפות שפה). אין cookies של פרסום או מעקב צד שלישי.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">שמירת נתונים</h2>
            <p className="text-gray-700 leading-relaxed">
              נתונים נשמרים כל זמן שהחשבון פעיל. בעת מחיקה, נתונים נמחקים תוך 30 יום (פרט לחשבוניות, שיש חובה לשמור 7 שנים).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">יצירת קשר</h2>
            <p className="text-gray-700 leading-relaxed">
              שאלות פרטיות: <a href="mailto:privacy@taskflow-ai.com" className="text-purple-600 hover:underline">privacy@taskflow-ai.com</a>
            </p>
          </section>

        </article>

        <div className="text-center mt-8 text-sm text-gray-500">
          © 2026 TaskFlow AI. <Link href="/terms" className="text-purple-600 hover:underline">לתקנון המלא</Link>
        </div>
      </div>
    </main>
  );
}
