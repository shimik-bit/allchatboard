/**
 * Beauty workspace setup page.
 *
 * Single-purpose page that calls /api/setup/beauty to create the
 * Clients/Appointments/Services tables and seed services. Shows a friendly
 * progress UI while working, then redirects back to /dashboard.
 *
 * The user lands here from the "התקנה מהירה" button on the empty Beauty
 * dashboard. Once the install completes, the dashboard re-renders with
 * the actual data instead of the welcome nudge.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Sparkles, Check, X } from 'lucide-react';
import { useTheme } from '@/lib/themes/ThemeProvider';

type Status = 'ready' | 'installing' | 'success' | 'error';

export default function BeautySetupPage() {
  const router = useRouter();
  const theme = useTheme();
  const [status, setStatus] = useState<Status>('ready');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [created, setCreated] = useState<string[]>([]);
  // Prevent double-click double-install (mainly during the loading state)
  const installingRef = useRef(false);

  async function handleInstall() {
    if (installingRef.current) return;
    installingRef.current = true;
    setStatus('installing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/setup/beauty', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(json.error || 'התקנה נכשלה');
        installingRef.current = false;
        return;
      }

      setCreated(json.created || []);
      setStatus('success');

      // Redirect back to dashboard after a short success display
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1800);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message || 'שגיאת תקשורת');
      installingRef.current = false;
    }
  }

  // Auto-trigger install on first paint - users came here intentionally,
  // no need for a "click to begin" extra step
  useEffect(() => {
    if (status === 'ready') {
      const t = setTimeout(handleInstall, 600); // tiny delay so the UI paints
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div
      className="min-h-full px-5 py-8"
      style={{
        background: 'linear-gradient(135deg, #fdf2ef 0%, #fbe4dd 35%, #f5d5e0 70%, #ede2f0 100%)',
        color: theme.colors.textBody,
      }}
    >
      <div className="max-w-xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100 mb-8 backdrop-blur-sm bg-white/30 px-3 py-1.5 rounded-full"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          חזרה
        </Link>

        <div className="backdrop-blur-md bg-white/60 rounded-3xl p-8 md:p-10 border border-white/60 shadow-2xl shadow-[#e8a4bf]/20">
          {status === 'ready' && (
            <div className="text-center space-y-3">
              <Sparkles className="w-12 h-12 mx-auto" style={{ color: theme.colors.primary }} />
              <h1
                className="text-2xl"
                style={{ fontFamily: theme.typography.displayFont }}
              >
                מתחילים את ההתקנה...
              </h1>
            </div>
          )}

          {status === 'installing' && (
            <div className="text-center space-y-4">
              <div className="relative w-20 h-20 mx-auto">
                <div
                  className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ background: theme.colors.primary }}
                />
                <div
                  className="relative w-20 h-20 rounded-full grid place-items-center text-white"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.primaryDark})`,
                  }}
                >
                  <Sparkles className="w-8 h-8 animate-pulse" />
                </div>
              </div>
              <h1
                className="text-2xl"
                style={{ fontFamily: theme.typography.displayFont }}
              >
                מקימים את הסטודיו שלך ✨
              </h1>
              <p className="text-sm opacity-70">
                יוצרים טבלאות, שדות, וכמה שירותים לדוגמה
              </p>
              <ul className="text-sm space-y-2 max-w-xs mx-auto text-right">
                <li className="flex items-center gap-2 opacity-80">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.colors.primary }} />
                  💖 טבלת לקוחות
                </li>
                <li className="flex items-center gap-2 opacity-80">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.colors.primary }} />
                  📅 טבלת פגישות
                </li>
                <li className="flex items-center gap-2 opacity-80">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.colors.primary }} />
                  ✨ קטלוג שירותים
                </li>
              </ul>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div
                className="w-20 h-20 mx-auto rounded-full grid place-items-center text-white"
                style={{ background: '#10b981' }}
              >
                <Check className="w-10 h-10" />
              </div>
              <h1
                className="text-2xl"
                style={{ fontFamily: theme.typography.displayFont }}
              >
                {created.length === 0 ? 'הכל כבר היה מוכן!' : 'הסטודיו שלך מוכן! 🎉'}
              </h1>
              {created.length > 0 && (
                <p className="text-sm opacity-70">
                  נוצרו {created.length} טבלאות. מעבירים אותך לדשבורד...
                </p>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div
                className="w-20 h-20 mx-auto rounded-full grid place-items-center text-white"
                style={{ background: '#ef4444' }}
              >
                <X className="w-10 h-10" />
              </div>
              <h1
                className="text-2xl"
                style={{ fontFamily: theme.typography.displayFont }}
              >
                משהו השתבש
              </h1>
              <p className="text-sm opacity-70 max-w-sm mx-auto">{errorMsg}</p>
              <button
                onClick={() => {
                  installingRef.current = false;
                  setStatus('ready');
                  handleInstall();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.primaryDark})`,
                }}
              >
                ניסיון חוזר
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
