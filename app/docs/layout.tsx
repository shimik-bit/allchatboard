import Link from 'next/link';
import { BookOpen, Rocket, Database, MessageSquare, Shield, HelpCircle, ArrowLeft, Code, Bell } from 'lucide-react';

export const metadata = {
  title: 'מדריך משתמש · AllChatBoard',
  description: 'תיעוד רשמי - איך לעבוד עם המערכת בצורה הטובה ביותר',
};

const NAV = [
  {
    label: 'התחלה מהירה',
    icon: Rocket,
    items: [
      { href: '/docs/getting-started', label: '5 דקות ראשונות' },
      { href: '/docs/getting-started/concepts', label: 'מושגי יסוד' },
      { href: '/docs/getting-started/templates', label: 'תבניות לעסקים' },
    ],
  },
  {
    label: 'טבלאות וניהול נתונים',
    icon: Database,
    items: [
      { href: '/docs/tables', label: 'יצירת טבלאות' },
      { href: '/docs/tables/fields', label: 'סוגי שדות' },
      { href: '/docs/tables/relations', label: 'קישור בין טבלאות' },
      { href: '/docs/tables/views', label: 'תצוגות (טבלה / קנבן / יומן)' },
    ],
  },
  {
    label: 'WhatsApp ואוטומציות',
    icon: MessageSquare,
    items: [
      { href: '/docs/whatsapp', label: 'חיבור הבוט' },
      { href: '/docs/whatsapp/groups', label: 'ניהול קבוצות' },
      { href: '/docs/whatsapp/ai', label: 'איך ה-AI עובד' },
    ],
  },
  {
    label: 'הרשאות וצוות',
    icon: Shield,
    items: [
      { href: '/docs/permissions', label: 'תפקידים בסביבה' },
      { href: '/docs/permissions/tables', label: 'הרשאות לטבלה' },
    ],
  },
  {
    label: 'פיצרים מתקדמים',
    icon: Bell,
    items: [
      { href: '/docs/reports', label: 'דוחות מתוזמנים' },
    ],
  },
  {
    label: 'למפתחים',
    icon: Code,
    items: [
      { href: '/docs/api', label: 'API Reference' },
    ],
  },
  {
    label: 'עזרה ותמיכה',
    icon: HelpCircle,
    items: [
      { href: '/docs/faq', label: 'שאלות נפוצות' },
      { href: '/docs/faq/troubleshooting', label: 'פתרון תקלות' },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-4">
          <Link href="/docs" className="flex items-center gap-2 hover:opacity-80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 grid place-items-center text-white font-black">
              A
            </div>
            <div>
              <div className="font-display font-bold text-base leading-tight">AllChatBoard</div>
              <div className="text-[10px] text-gray-500 leading-tight">מדריך משתמש רשמי</div>
            </div>
          </Link>

          <div className="flex-1" />

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-700 font-medium"
          >
            חזרה למערכת <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
            <nav className="bg-white rounded-xl border border-gray-200 p-3">
              {NAV.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.label} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <Icon className="w-3.5 h-3.5" />
                      {section.label}
                    </div>
                    <ul>
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg transition-colors"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </nav>

            <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="text-xs font-bold text-purple-900 mb-1">צריך עזרה אישית?</div>
              <div className="text-[11px] text-purple-700 mb-3">
                אנחנו כאן לכל שאלה. תגובה תוך 24 שעות.
              </div>
              <a
                href="mailto:support@allchatboard.com"
                className="block w-full py-2 px-3 bg-purple-600 text-white text-center rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
              >
                צור קשר
              </a>
            </div>
          </aside>

          {/* Content */}
          <main className="bg-white rounded-xl border border-gray-200 p-6 md:p-10 prose prose-gray max-w-none rtl-prose">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
