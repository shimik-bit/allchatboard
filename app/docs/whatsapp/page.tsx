import Link from 'next/link';

export const metadata = { title: 'חיבור WhatsApp · AllChatBoard' };

export default function WhatsAppDocs() {
  return (
    <article>
      <p className="text-sm text-gray-500 mb-2">WhatsApp ואוטומציות</p>
      <h1>חיבור הבוט שלך</h1>
      <p className="lead">
        השלב שהופך את AllChatBoard ממערכת ניהול ל-CRM אוטומטי שעובד 24/7. החיבור הוא חד-פעמי, וכל ההגדרה לוקחת בערך 5 דקות.
      </p>

      <h2>מה צריך לפני שמתחילים</h2>
      <ul>
        <li>מספר WhatsApp פעיל (יכול להיות הקיים שלך)</li>
        <li>חשבון אצל ספק WhatsApp API. אנחנו ממליצים על <a href="https://green-api.com" target="_blank" rel="noopener noreferrer">Green API</a> - יש להם מסלול חינמי לבדיקה</li>
        <li>5 דקות פנויות</li>
      </ul>

      <h2>שלב א׳ — יצירת Instance ב-Green API</h2>
      <ol>
        <li>הירשם לחשבון ב-<a href="https://green-api.com" target="_blank" rel="noopener noreferrer">green-api.com</a></li>
        <li>במסך הראשי, לחץ <strong>"Create Instance"</strong></li>
        <li>תקבל מסך עם QR Code</li>
        <li>בטלפון: WhatsApp → הגדרות → מכשירים מקושרים → סרוק QR</li>
        <li>תוך כמה שניות הסטטוס יהפוך ל-<strong>Authorized</strong></li>
        <li>שמור את <code>idInstance</code> ו-<code>apiTokenInstance</code> שמופיעים במסך</li>
      </ol>

      <h2>שלב ב׳ — חיבור ב-AllChatBoard</h2>
      <ol>
        <li>במערכת, בתפריט הימני, לחץ על <strong>"WhatsApp"</strong></li>
        <li>הדבק את <code>idInstance</code> בשדה "Instance ID"</li>
        <li>הדבק את <code>apiTokenInstance</code> בשדה "Token"</li>
        <li>לחץ "שמור"</li>
        <li>לחץ "בדוק חיבור" - אמור להופיע סימן ירוק ✓</li>
      </ol>

      <h2>שלב ג׳ — הגדרת Webhook</h2>
      <p>זה החלק שאומר ל-Green API "שלח אלי כל הודעה שנכנסת". בלעדיו - הבוט לא יקבל כלום.</p>

      <ol>
        <li>במסך WhatsApp במערכת תראה שורה עם כתובת ה-Webhook (משהו כמו <code>taskflow-ai.com/api/whatsapp/webhook?workspace=...</code>) - העתק אותה</li>
        <li>חזור ל-Green API → הגדרות Instance</li>
        <li>תחת <strong>"System notifications"</strong> או <strong>"Webhook URL"</strong> הדבק את הכתובת</li>
        <li>סמן את ה-checkbox <code>incomingMessageReceived</code></li>
        <li>שמור</li>
      </ol>

      <div className="callout tip">
        <strong>איך לוודא שזה עובד?</strong>
        <p>שלח לעצמך הודעה לוואטסאפ (מטלפון אחר). חזור ל-AllChatBoard - תוך 5 שניות אמורה להופיע רשומה חדשה באחת הטבלאות.</p>
      </div>

      <h2>בעיות נפוצות</h2>

      <h3>הבוט לא מקבל הודעות</h3>
      <ol>
        <li>בדוק שה-Instance ב-Green API מסומן Authorized</li>
        <li>בדוק שה-Webhook URL מוגדר נכון בעמוד Instance</li>
        <li>בדוק שה-checkbox של incomingMessageReceived מסומן</li>
        <li>במערכת, במסך WhatsApp, גלול למטה ובדוק את לוג ההודעות האחרונות</li>
      </ol>

      <h3>הודעה התקבלה אבל לא נוצרה רשומה</h3>
      <ol>
        <li>בדוק שהמספר ששלח רשום ב"<Link href="/dashboard/phones">אנשים מורשים</Link>"</li>
        <li>בדוק שיש לפחות טבלה אחת לא ארכיונית</li>
        <li>בדוק את "מילות מפתח" של הטבלאות שלך</li>
      </ol>

      <h2>הצעדים הבאים</h2>
      <ul>
        <li><Link href="/docs/whatsapp/groups">ניתוב הודעות מקבוצה לטבלה ספציפית</Link></li>
        <li><Link href="/docs/whatsapp/ai">איך ה-AI מסווג הודעות</Link></li>
        <li><Link href="/docs/tables/fields">הוספת רמזים ל-AI לחילוץ מדויק</Link></li>
      </ul>
    </article>
  );
}
