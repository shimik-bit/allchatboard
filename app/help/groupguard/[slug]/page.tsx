import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield, ArrowLeft } from 'lucide-react';
import MarkdownContent from '../MarkdownContent';

// Generate static params for all guide files at build time
export function generateStaticParams() {
  const docsDir = path.join(process.cwd(), 'public/docs/groupguard');
  const files = fs.readdirSync(docsDir);
  return files
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => ({ slug: f.replace(/\.md$/, '') }));
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const docsDir = path.join(process.cwd(), 'public/docs/groupguard');
  const filePath = path.join(docsDir, `${params.slug}.md`);

  // Security: prevent path traversal
  if (!filePath.startsWith(docsDir) || !fs.existsSync(filePath)) {
    notFound();
  }

  const content = fs.readFileSync(filePath, 'utf8');

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <Link
            href="/help/groupguard"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition border border-gray-200"
          >
            <ArrowLeft className="w-4 h-4" />
            כל המדריכים
          </Link>
          <Link
            href="/dashboard/groupguard"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition border border-purple-200"
          >
            <Shield className="w-4 h-4" />
            לדשבורד
          </Link>
        </div>

        {/* Content */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <MarkdownContent>{content}</MarkdownContent>
        </article>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const docsDir = path.join(process.cwd(), 'public/docs/groupguard');
  const filePath = path.join(docsDir, `${params.slug}.md`);

  if (!fs.existsSync(filePath)) {
    return { title: 'מדריך - TaskFlow AI' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[#*`]/g, '').trim() : 'מדריך';

  return {
    title: `${title} - TaskFlow AI`,
    description: 'מדריך מלא לניהול קבוצות וואטסאפ ב-TaskFlow.',
  };
}
