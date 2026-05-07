import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { Shield, ArrowLeft, ArrowRight, Book } from 'lucide-react';
import MarkdownContent from './MarkdownContent';

type Props = {
  searchParams: { lang?: string };
};

export function generateMetadata({ searchParams }: Props) {
  const isEn = searchParams.lang === 'en';
  return {
    title: isEn
      ? 'Group Management Guide - TaskFlow AI'
      : 'מדריך ניהול קבוצות - TaskFlow AI',
    description: isEn
      ? 'Complete guides for managing WhatsApp groups, detecting spam, and building member profiles.'
      : 'מדריכים מלאים לניהול קבוצות וואטסאפ, זיהוי ספאם, ובניית פרופילי חברים.',
  };
}

export default function HelpIndex({ searchParams }: Props) {
  const isEn = searchParams.lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';

  const docsDir = isEn
    ? path.join(process.cwd(), 'public/docs/groupguard/en')
    : path.join(process.cwd(), 'public/docs/groupguard');

  const readme = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf8');

  // i18n strings for chrome
  const t = {
    title: isEn ? 'Group Management Guide' : 'מדריך ניהול קבוצות',
    subtitle: isEn ? 'Everything you need to know about GroupGuard' : 'כל מה שצריך לדעת על GroupGuard',
    backToDashboard: isEn ? 'Back to dashboard' : 'חזרה לדשבורד',
    footer: isEn
      ? 'Guides are updated regularly. Question not answered? Reach out to us.'
      : 'המדריכים מתעדכנים באופן שוטף. יש שאלה שלא נענתה? פנו אלינו.',
    switchLang: isEn ? 'עברית' : 'English',
    switchLangHref: isEn ? '/help/groupguard' : '/help/groupguard?lang=en',
  };

  const ArrowIcon = isEn ? ArrowLeft : ArrowRight;

  return (
    <div dir={dir} className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
              <p className="text-sm text-gray-500">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={t.switchLangHref}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition border border-gray-200"
            >
              🌐 {t.switchLang}
            </Link>
            <Link
              href="/dashboard/groupguard"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition border border-gray-200"
            >
              <ArrowIcon className="w-4 h-4" />
              {t.backToDashboard}
            </Link>
          </div>
        </div>

        {/* Content */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <MarkdownContent dir={dir}>{readme}</MarkdownContent>
        </article>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <Book className="w-3.5 h-3.5" />
          {t.footer}
        </div>
      </div>
    </div>
  );
}
