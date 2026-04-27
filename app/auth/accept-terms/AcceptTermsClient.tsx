'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Check,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Lock,
  ScrollText,
} from 'lucide-react';
import TermsContent from '@/components/legal/TermsContent';
import PrivacyContent from '@/components/legal/PrivacyContent';

type DocType = 'terms' | 'privacy';

export default function AcceptTermsClient({
  userEmail,
  version,
  redirectTo,
}: {
  userEmail: string;
  version: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<DocType | null>(null);

  const canSubmit = acceptedTerms && acceptedPrivacy && !loading;

  async function handleAccept() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/terms/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה באישור התקנון');
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בלתי צפויה');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50/30 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/taskflow-logo.png"
            alt="TaskFlow AI"
            className="h-14 w-auto object-contain mx-auto"
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-7 h-7" />
              <h1 className="font-display font-bold text-2xl">
                אישור תקנון ותנאי שימוש
              </h1>
            </div>
            <p className="text-purple-100 text-sm">
              שלום! לפני שנמשיך, אנא קרא ואשר את תנאי השימוש של TaskFlow AI.
            </p>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 grid place-items-center font-bold">
                {userEmail[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-gray-700">מחובר כ:</div>
                <div className="font-medium text-gray-900" dir="ltr">
                  {userEmail}
                </div>
              </div>
            </div>

            {/* Summary of key terms */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 space-y-2">
                  <div className="font-semibold">נקודות חשובות:</div>
                  <ul className="list-disc pr-5 space-y-1">
                    <li>
                      השירות ניתן <strong>&quot;כמות שהוא&quot;</strong> ללא אחריות מפורשת
                    </li>
                    <li>
                      החברה <strong>אינה אחראית</strong> לתוכן AI שגוי או לתוצאות עסקיות
                    </li>
                    <li>
                      <strong>אסור</strong> להשתמש בשירות לספאם או פעולות לא חוקיות
                    </li>
                    <li>WhatsApp הוא שירות של מטא - תקלות שם אינן באחריות החברה</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Document buttons - now open modals */}
            <div className="space-y-2">
              <button
                onClick={() => setOpenModal('terms')}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50/30 transition-colors group text-right"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    תקנון מלא
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 mr-7">
                    גרסה {version} - יפתח בחלון קריאה
                  </div>
                </div>
                <span className="text-sm text-purple-600 font-medium flex items-center gap-1 flex-shrink-0">
                  <ScrollText className="w-4 h-4" />
                  פתח לקריאה
                </span>
              </button>

              <button
                onClick={() => setOpenModal('privacy')}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50/30 transition-colors group text-right"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-600" />
                    מדיניות פרטיות
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 mr-7">
                    מה אנחנו אוספים ומה עושים עם המידע
                  </div>
                </div>
                <span className="text-sm text-purple-600 font-medium flex items-center gap-1 flex-shrink-0">
                  <ScrollText className="w-4 h-4" />
                  פתח לקריאה
                </span>
              </button>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  disabled={loading}
                  className="w-5 h-5 rounded text-purple-600 mt-0.5 cursor-pointer disabled:opacity-50"
                />
                <span className="text-sm text-gray-800 leading-relaxed">
                  קראתי והסכמתי ל
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenModal('terms');
                    }}
                    className="text-purple-600 hover:underline mx-1 font-medium"
                  >
                    תקנון ותנאי השימוש
                  </button>
                  של TaskFlow AI, כולל סעיף הסרת האחריות.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  disabled={loading}
                  className="w-5 h-5 rounded text-purple-600 mt-0.5 cursor-pointer disabled:opacity-50"
                />
                <span className="text-sm text-gray-800 leading-relaxed">
                  קראתי והסכמתי ל
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenModal('privacy');
                    }}
                    className="text-purple-600 hover:underline mx-1 font-medium"
                  >
                    מדיניות הפרטיות
                  </button>
                  ולעיבוד המידע שלי לצורך הפעלת השירות.
                </span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* Action */}
            <div className="pt-2">
              <button
                onClick={handleAccept}
                disabled={!canSubmit}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    שומר...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    אני מאשר/ת והמשך למערכת
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 text-center mt-3">
                האישור שלך יישמר במערכת לצרכים משפטיים יחד עם תאריך וזמן.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          לא הסכמת? אפשר{' '}
          <Link href="/auth/logout" className="text-purple-600 hover:underline">
            להתנתק
          </Link>{' '}
          ולמחוק את החשבון בכל עת.
        </div>
      </div>

      {/* Document Modal */}
      {openModal && (
        <DocumentModal
          docType={openModal}
          onClose={() => setOpenModal(null)}
          onAccept={() => {
            // Auto-tick the corresponding checkbox so the user doesn't
            // have to do it twice
            if (openModal === 'terms') setAcceptedTerms(true);
            if (openModal === 'privacy') setAcceptedPrivacy(true);
            setOpenModal(null);
          }}
          version={version}
        />
      )}
    </main>
  );
}

// ============================================================================
// DocumentModal - displays terms or privacy in scrollable modal
// ============================================================================

function DocumentModal({
  docType,
  onClose,
  onAccept,
  version,
}: {
  docType: DocType;
  onClose: () => void;
  onAccept: () => void;
  version: string;
}) {
  const isTerms = docType === 'terms';

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 grid place-items-center flex-shrink-0">
              {isTerms ? (
                <FileText className="w-5 h-5 text-purple-600" />
              ) : (
                <Lock className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg text-gray-900 truncate">
                {isTerms ? 'תקנון ותנאי שימוש' : 'מדיניות פרטיות'}
              </h2>
              {isTerms && <div className="text-xs text-gray-500">גרסה {version}</div>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 overscroll-contain">
          {isTerms ? <TermsContent inModal /> : <PrivacyContent inModal />}
        </div>

        {/* Sticky footer with action */}
        <div className="px-5 sm:px-6 py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 flex-shrink-0 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            סגור
          </button>
          <button
            onClick={onAccept}
            className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded-lg shadow-md flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            קראתי ואני מאשר/ת
          </button>
        </div>
      </div>
    </div>
  );
}
