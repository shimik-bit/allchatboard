import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { Shield, ArrowLeft, Book } from 'lucide-react';
import MarkdownContent from './MarkdownContent';

export const metadata = {
  title: 'מדריך ניהול קבוצות - TaskFlow AI',
  description: 'מדריכים מלאים לניהול קבוצות וואטסאפ, זיהוי ספאם, ובניית פרופילי חברים.',
};

export default function HelpIndex() {
  const docsDir = path.join(process.cwd(), 'public/docs/groupguard');
  const readme = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf8');

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">מדריך ניהול קבוצות</h1>
              <p className="text-sm text-gray-500">כל מה שצריך לדעת על GroupGuard</p>
            </div>
          </div>
          <Link
            href="/dashboard/groupguard"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition border border-gray-200"
          >
            <ArrowLeft className="w-4 h-4" />
            חזרה לדשבורד
          </Link>
        </div>

        {/* Content */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <MarkdownContent>{readme}</MarkdownContent>
        </article>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <Book className="w-3.5 h-3.5" />
          המדריכים מתעדכנים באופן שוטף. יש שאלה שלא נענתה? פנו אלינו.
        </div>
      </div>
    </div>
  );
}
