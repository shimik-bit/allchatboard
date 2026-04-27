'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function InviteAcceptClient({
  invitation, token, currentUserEmail,
}: {
  invitation: {
    id: string;
    workspace_id: string;
    workspace_name: string;
    workspace_icon: string | null;
    email: string;
    role: string;
    role_label: string;
    message: string | null;
  };
  token: string;
  currentUserEmail?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!currentUserEmail;
  const emailMismatch = isLoggedIn && currentUserEmail?.toLowerCase() !== invitation.email.toLowerCase();

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה');
        setBusy(false);
        return;
      }
      router.push(`/dashboard`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-pink-50/30 grid place-items-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="inline-block text-4xl mb-3 p-3 rounded-2xl bg-purple-50">
            {invitation.workspace_icon || '📊'}
          </div>
          <h1 className="font-display font-bold text-2xl mb-1">
            הוזמנת ל-{invitation.workspace_name}
          </h1>
          <p className="text-sm text-gray-600">
            התפקיד שלך יהיה: <span className="font-bold text-purple-700">{invitation.role_label}</span>
          </p>
        </div>

        {invitation.message && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-6">
            <p className="text-xs font-bold text-purple-900 mb-1">הודעה אישית:</p>
            <p className="text-sm text-purple-800">{invitation.message}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm">
          <div className="flex justify-between mb-2">
            <span className="text-gray-500">האימייל המוזמן:</span>
            <span className="font-medium">{invitation.email}</span>
          </div>
          {isLoggedIn && (
            <div className="flex justify-between">
              <span className="text-gray-500">אתה מחובר כ:</span>
              <span className={`font-medium ${emailMismatch ? 'text-red-600' : 'text-green-600'}`}>
                {currentUserEmail}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!isLoggedIn ? (
          <Link
            href={`/auth/signup?email=${encodeURIComponent(invitation.email)}&next=/invite/${token}`}
            className="block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-center rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            צור חשבון וקבל את ההזמנה
          </Link>
        ) : emailMismatch ? (
          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
              ⚠️ אתה מחובר עם אימייל אחר. כדי לקבל את ההזמנה, התחבר עם <strong>{invitation.email}</strong>
            </div>
            <Link
              href={`/auth/login?email=${encodeURIComponent(invitation.email)}&next=/invite/${token}`}
              className="block w-full py-3 px-4 bg-purple-600 text-white text-center rounded-xl font-bold hover:bg-purple-700 transition-colors"
            >
              התחבר באימייל הנכון
            </Link>
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={busy}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              'מצרף לסביבה...'
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                אשר וכנס לסביבה
              </>
            )}
          </button>
        )}

        <Link href="/" className="block text-center text-xs text-gray-500 hover:text-gray-700 mt-4">
          ביטול
        </Link>
      </div>
    </div>
  );
}
