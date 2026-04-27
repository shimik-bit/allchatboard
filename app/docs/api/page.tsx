import Link from 'next/link';

export const metadata = { title: 'API Reference · AllChatBoard' };

export default function ApiDocs() {
  return (
    <article>
      <p className="text-sm text-gray-500 mb-2">למפתחים</p>
      <h1>AllChatBoard API</h1>
      <p className="lead">
        REST API מלא ליצירה, קריאה, עדכון ומחיקה של רשומות בטבלאות.
        מתאים לחיבור אתרים, אפליקציות, Zapier, Make, ואינטגרציות מותאמות.
      </p>

      <h2>תחילת עבודה (3 צעדים)</h2>
      <ol>
        <li>
          לך ל-<Link href="/dashboard/api-keys">מפתחות API</Link> בלוח הניהול
        </li>
        <li>
          לחץ "מפתח חדש", בחר הרשאות (קריאה / יצירה / עדכון / מחיקה),
          ובחר אילו טבלאות ייחשפו
        </li>
        <li>
          העתק את המפתח (מוצג <strong>פעם אחת בלבד</strong>!) והשתמש בו
          ב-Authorization header בכל בקשה
        </li>
      </ol>

      <h2>אותנטיקציה</h2>
      <p>כל בקשה דורשת header של <code>Authorization</code>:</p>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto" dir="ltr"><code>{`Authorization: Bearer acb_live_abc123def456...`}</code></pre>

      <div className="callout warning">
        <strong>שמור את המפתח בסוד</strong>
        <p>אל תשים את המפתח בקוד frontend (גלוי בדפדפן). השתמש רק בקוד server-side.</p>
      </div>

      <h2>Base URL</h2>
      <pre className="bg-gray-100 p-3 rounded-lg" dir="ltr"><code>https://taskflow-ai.com/api/v1</code></pre>

      <h2>Endpoints</h2>

      <h3>POST /records — יצירת רשומה</h3>
      <p>יוצר רשומה חדשה בטבלה. השדה <code>data</code> מכיל את ערכי השדות לפי slug.</p>

      <h4>דוגמה ב-curl</h4>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`curl -X POST https://taskflow-ai.com/api/v1/records \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "table_id": "abc123-...",
    "data": {
      "name": "דניאל לוי",
      "phone": "0501234567",
      "city": "באר שבע",
      "vehicle_type": "Tesla Model 3"
    }
  }'`}</code></pre>

      <h4>דוגמה ב-JavaScript</h4>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`const response = await fetch('https://taskflow-ai.com/api/v1/records', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.ALLCHAT_TOKEN}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table_id: 'abc123-...',
    data: {
      name: 'דניאל לוי',
      phone: '0501234567'
    }
  })
});
const { record } = await response.json();
console.log('Created record:', record.id);`}</code></pre>

      <h4>דוגמה ב-Python</h4>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`import requests

response = requests.post(
    'https://taskflow-ai.com/api/v1/records',
    headers={'Authorization': f'Bearer {TOKEN}'},
    json={
        'table_id': 'abc123-...',
        'data': {
            'name': 'דניאל לוי',
            'phone': '0501234567'
        }
    }
)
print(response.json())`}</code></pre>

      <h4>תגובה (201 Created)</h4>
      <pre className="bg-gray-100 p-3 rounded-lg text-sm" dir="ltr"><code>{`{
  "record": {
    "id": "rec_xyz789",
    "data": { ... },
    "source": "api",
    "created_at": "2026-04-25T18:30:00Z"
  }
}`}</code></pre>

      <h3>GET /records?table_id=xxx — שליפת רשומות</h3>
      <p>פרמטרים אופציונליים:</p>
      <ul>
        <li><code>limit</code> - מספר רשומות (ברירת מחדל 50, מקסימום 200)</li>
        <li><code>offset</code> - דילוג (לעימוד)</li>
        <li><code>search</code> - חיפוש טקסט חופשי</li>
        <li><code>order_by</code> - סידור לפי שדה (ברירת מחדל: created_at)</li>
        <li><code>order_dir</code> - <code>asc</code> או <code>desc</code></li>
      </ul>

      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`curl "https://taskflow-ai.com/api/v1/records?table_id=abc123&limit=20&search=דניאל" \\
  -H "Authorization: Bearer YOUR_TOKEN"`}</code></pre>

      <h4>תגובה</h4>
      <pre className="bg-gray-100 p-3 rounded-lg text-sm" dir="ltr"><code>{`{
  "records": [...],
  "total": 145,
  "limit": 20,
  "offset": 0
}`}</code></pre>

      <h3>GET /records/&#123;id&#125; — שליפת רשומה אחת</h3>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`curl https://taskflow-ai.com/api/v1/records/rec_xyz789 \\
  -H "Authorization: Bearer YOUR_TOKEN"`}</code></pre>

      <h3>PATCH /records/&#123;id&#125; — עדכון רשומה</h3>
      <p>מעדכן רק את השדות שנשלחים (merge, לא replace). דורש הרשאת update.</p>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`curl -X PATCH https://taskflow-ai.com/api/v1/records/rec_xyz789 \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "data": { "status": "completed" } }'`}</code></pre>

      <h3>DELETE /records/&#123;id&#125; — מחיקת רשומה</h3>
      <p>דורש הרשאת delete.</p>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`curl -X DELETE https://taskflow-ai.com/api/v1/records/rec_xyz789 \\
  -H "Authorization: Bearer YOUR_TOKEN"`}</code></pre>

      <h3>GET /tables — רשימת טבלאות עם schema</h3>
      <p>שימושי לאוטומציות שצריכות לגלות אילו שדות קיימים בכל טבלה.</p>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`curl https://taskflow-ai.com/api/v1/tables \\
  -H "Authorization: Bearer YOUR_TOKEN"`}</code></pre>

      <h4>תגובה</h4>
      <pre className="bg-gray-100 p-3 rounded-lg text-sm" dir="ltr"><code>{`{
  "tables": [
    {
      "id": "abc123-...",
      "name": "לקוחות",
      "slug": "customers",
      "fields": [
        { "slug": "name", "name": "שם מלא", "type": "text", "is_required": true },
        { "slug": "phone", "name": "טלפון", "type": "phone" },
        { "slug": "city", "name": "עיר", "type": "city" },
        {
          "slug": "status",
          "name": "סטטוס",
          "type": "status",
          "options": [
            { "value": "new", "label": "חדש" },
            { "value": "active", "label": "פעיל" }
          ]
        }
      ]
    }
  ]
}`}</code></pre>

      <h2>קודי שגיאה</h2>
      <table>
        <thead>
          <tr><th>קוד</th><th>משמעות</th><th>תיקון</th></tr>
        </thead>
        <tbody>
          <tr><td>200/201</td><td>הצליח</td><td>—</td></tr>
          <tr><td>400</td><td>בקשה לא תקינה</td><td>בדוק שכל השדות החובה נשלחו ושהפורמט תקין</td></tr>
          <tr><td>401</td><td>חסרה אותנטיקציה / מפתח לא תקין</td><td>בדוק את ה-Authorization header</td></tr>
          <tr><td>403</td><td>אין הרשאה לפעולה / לטבלה</td><td>הוסף הרשאה למפתח בלוח הניהול</td></tr>
          <tr><td>404</td><td>רשומה / טבלה לא נמצאה</td><td>בדוק את ה-ID</td></tr>
          <tr><td>500</td><td>שגיאת שרת</td><td>נסה שוב, אם חוזר - פנה לתמיכה</td></tr>
        </tbody>
      </table>

      <h2>פורמט שדות</h2>
      <p>כל ערך בשדה <code>data</code> נשלח לפי הסוג של השדה:</p>
      <table>
        <thead>
          <tr><th>סוג שדה</th><th>פורמט</th><th>דוגמה</th></tr>
        </thead>
        <tbody>
          <tr><td>text / longtext</td><td>string</td><td><code>"שם מלא"</code></td></tr>
          <tr><td>number / currency</td><td>number</td><td><code>15000</code></td></tr>
          <tr><td>date</td><td>string ISO</td><td><code>"2026-04-25"</code></td></tr>
          <tr><td>datetime</td><td>string ISO</td><td><code>"2026-04-25T14:30:00Z"</code></td></tr>
          <tr><td>checkbox</td><td>boolean</td><td><code>true</code></td></tr>
          <tr><td>select / status</td><td>string (value)</td><td><code>"active"</code></td></tr>
          <tr><td>multiselect</td><td>array of strings</td><td><code>["tag1", "tag2"]</code></td></tr>
          <tr><td>phone / email / url / city</td><td>string</td><td><code>"0501234567"</code></td></tr>
          <tr><td>relation</td><td>UUID של רשומה אחרת</td><td><code>"abc123-..."</code></td></tr>
        </tbody>
      </table>

      <h2>מגבלות ושימוש</h2>
      <ul>
        <li>גודל בקשה מקסימלי: 1MB</li>
        <li>limit מקסימלי בקריאת רשומות: 200</li>
        <li>אין כרגע rate limiting קשיח, אבל שימוש חריג ינוטר</li>
        <li>כל הקריאות מתועדות ב-<Link href="/dashboard/api-keys">לוח הניהול → לשונית "בקשות"</Link></li>
      </ul>

      <h2>מקרי שימוש פופולריים</h2>

      <h3>אתר אינטרנט עם טופס פנייה</h3>
      <p>כל פנייה באתר נכנסת ישירות לטבלת "לידים":</p>
      <pre className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr"><code>{`// בקוד האתר (Node.js endpoint, לא frontend!)
app.post('/contact', async (req, res) => {
  await fetch('https://taskflow-ai.com/api/v1/records', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.ALLCHAT_TOKEN}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      table_id: process.env.LEADS_TABLE_ID,
      data: {
        name: req.body.name,
        phone: req.body.phone,
        message: req.body.message
      }
    })
  });
  res.json({ success: true });
});`}</code></pre>

      <h3>חיבור Zapier / Make</h3>
      <p>בחר אקשן "Webhooks → Custom Request → POST", הדבק את ה-URL וה-headers, ו-Zapier יישלח כל אירוע מ-1000+ אפליקציות אחרות.</p>

      <h2>תמיכה</h2>
      <p>
        בעיות? פנה ל-<a href="mailto:support@allchatboard.com">support@allchatboard.com</a>.
        כדאי לצרף את ה-X-Request-ID מהתגובה אם רלוונטי.
      </p>
    </article>
  );
}
