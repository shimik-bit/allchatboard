import Link from 'next/link';
import { BookOpen, Rocket, Database, MessageSquare, Shield, HelpCircle, ArrowLeft, Code, Bell } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export const metadata = {
  title: 'מדריך משתמש · AllChatBoard',
  description: 'תיעוד רשמי - איך לעבוד עם המערכת בצורה הטובה ביותר',
};

function buildNav(t: (path: string) => string) {
  return [
    {
      label: t('documentation.section_quickstart'),
      icon: Rocket,
      items: [
        { href: '/docs/getting-started', label: t('documentation.first_5_min') },
        { href: '/docs/getting-started/concepts', label: t('documentation.basic_concepts') },
        { href: '/docs/getting-started/templates', label: t('documentation.business_templates') },
      ],
    },
    {
      label: t('documentation.section_tables'),
      icon: Database,
      items: [
        { href: '/docs/tables', label: t('documentation.creating_tables') },
        { href: '/docs/tables/fields', label: t('documentation.field_types') },
        { href: '/docs/tables/relations', label: t('documentation.linking_tables') },
        { href: '/docs/tables/views', label: t('documentation.views') },
      ],
    },
    {
      label: t('documentation.section_whatsapp'),
      icon: MessageSquare,
      items: [
        { href: '/docs/whatsapp', label: t('documentation.connecting_bot') },
        { href: '/docs/whatsapp/groups', label: t('documentation.managing_groups') },
        { href: '/docs/whatsapp/ai', label: t('documentation.how_ai_works') },
      ],
    },
    {
      label: t('documentation.section_permissions'),
      icon: Shield,
      items: [
        { href: '/docs/permissions', label: t('documentation.workspace_roles') },
        { href: '/docs/permissions/tables', label: t('documentation.table_permissions') },
      ],
    },
    {
      label: t('documentation.section_advanced'),
      icon: Bell,
      items: [
        { href: '/docs/reports', label: t('documentation.scheduled_reports') },
      ],
    },
    {
      label: t('documentation.section_developers'),
      icon: Code,
      items: [
        { href: '/docs/api', label: t('documentation.api_reference') },
      ],
    },
    {
      label: t('documentation.section_help'),
      icon: HelpCircle,
      items: [
        { href: '/docs/faq', label: t('documentation.faq') },
        { href: '/docs/faq/troubleshooting', label: t('documentation.troubleshooting') },
      ],
    },
  ];
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  // Docs are publicly accessible (no workspace context yet) - default to Hebrew
  // Future enhancement: detect from cookie/Accept-Language header
  const { t, dir } = getT('he');
  const NAV = buildNav(t);

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-4">
          <Link href="/docs" className="flex items-center gap-2 hover:opacity-80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 grid place-items-center text-white font-black">
              A
            </div>
            <div>
              <div className="font-display font-bold text-base leading-tight">AllChatBoard</div>
              <div className="text-[10px] text-gray-500 leading-tight">{t('documentation.official_guide')}</div>
            </div>
          </Link>

          <div className="flex-1" />

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-700 font-medium"
          >
            {t('documentation.back_to_app')} {dir === 'rtl' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5 rotate-180" />}
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
              <div className="text-xs font-bold text-purple-900 mb-1">{t('documentation.need_help_title')}</div>
              <div className="text-[11px] text-purple-700 mb-3">
                {t('documentation.need_help_body')}
              </div>
              <a
                href="mailto:support@allchatboard.com"
                className="block w-full py-2 px-3 bg-purple-600 text-white text-center rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
              >
                {t('documentation.contact_us')}
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
