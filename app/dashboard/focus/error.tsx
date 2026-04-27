'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function FocusError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Focus page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 grid place-items-center p-4">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="font-display font-bold text-2xl mb-2">משהו השתבש</h1>
        <p className="text-sm text-gray-600 mb-4">
          הייתה בעיה בטעינת מצב Focus. ננסה שוב?
        </p>
        {error.message && (
          <code className="block text-[10px] bg-red-50 p-3 rounded text-left text-red-700 mb-4 font-mono">
            {error.message}
          </code>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            נסה שוב
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            חזרה לדשבורד
          </Link>
        </div>
      </div>
    </div>
  );
}
