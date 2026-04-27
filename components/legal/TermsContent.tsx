/**
 * TermsContent
 * ============================================================================
 * The actual terms-of-service text body, extracted so it can be used both:
 *  - On the standalone /terms page (full page layout)
 *  - Inside a modal on /auth/accept-terms (no header/footer, just content)
 */

import Link from 'next/link';

export default function TermsContent({ inModal = false }: { inModal?: boolean }) {
  // Slightly tighter spacing inside modal
  const sectionClass = inModal ? 'mb-6' : 'mb-8';

  return (
    <div className="text-right">
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">1. כללי</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          ברוכים הבאים ל-TaskFlow AI (להלן: <strong>&quot;השירות&quot;</strong>). השירות
          מופעל על ידי AllChat (להלן: <strong>&quot;החברה&quot;</strong>). השימוש בשירות,
          לרבות ההרשמה והשימוש בכלים השונים, כפוף לתנאים המפורטים בתקנון זה.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          אנא קרא את התנאים בעיון. השימוש בשירות מהווה הסכמה מלאה לתנאי שימוש אלה. אם
          אינך מסכים לתנאים - אנא הימנע משימוש בשירות.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">2. הגדרות</h2>
        <ul className="space-y-1.5 text-gray-700 text-sm">
          <li><strong>השירות</strong> - פלטפורמת TaskFlow AI לניהול הודעות וואטסאפ באמצעות AI.</li>
          <li><strong>המשתמש</strong> - כל אדם או גוף משפטי הנרשם ועושה שימוש בשירות.</li>
          <li><strong>תוכן</strong> - כל מידע, נתון, הודעה, קובץ או חומר אחר המועבר דרך השירות.</li>
          <li><strong>WhatsApp</strong> - שירות המסרים של מטא, אינו בבעלות החברה.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">3. הרשמה ושימוש בשירות</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          3.1. השימוש בשירות מותר רק למשתמשים מעל גיל 18 או לעסקים רשומים כדין.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          3.2. בעת ההרשמה, המשתמש מתחייב לספק מידע נכון, מלא ועדכני, ולעדכנו במקרה של שינוי.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          3.3. המשתמש אחראי לשמירת סודיות פרטי הכניסה שלו ולכל הפעולות המתבצעות תחת חשבונו.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          3.4. החברה רשאית לסרב להעניק שירות, להשעות חשבון או לבטל הרשמה בהתאם לשיקול דעתה.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">4. שימוש מותר ואסור</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          <strong>4.1. שימושים אסורים:</strong>
        </p>
        <ul className="list-disc pr-6 space-y-1 text-gray-700 mb-3 text-sm">
          <li>שליחת ספאם, פרסומות לא רצויות או הודעות בכמויות גדולות ללא הסכמת הנמענים</li>
          <li>שימוש בשירות לפעולות בלתי חוקיות, הונאה או הטעיה</li>
          <li>פגיעה בפרטיות אחרים, איסוף מידע אישי ללא הסכמה</li>
          <li>הפצת תוכן פוגעני, גזעני, מינימלי, אלים או לא חוקי</li>
          <li>ניסיון לפרוץ למערכת, להפריע לפעולתה או לעקוף מנגנוני אבטחה</li>
          <li>הפרת תנאי השימוש של WhatsApp או של מטא</li>
          <li>שימוש בשירות לטובת תחרות עסקית עם החברה</li>
        </ul>
        <p className="text-gray-700 leading-relaxed text-sm">
          4.2. הפרת איסורים אלו תגרור סגירת חשבון מיידית, ללא החזר, וללא יכולת ערעור.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">5. תשלומים ומנויים</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          5.1. המחירים מפורסמים באתר וכוללים מע&quot;מ אלא אם צוין אחרת.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          5.2. החברה רשאית לעדכן את המחירים מעת לעת. עדכונים יכנסו לתוקף בחודש הבא לאחר ההודעה.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          5.3. תקופת ניסיון: ניתן ניסיון חינם של 14 יום, ללא חיוב. לאחר תום התקופה, חיוב יבוצע
          אוטומטית על פי המסלול שנבחר אלא אם המנוי בוטל.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          5.4. ביטול מנוי: ניתן לבטל בכל עת דרך הגדרות החשבון. הביטול יכנס לתוקף בסוף תקופת
          החיוב הנוכחית (לא יבוצע החזר חלקי).
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          5.5. החברה לא תספק החזרים על שימוש שכבר בוצע, אלא במקרים חריגים לפי שיקול דעתה הבלעדי.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
          6. בעלות על תוכן וקניין רוחני
        </h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          6.1. כל הזכויות בשירות, לרבות התוכנה, העיצוב, הלוגו והשמות, שייכות לחברה ומוגנות בחוק.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          6.2. התוכן שהמשתמש מעלה לשירות נשאר בבעלותו. החברה מקבלת רישיון לעבד אותו לצורך מתן
          השירות בלבד.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          6.3. אסור להעתיק, לשכפל, להפיץ או למכור חלקים מהשירות ללא הסכמה בכתב מהחברה.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">7. פרטיות ואבטחת מידע</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          7.1. החברה מתחייבת לשמור על פרטיות המידע של המשתמשים בהתאם לחוק הגנת הפרטיות,
          התשמ&quot;א-1981.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          7.2. המידע נשמר בשרתים מאובטחים (Supabase, Vercel) הנמצאים באירופה ומיושמים אמצעי
          אבטחה תקניים.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          7.3. החברה לא תמכור או תעביר מידע אישי של משתמשים לצדדים שלישיים, למעט במקרים הבאים:
        </p>
        <ul className="list-disc pr-6 space-y-1 text-gray-700 mb-2 text-sm">
          <li>בהסכמת המשתמש</li>
          <li>על פי דרישת רשויות חוק או צו שיפוטי</li>
          <li>לצורך מתן השירות (ספקי תשתית, סליקה וכד&quot;)</li>
        </ul>
        <p className="text-gray-700 leading-relaxed text-sm">
          7.4. למידע מלא על מדיניות הפרטיות, ראה{' '}
          {inModal ? (
            <span className="text-purple-600">לשונית &quot;מדיניות פרטיות&quot;</span>
          ) : (
            <Link href="/privacy" className="text-purple-600 hover:underline">כאן</Link>
          )}.
        </p>
      </section>

      <section className={`${sectionClass} bg-amber-50 border border-amber-200 rounded-xl p-5`}>
        <h2 className="font-display font-bold text-xl text-amber-900 mb-2">
          ⚠️ 8. הסרת אחריות
        </h2>
        <p className="text-gray-800 leading-relaxed mb-2 text-sm">
          <strong>8.1.</strong> השירות ניתן <strong>&quot;כמות שהוא&quot; (As-Is)</strong>, ללא כל
          אחריות מפורשת או משתמעת. החברה אינה מתחייבת שהשירות יהיה רציף, נטול תקלות, או יענה על
          כל צרכי המשתמש.
        </p>
        <p className="text-gray-800 leading-relaxed mb-2 text-sm">
          <strong>8.2.</strong> החברה <strong>אינה אחראית</strong> לתוצאות הנובעות משימוש בשירות,
          לרבות אך לא רק:
        </p>
        <ul className="list-disc pr-6 space-y-1 text-gray-800 mb-2 text-sm">
          <li>נזק עקיף או תוצאתי מכל סוג</li>
          <li>אובדן הכנסות, רווחים, מוניטין או הזדמנויות עסקיות</li>
          <li>אובדן מידע, נתונים או הודעות</li>
          <li>תקלות בשירות WhatsApp, חסימת חשבון על ידי מטא, או שינויים ב-API שלהם</li>
          <li>תוכן שגוי, מטעה או מזיק שנוצר על ידי ה-AI</li>
          <li>החלטות עסקיות שהתקבלו על סמך נתונים מהשירות</li>
          <li>פעולות שביצע הבוט בשם המשתמש (כולל הסרות מקבוצות, מחיקת הודעות וכו&quot;)</li>
        </ul>
        <p className="text-gray-800 leading-relaxed mb-2 text-sm">
          <strong>8.3. אחריות מקסימלית:</strong> בכל מקרה, אחריות החברה כלפי המשתמש לא תעלה על
          סך התשלומים ששילם המשתמש בעבור השירות ב-3 החודשים שקדמו לאירוע.
        </p>
        <p className="text-gray-800 leading-relaxed text-sm">
          <strong>8.4.</strong> המשתמש מאשר שהוא מבין שהשירות מסתמך על שירותי צד שלישי (Green
          API, OpenAI, Anthropic, Supabase, Vercel) וכי תקלות בשירותים אלו אינן באחריות החברה.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
          9. WhatsApp ושירותי צד שלישי
        </h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          9.1. WhatsApp הוא שירות של חברת מטא ואינו בבעלות החברה. השימוש בו כפוף לתנאים של מטא.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          9.2. החברה משתמשת ב-Green API לחיבור לוואטסאפ. החברה אינה מתחייבת לזמינות או יציבות של
          שירותי Green API.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          9.3. המשתמש מאשר שמטא רשאית לחסום, להגביל או לבטל את חשבון הוואטסאפ שלו ללא הודעה
          מוקדמת, והחברה אינה אחראית לכך.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">10. סיום ההתקשרות</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          10.1. המשתמש רשאי לסיים את ההתקשרות בכל עת על ידי ביטול המנוי ומחיקת החשבון.
        </p>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          10.2. החברה רשאית לסיים את ההתקשרות בהודעה מראש של 30 יום, או לאלתר במקרה של הפרת
          התקנון.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          10.3. בעת סיום ההתקשרות, נתוני המשתמש יישמרו 30 יום ולאחר מכן ימחקו לצמיתות (למעט
          נתונים שיש חובה לשמור על פי חוק - חשבוניות, רישומי תשלום וכד&quot;).
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">11. שינויים בתקנון</h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          11.1. החברה רשאית לעדכן את התקנון מעת לעת. עדכונים מהותיים יודעו במייל ובהתראה במערכת.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          11.2. במקרה של עדכון, יידרש המשתמש לאשר את הגרסה החדשה בכניסה הבאה למערכת. אי-אישור
          יביא לחסימת הגישה לשירות.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
          12. סמכות שיפוט וחוק חל
        </h2>
        <p className="text-gray-700 leading-relaxed mb-2 text-sm">
          12.1. על תקנון זה יחול הדין הישראלי בלבד.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          12.2. בכל מחלוקת, סמכות השיפוט הבלעדית תהיה לבתי המשפט המוסמכים בתל אביב.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-2">13. יצירת קשר</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          לכל שאלה, פניה או תלונה ניתן לפנות אלינו דרך:
        </p>
        <ul className="list-disc pr-6 space-y-1 text-gray-700 mt-2 text-sm">
          <li>דוא&quot;ל: <a href="mailto:support@taskflow-ai.com" className="text-purple-600 hover:underline">support@taskflow-ai.com</a></li>
          <li>אתר: <span className="text-purple-600">taskflow-ai.com</span></li>
        </ul>
      </section>

      <section className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-6">
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong>אישור התקנון:</strong> בעת ההרשמה לשירות, המשתמש מאשר שקרא, הבין והסכים לכל
          תנאי התקנון. אישור זה נשמר במערכת לצרכים משפטיים.
        </p>
      </section>
    </div>
  );
}
