'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ExternalLink,
  Loader2,
  LogOut,
  TriangleAlert,
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';
import SyncConfigsSection from './SyncConfigsSection';

type ConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      email: string;
      pictureUrl?: string;
      connectedAt: string;
      expiresAt: string;
      scopes: string[];
      lastUsedAt?: string;
    };

type Flash = {
  kind: 'connected' | 'error';
  reason: string | null;
  email: string | null;
};

// Friendly messages for each error reason the callback might pass us
const ERROR_LABELS: Record<string, string> = {
  config: 'תצורת השרת אינה מלאה. פנו לתמיכה.',
  missing_params: 'התשובה מגוגל הייתה חסרה. נסו שוב.',
  invalid_state: 'בקשת ההזדהות פגה. נסו שוב.',
  user_mismatch: 'המשתמש שהשלים את ההזדהות אינו המשתמש שיזם אותה.',
  no_workspace_access: 'אין לכם גישה לסביבת העבודה הזו.',
  exchange_failed: 'גוגל סירב להעניק טוקן. נסו שוב.',
  db_failed: 'שמירת ההגדרות נכשלה. פנו לתמיכה.',
  access_denied: 'ביטלתם את ההרשאה. אפשר לחבר שוב בכל זמן.',
};

export default function IntegrationsClient({ flash }: { flash: Flash | null }) {
  const { t, dir } = useT();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(!!flash);

  // ---- Initial status load ----
  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/google/status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ connected: false });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('לנתק את חשבון Google? סנכרון לגיליונות יפסיק.')) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });
      if (res.ok) {
        setStatus({ connected: false });
      } else {
        alert('הניתוק נכשל. נסו שוב.');
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition mb-3"
          >
            {dir === 'rtl' ? (
              <ChevronLeft className="w-4 h-4 rotate-180" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
            הגדרות
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">אינטגרציות</h1>
          <p className="text-sm text-gray-500 mt-1">
            חברו את TaskFlow לכלים חיצוניים כדי לסנכרן נתונים אוטומטית.
          </p>
        </div>

        {/* Flash banner from OAuth callback */}
        {bannerVisible && flash && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
              flash.kind === 'connected'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {flash.kind === 'connected' ? (
              <Check className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 text-sm">
              {flash.kind === 'connected' ? (
                <>
                  <div className="font-medium text-green-900">החיבור הצליח</div>
                  <div className="text-green-700 mt-0.5">
                    מחובר ל-{flash.email ?? 'חשבון Google שלך'}.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-red-900">החיבור נכשל</div>
                  <div className="text-red-700 mt-0.5">
                    {ERROR_LABELS[flash.reason ?? ''] ??
                      `שגיאה: ${flash.reason ?? 'לא ידוע'}`}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setBannerVisible(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Google card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Google logo */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Google Drive ו-Sheets
                  </h2>
                  {status?.connected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                      <Check className="w-3 h-3" />
                      מחובר
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  ייצוא אוטומטי של מצטרפים, לידים, ופעולות בוט לגיליונות Google. שמירת
                  קבצים שעוברים בקבוצות ב-Drive שלכם.
                </p>
              </div>
            </div>

            {/* Connection state */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  טוען סטטוס...
                </div>
              ) : status?.connected ? (
                <ConnectedView
                  status={status}
                  onDisconnect={handleDisconnect}
                  isDisconnecting={isDisconnecting}
                />
              ) : (
                <DisconnectedView />
              )}
            </div>
          </div>

          {status?.connected && (
            <div className="border-t border-gray-100 px-6 py-5 bg-gradient-to-b from-gray-50/50 to-white">
              <SyncConfigsSection />
            </div>
          )}
        </div>

        {/* Coming soon - other integrations placeholder */}
        <div className="mt-6 p-4 bg-white rounded-xl border border-gray-100 border-dashed text-center">
          <p className="text-sm text-gray-400">
            אינטגרציות נוספות בקרוב — Slack, Notion, Microsoft 365...
          </p>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function DisconnectedView() {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="text-sm text-gray-600">
        עדיין לא חיברתם חשבון Google.
      </div>
      <a
        href="/api/integrations/google/connect"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        חברו חשבון Google
      </a>
    </div>
  );
}

function ConnectedView({
  status,
  onDisconnect,
  isDisconnecting,
}: {
  status: Extract<ConnectionStatus, { connected: true }>;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {status.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={status.pictureUrl}
            alt=""
            className="w-10 h-10 rounded-full border border-gray-200"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M12 2a5 5 0 11-.001 10.001A5 5 0 0112 2zm0 12c-3.5 0-10 1.75-10 5.25V22h20v-2.75c0-3.5-6.5-5.25-10-5.25z" />
            </svg>
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-gray-900">{status.email}</div>
          <div className="text-xs text-gray-500">
            מחובר מאז {new Date(status.connectedAt).toLocaleDateString('he-IL')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <Detail
          label="Sheets"
          value="קריאה וכתיבה"
          enabled={status.scopes.some((s) => s.includes('spreadsheets'))}
        />
        <Detail
          label="Drive"
          value="קבצים שיוצרת האפליקציה"
          enabled={status.scopes.some((s) => s.includes('drive.file'))}
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          ניהול הרשאות ב-Google
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={onDisconnect}
          disabled={isDisconnecting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
        >
          {isDisconnecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          ניתוק
        </button>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  enabled,
}: {
  label: string;
  value: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          enabled ? 'bg-green-500' : 'bg-gray-300'
        }`}
      />
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 truncate">{value}</div>
      </div>
    </div>
  );
}
