'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactNode } from 'react';

/**
 * MarkdownContent — מציג Markdown עם עיצוב מותאם לעברית/RTL,
 * בלי תלות ב-@tailwindcss/typography.
 */
export default function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <style jsx global>{`
        .markdown-body {
          color: #374151;
          line-height: 1.75;
          font-size: 15px;
        }
        .markdown-body h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 1.5rem 0;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .markdown-body h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin: 2.5rem 0 1rem 0;
        }
        .markdown-body h3 {
          font-size: 1.2rem;
          font-weight: 600;
          color: #1f2937;
          margin: 2rem 0 0.75rem 0;
        }
        .markdown-body h4 {
          font-size: 1.05rem;
          font-weight: 600;
          color: #374151;
          margin: 1.5rem 0 0.5rem 0;
        }
        .markdown-body p {
          margin: 0 0 1rem 0;
        }
        .markdown-body strong {
          font-weight: 700;
          color: #111827;
        }
        .markdown-body em {
          font-style: italic;
        }
        .markdown-body a {
          color: #7c3aed;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .markdown-body a:hover {
          border-bottom-color: #7c3aed;
        }
        .markdown-body ul,
        .markdown-body ol {
          margin: 0 0 1rem 0;
          padding-inline-start: 1.5rem;
        }
        .markdown-body li {
          margin: 0.25rem 0;
        }
        .markdown-body ul {
          list-style-type: disc;
        }
        .markdown-body ol {
          list-style-type: decimal;
        }
        .markdown-body blockquote {
          margin: 1rem 0;
          padding: 0.75rem 1rem;
          background: #faf5ff;
          border-inline-start: 4px solid #a855f7;
          border-radius: 0.375rem;
          color: #6b21a8;
        }
        .markdown-body blockquote p:last-child {
          margin-bottom: 0;
        }
        .markdown-body code {
          background: #f3f0ff;
          color: #6d28d9;
          padding: 0.15rem 0.4rem;
          border-radius: 0.25rem;
          font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
          font-size: 0.875em;
        }
        .markdown-body pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .markdown-body pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .markdown-body hr {
          margin: 2rem 0;
          border: none;
          border-top: 1px solid #e5e7eb;
        }
        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.9rem;
        }
        .markdown-body table th,
        .markdown-body table td {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          text-align: start;
        }
        .markdown-body table th {
          background: #f9fafb;
          font-weight: 600;
          color: #111827;
        }
        .markdown-body table tr:nth-child(even) td {
          background: #fafbfc;
        }
        .markdown-body img {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
      `}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
