import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PrivacyContentEn from '@/components/legal/PrivacyContentEn';

export const metadata = {
  title: 'Privacy Policy - TaskFlow AI',
  description: 'TaskFlow AI privacy policy and data protection practices.',
};

const LAST_UPDATED_EN = 'May 13, 2026';

export default function PrivacyPageEn() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="ltr">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/taskflow-logo.png" alt="TaskFlow AI" className="h-10 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-gray-900">
              עברית
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/" className="hover:text-gray-900 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl text-gray-900 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">
            Last updated: {LAST_UPDATED_EN}
          </p>
        </div>

        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <PrivacyContentEn />
        </article>

        <div className="mt-8 text-center text-xs text-gray-400">
          AllChat J4U Ltd. · Israeli company number 515738813 · Petah Tikva, Israel
        </div>
      </div>
    </main>
  );
}
