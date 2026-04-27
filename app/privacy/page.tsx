import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TERMS_LAST_UPDATED_DISPLAY } from '@/lib/terms/version';
import PrivacyContent from '@/components/legal/PrivacyContent';

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

        <article className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <PrivacyContent />
        </article>

        <div className="text-center mt-8 text-sm text-gray-500">
          © 2026 TaskFlow AI.{' '}
          <Link href="/terms" className="text-purple-600 hover:underline">
            לתקנון המלא
          </Link>
        </div>
      </div>
    </main>
  );
}
