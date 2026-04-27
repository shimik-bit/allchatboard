/**
 * PrivacyContent
 * ============================================================================
 * Reusable privacy policy body, used in /privacy page and accept-terms modal.
 */

export default function PrivacyContent({ inModal = false }: { inModal?: boolean }) {
  const sectionClass = inModal ? 'mb-6' : 'mb-8';

  return (
    <div className="text-right">
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
          איזה מידע אנחנו אוספים?
        </h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          בעת הרשמה ושימוש בשירות, אנחנו אוספים:
        </p>
        <ul className="list-disc pr-6 space-y-1 text-gray-700 text-sm">
          <li><strong>פרטי חשבון</strong>: שם, אימייל, מספר טלפון, שם עסק</li>
          <li>
            <strong>נתוני שימוש</strong>: הודעות וואטסאפ שעוברות דרך השירות, תוכן שיוצר על ידי AI
          </li>
          <li><strong>פרטי תשלום</strong>: מעובדים על ידי Cardcom (לא נשמרים אצלנו)</li>
          <li><strong>נתונים טכניים</strong>: כתובת IP, סוג דפדפן, זמני התחברות</li>
          <li><strong>נתוני קבוצות וואטסאפ</strong>: שמות קבוצות, רשימת חברים, היסטוריית הודעות</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
          איך אנחנו משתמשים במידע?
        </h2>
        <ul className="list-disc pr-6 space-y-1.5 text-gray-700 text-sm">
          <li>מתן השירות (סיווג הודעות, ניהול לוחות, התראות)</li>
          <li>שיפור השירות (ניתוח ביצועים, תיקון באגים)</li>
          <li>תקשורת איתך (התראות, עדכונים, חיובים)</li>
          <li>בטיחות (זיהוי שימוש לרעה, מניעת הונאה)</li>
          <li>קיום חובות חוקיות</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">עם מי המידע משותף?</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          המידע משותף עם <strong>ספקי תשתית</strong> בלבד:
        </p>
        <ul className="list-disc pr-6 space-y-1 text-gray-700 text-sm">
          <li><strong>Supabase</strong> (בסיס נתונים) - אירופה</li>
          <li><strong>Vercel</strong> (אחסון אתר) - גלובלי</li>
          <li><strong>OpenAI</strong> (סיווג הודעות AI) - ארה&quot;ב</li>
          <li><strong>Anthropic</strong> (חלופת AI) - ארה&quot;ב</li>
          <li><strong>Green API</strong> (גישת WhatsApp) - אירופה</li>
          <li><strong>Cardcom</strong> (תשלומים) - ישראל</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mt-3 text-sm">
          אנחנו <strong>לא מוכרים</strong> את המידע שלך לאף אחד.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">הזכויות שלך</h2>
        <ul className="list-disc pr-6 space-y-1 text-gray-700 text-sm">
          <li><strong>גישה</strong>: בקשת עותק מהמידע שלנו עליך</li>
          <li><strong>תיקון</strong>: עדכון מידע לא מדויק</li>
          <li><strong>מחיקה</strong>: בקשה למחיקת חשבון ונתונים</li>
          <li><strong>ייצוא</strong>: הורדת המידע שלך בפורמט סטנדרטי</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mt-3 text-sm">
          לכל בקשה:{' '}
          <a href="mailto:privacy@taskflow-ai.com" className="text-purple-600 hover:underline">
            privacy@taskflow-ai.com
          </a>
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">Cookies</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          אנחנו משתמשים ב-cookies הכרחיים בלבד (התחברות, העדפות שפה). אין cookies של פרסום או
          מעקב צד שלישי.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">שמירת נתונים</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          נתונים נשמרים כל זמן שהחשבון פעיל. בעת מחיקה, נתונים נמחקים תוך 30 יום (פרט לחשבוניות,
          שיש חובה לשמור 7 שנים).
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">יצירת קשר</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          שאלות פרטיות:{' '}
          <a href="mailto:privacy@taskflow-ai.com" className="text-purple-600 hover:underline">
            privacy@taskflow-ai.com
          </a>
        </p>
      </section>
    </div>
  );
}
