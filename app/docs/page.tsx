import Link from 'next/link';
import { Rocket, Database, MessageSquare, Shield, ArrowLeft, FileText } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export default function DocsHome() {
  const { t, dir } = getT('he');
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowLeft;
  const arrowRotate = dir === 'rtl' ? '' : 'rotate-180';

  return (
    <div>
      <div className="text-center mb-12 not-prose">
        <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold mb-4">
          📚 {t('documentation.official_guide')}
        </div>
        <h1 className="font-display font-black text-4xl md:text-5xl text-gray-900 mb-3 leading-tight whitespace-pre-line">
          {t('docs_home.title')}
        </h1>
        <p className="text-gray-600 text-lg max-w-xl mx-auto">
          {t('docs_home.subtitle')}
        </p>
      </div>

      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        <FeatureCard
          icon={Rocket}
          title={t('docs_home.card_quickstart_title')}
          desc={t('docs_home.card_quickstart_desc')}
          href="/docs/getting-started"
          color="bg-blue-50 text-blue-700"
          dir={dir}
        />
        <FeatureCard
          icon={MessageSquare}
          title={t('docs_home.card_whatsapp_title')}
          desc={t('docs_home.card_whatsapp_desc')}
          href="/docs/whatsapp"
          color="bg-green-50 text-green-700"
          dir={dir}
        />
        <FeatureCard
          icon={Database}
          title={t('docs_home.card_tables_title')}
          desc={t('docs_home.card_tables_desc')}
          href="/docs/tables"
          color="bg-amber-50 text-amber-700"
          dir={dir}
        />
        <FeatureCard
          icon={Shield}
          title={t('docs_home.card_permissions_title')}
          desc={t('docs_home.card_permissions_desc')}
          href="/docs/permissions"
          color="bg-pink-50 text-pink-700"
          dir={dir}
        />
      </div>

      <h2 className="text-2xl font-display font-black mt-12 mb-4">{t('docs_home.popular_this_week')}</h2>
      <ul className="not-prose space-y-2">
        <PopularLink href="/docs/whatsapp" label={t('docs_home.popular_1')} dir={dir} />
        <PopularLink href="/docs/tables/relations" label={t('docs_home.popular_2')} dir={dir} />
        <PopularLink href="/docs/whatsapp/groups" label={t('docs_home.popular_3')} dir={dir} />
        <PopularLink href="/docs/permissions/tables" label={t('docs_home.popular_4')} dir={dir} />
        <PopularLink href="/docs/faq/troubleshooting" label={t('docs_home.popular_5')} dir={dir} />
      </ul>

      <div className="not-prose mt-12 p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white">
        <div className="flex items-start gap-4">
          <FileText className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-lg mb-1">{t('docs_home.full_pdf_title')}</h3>
            <p className="text-gray-300 text-sm mb-4">
              {t('docs_home.full_pdf_desc')}
            </p>
            <a
              href="/allchatboard-user-guide.pdf"
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 text-gray-900 rounded-lg font-bold text-sm hover:bg-amber-300 transition-colors"
            >
              📄 {t('docs_home.download_pdf')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, desc, href, color, dir,
}: {
  icon: any;
  title: string;
  desc: string;
  href: string;
  color: string;
  dir: 'rtl' | 'ltr';
}) {
  const ArrowIcon = ArrowLeft;
  const rotate = dir === 'ltr' ? 'rotate-180' : '';
  return (
    <Link
      href={href}
      className="group block p-5 bg-white border-2 border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-md transition-all"
    >
      <div className={`inline-flex w-10 h-10 items-center justify-center rounded-lg mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-base mb-1 group-hover:text-purple-700 flex items-center gap-1">
        {title} <ArrowIcon className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${rotate}`} />
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
    </Link>
  );
}

function PopularLink({ href, label, dir }: { href: string; label: string; dir: 'rtl' | 'ltr' }) {
  const rotate = dir === 'ltr' ? 'rotate-180' : '';
  const translate = dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1';
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-purple-50 rounded-lg group transition-colors"
      >
        <span className="text-sm text-gray-700 group-hover:text-purple-700 font-medium">{label}</span>
        <ArrowLeft className={`w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-all ${rotate} ${translate}`} />
      </Link>
    </li>
  );
}
