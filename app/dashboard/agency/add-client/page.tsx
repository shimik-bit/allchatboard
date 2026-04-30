'use client';

/**
 * Add Client to Agency
 *
 * Simple form: workspace_code + optional nickname → POST /api/agency/clients
 * → on success, redirect back to the Agency Hub.
 *
 * We use workspace_code as the lookup mechanism (not UUID) because it's the
 * shareable identifier — agency tells client "give me your code", client
 * reads it from their settings page, agency types it here. UUIDs would
 * require copy-paste from a URL, less natural.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Loader2, AlertCircle, Check } from 'lucide-react';

export default function AddClientPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/agency/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_workspace_code: code.trim().toUpperCase(),
          nickname: nickname.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        // Friendly Hebrew error mapping for known codes
        const errMap: Record<string, string> = {
          'workspace not found by that code': 'לא נמצא חלל עבודה עם הקוד הזה',
          'cannot link an agency workspace as a client': 'אי אפשר לקשר סוכנות כלקוח',
          'this workspace is already managed by an agency': 'החלל הזה כבר מנוהל על ידי סוכנות אחרת',
          'current workspace is not an agency': 'החלל הנוכחי אינו סוכנות',
        };
        setError(errMap[json.error] || json.error || 'שגיאה לא צפויה');
        setSubmitting(false);
        return;
      }

      // Success - back to hub. router.refresh() forces a server-component
      // re-render so the new client appears immediately in the list.
      router.push('/dashboard/agency');
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'שגיאת רשת');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white p-5 md:p-8" dir="rtl">
      <div className="max-w-xl mx-auto">
        <Link
          href="/dashboard/agency"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronRight className="w-4 h-4" />
          חזרה לחלל הסוכנות
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">הוספת לקוח חדש</h1>
          <p className="text-sm text-gray-600 mb-6">
            כדי להוסיף לקוח, בקש ממנו את <strong>קוד חלל העבודה</strong> שלו
            (מופיע בדף ההגדרות שלו).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                קוד חלל עבודה של הלקוח
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onBlur={(e) => setCode(e.target.value.trim().toUpperCase())}
                disabled={submitting}
                maxLength={6}
                placeholder="ABC"
                className={`input-field uppercase tracking-wider font-mono text-center max-w-[180px] ${
                  error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''
                }`}
                aria-invalid={!!error}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-gray-500">
                2-6 תווים, אותיות אנגליות גדולות או ספרות.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                כינוי (לא חובה)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={submitting}
                placeholder="למשל: 'לקוח VIP - יוסי כהן'"
                className="input-field"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                כינוי פנימי שיופיע רק לסוכנות שלך — לא משפיע על השם של הלקוח.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-900">{error}</div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting || !code.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {submitting ? 'מקשר...' : 'הוסף לקוח'}
              </button>
              <Link
                href="/dashboard/agency"
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                ביטול
              </Link>
            </div>
          </form>
        </div>

        {/* Help section */}
        <div className="mt-6 bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm">
          <strong className="text-blue-900">איך הלקוח מוצא את הקוד שלו?</strong>
          <ol className="mt-2 mr-4 space-y-1 text-blue-900 list-decimal text-xs">
            <li>הלקוח נכנס לחלל העבודה שלו ב-TaskFlow</li>
            <li>הולך להגדרות (Settings) → "קוד חלל עבודה"</li>
            <li>שולח לך את הקוד (2-6 תווים)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
