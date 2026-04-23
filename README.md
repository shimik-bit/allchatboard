# AllChatBoard

SaaS רב-דיירים (multi-tenant) להמרת הודעות WhatsApp לרשומות מובנות בבסיס נתונים, באמצעות AI.

**Live:** https://allchatboard.vercel.app

## מה המערכת עושה

1. משתמש מגדיר "סביבה" (workspace) לעסק שלו, עם **תבניות מוכנות** (מסעדה / נדל״ן / בנייה) או טבלאות מותאמות אישית.
2. מחבר חשבון **Green API** (WhatsApp).
3. מגדיר רשימת **מספרים מורשים** שיכולים לשלוח הודעות למערכת.
4. כל הודעת WhatsApp שנכנסת → AI מסווג אותה לטבלה הנכונה ויוצר רשומה.
5. תגובה ב-WhatsApp על הודעת המערכת ("טופל", "סגור", "שינוי כתובת ל...") → AI מעדכן את הרשומה הקיימת.
6. ניתן גם לעדכן רשומות מהממשק — עדכון סטטוס ל"טופל" שולח הודעת WhatsApp לפונה המקורי.

---

## מבנה הפרויקט

```
allchatboard-app/
├── app/                              # Next.js App Router
│   ├── api/
│   │   ├── records/[id]/update/      # עדכון רשומה + שליחת הודעה למקור
│   │   │   └── route.ts
│   │   └── whatsapp/webhook/         # webhook של Green API
│   │       └── route.ts
│   ├── auth/                         # התחברות / הרשמה
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts
│   ├── dashboard/
│   │   ├── [tableId]/                # צפייה בטבלה עם 3 תצוגות
│   │   │   ├── page.tsx              # server component
│   │   │   └── TableClient.tsx       # client - ניהול state + עדכונים
│   │   ├── phones/                   # ניהול מספרים מורשים
│   │   │   ├── page.tsx
│   │   │   └── PhonesClient.tsx
│   │   ├── settings/                 # הגדרות workspace
│   │   │   ├── page.tsx
│   │   │   └── SettingsClient.tsx
│   │   ├── tables/new/               # יצירת טבלה מותאמת
│   │   │   ├── page.tsx
│   │   │   └── NewTableClient.tsx
│   │   ├── templates/                # הוספת תבנית למערכת קיימת
│   │   │   ├── page.tsx
│   │   │   └── TemplatesClient.tsx
│   │   ├── whatsapp/                 # הגדרת Green API
│   │   │   ├── page.tsx
│   │   │   └── WhatsAppClient.tsx
│   │   ├── layout.tsx                # sidebar + header
│   │   └── page.tsx                  # דף ראשי של הדשבורד
│   ├── onboarding/page.tsx           # בחירת תבניות בהרשמה
│   ├── globals.css                   # Tailwind + עיצוב
│   ├── layout.tsx                    # root layout RTL
│   └── page.tsx                      # landing page
├── components/
│   ├── Sidebar.tsx                   # ניווט צדדי
│   ├── RecordModal.tsx               # עורך רשומה מלא (16 סוגי שדות)
│   ├── RelationCell.tsx              # שדה קשר בין טבלאות
│   └── views/
│       ├── GridView.tsx              # תצוגת טבלה עם inline editing
│       ├── KanbanView.tsx            # תצוגת כרטיסים לפי סטטוס
│       └── CalendarView.tsx          # תצוגת לוח שנה
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Supabase browser client
│   │   └── server.ts                 # Supabase server + admin clients
│   └── types/
│       └── database.ts               # כל ה-TypeScript types
├── middleware.ts                     # SSR auth middleware
├── next.config.js
├── tailwind.config.js                # צבע מותג (#7C3AED) + Heebo
├── postcss.config.js
├── tsconfig.json                     # strict mode
├── vercel.json                       # region: fra1
├── package.json
├── deploy.sh                         # סקריפט עזר לדיפלוי
├── .env.example
└── .gitignore
```

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS (RTL)
- **Backend:** Supabase (Postgres + Auth + RLS + Storage)
- **AI:** OpenAI `gpt-4o-mini` עם JSON mode
- **WhatsApp:** Green API (whitelabel של WhatsApp)
- **Hosting:** Vercel (region: fra1)

---

## משתני סביבה

ב-Vercel צריך להגדיר:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mrdnioqfgtyiyonoaafg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
OPENAI_API_KEY=sk-proj-...
```

ראה `.env.example` לדוגמה מלאה.

---

## מבנה Database

Supabase project: `mrdnioqfgtyiyonoaafg` (Pro plan)

### טבלאות עיקריות

| טבלה | תיאור |
|------|-------|
| `workspaces` | סביבה של לקוח (tenant) |
| `workspace_members` | חברים + תפקיד (owner/admin/editor/viewer) |
| `tables` | טבלאות דינמיות בכל workspace |
| `fields` | שדות של כל טבלה (16 סוגי שדות) |
| `records` | רשומות בטבלאות - `data` הוא `jsonb` |
| `views` | תצוגות שמורות (grid/kanban/calendar) |
| `wa_messages` | כל הודעת WhatsApp נכנסת ויוצאת |
| `whatsapp_groups` | קבוצות WhatsApp פעילות |
| `authorized_phones` | מספרים מורשים (allowlist) |
| `templates` | תבניות עסקים מוכנות |

### Migrations (14 סה״כ)

```
001_enums_and_core_tables
002_dynamic_tables_engine
003_rls_policies
004_seed_templates
005_ai_usage_counter
006_fix_rls_recursion
007_onboarding_rpc
008_authorized_phones_and_reply_threading
009_helper_functions_for_phones_and_tables
010_record_notes_and_creator_tracking
011_rich_templates_restaurant_property_construction
012_multi_template_onboarding
013_assignees_and_audit_tracking
014_relation_field_type
```

### Stored Procedures חשובים

- `create_workspace_with_templates(name, slug, vertical, template_ids[])` — יצירת workspace עם תבניות מרובות
- `install_template_into_workspace(ws_id, template_id)` — התקנת תבנית על workspace קיים
- `add_table_with_fields(...)` — יצירת טבלה מותאמת
- `find_authorized_phone(ws_id, phone)` — בדיקת allowlist ב-webhook
- `is_workspace_admin(ws_id)` + `user_workspace_ids()` — עזר ל-RLS (SECURITY DEFINER למנוע recursion)

---

## זרימת Webhook

```
הודעה נכנסת מ-Green API
    │
    ▼
חילוץ טקסט + quoted_message_id (תמיכה ב-textMessage/extendedText/quotedMessage/reactionMessage)
    │
    ▼
בדיקת allowlist ──→ דחייה אם לא מורשה
    │
    ▼
זיהוי תגובה:
  - אם יש quoted_id או טקסט = "טופל/בוצע/סגור" → חיפוש הרשומה:
    1. התאמה ל-last_wa_message_id
    2. fallback: הרשומה האחרונה מהצ'אט (תוך 2 שעות)
    │
    ▼
  אם נמצאה רשומה → processUpdate():
    - Fast path: "טופל" → מעדכן שדה status אוטומטית (בלי AI)
    - אחרת → AI מחליט איזה שדות לעדכן
    │
    ▼
  אם לא נמצאה → classifyAndInsert():
    - AI מסווג לטבלה ולשדות, ויוצר רשומה חדשה
    │
    ▼
שליחת תגובה ב-WhatsApp + שמירת המזהה על הרשומה
```

---

## פקודות

```bash
# התקנה
npm install

# פיתוח
npm run dev

# בניה
npm run build

# בדיקת TypeScript
npx tsc --noEmit

# דיפלוי ל-Vercel
./deploy.sh
# או:
vercel deploy --prod --yes
```

---

## תצורת Green API

1. יצירת instance ב-[console.green-api.com](https://console.green-api.com/instanceList)
2. סריקת QR code עם הטלפון
3. **חובה להפעיל** ב-Settings → System notifications:
   - ✅ `incomingMessageReceived` (Get notifications of incoming messages and files)
4. הגדרת Webhook URL:
   ```
   https://allchatboard.vercel.app/api/whatsapp/webhook?workspace=<WORKSPACE_ID>
   ```

---

## תבניות זמינות

| Vertical | טבלאות | שדות |
|----------|--------|------|
| 🍽️ **מסעדה** | מלאי, משמרות, הזמנות שולחנות, ספקים, תקלות | 34 |
| 🏢 **ניהול נכסים** | נכסים, שוכרים, תשלומי שכ״ד, תקלות, מועמדים | 35 |
| 🏗️ **בנייה ושיפוצים** | פרויקטים, משימות, חומרים, קבלני משנה, הוצאות | 31 |

---

## נקודות חשובות לתחזוקה

### Green API reply-threading bug
ה-`idMessage` שה-API מחזיר מ-`sendMessage` ≠ ה-stanza id האמיתי שחוזר כש-user עונה.
הפתרון ב-webhook: **fallback של 2 שעות** - אם לא מוצאים התאמה מדויקת ב-`last_wa_message_id`, מחפשים את הרשומה האחרונה מאותו צ'אט.

### Hebrew slug collision
שמות שדות בעברית יכולים לפגוע ב-`UNIQUE(table_id, slug)` - הפתרון ב-`ensureUniqueSlugs()` שמוסיף `_2`, `_3` לslug כפול.

### RLS recursion
מדיניות על `workspace_members` שמביאה מ-`workspace_members` יצרה infinite recursion. הפתרון: עזרים ב-SECURITY DEFINER (`is_workspace_admin`, `user_workspace_ids`).

---

## TODO / עתידי

- [ ] סיבוב tokens שהודלפו בצ'אט
- [ ] הגדרת Supabase Auth URL: Site URL + Redirect URLs ל-allchatboard.vercel.app
- [ ] עוד תבניות: חנות/איקומרס, בעלי מקצוע חופשי, מרפאה, טרנספורט, אירועים
- [ ] הזמנות חברי צוות באימייל
- [ ] דומיין מותאם (allchatboard.co.il)
- [ ] מונה `ai_messages_used` דרך `create_workspace_with_templates` RPC

---

## רישיון

פרטי / קנייני. נכס של Shimik (shimik@best-foru.com).
