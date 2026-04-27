'use client';

/**
 * Cookie Consent Banner
 * ============================================================================
 * Shown to first-time visitors. Stores choice in localStorage.
 * Required by GDPR / Israeli privacy regulations.
 *
 * State stored under key 'taskflow-cookie-consent':
 *   {
 *     version: '1',
 *     timestamp: number,
 *     necessary: true (always),
 *     analytics: boolean,
 *     marketing: boolean,
 *   }
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X, Settings, Check } from 'lucide-react';

const STORAGE_KEY = 'taskflow-cookie-consent';
const CONSENT_VERSION = '1';

interface ConsentChoice {
  version: string;
  timestamp: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // First visit - show banner after small delay (avoid flash)
        const timer = setTimeout(() => setShow(true), 500);
        return () => clearTimeout(timer);
      }
      const parsed = JSON.parse(stored);
      if (parsed.version !== CONSENT_VERSION) {
        // Consent terms updated - re-prompt
        setShow(true);
      }
    } catch {
      // localStorage unavailable or bad data - show banner
      setShow(true);
    }
  }, []);

  function saveChoice(choice: Omit<ConsentChoice, 'version' | 'timestamp' | 'necessary'>) {
    const fullChoice: ConsentChoice = {
      version: CONSENT_VERSION,
      timestamp: Date.now(),
      necessary: true,
      ...choice,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullChoice));
    } catch {
      // localStorage might be disabled
    }
    setShow(false);

    // Notify the rest of the app (e.g., to load analytics scripts)
    window.dispatchEvent(
      new CustomEvent('cookie-consent-updated', { detail: fullChoice }),
    );
  }

  function acceptAll() {
    saveChoice({ analytics: true, marketing: true });
  }

  function rejectAll() {
    saveChoice({ analytics: false, marketing: false });
  }

  function saveCustom() {
    saveChoice({ analytics, marketing });
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">

          {/* Compact view */}
          {!showSettings && (
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 grid place-items-center flex-shrink-0">
                  <Cookie className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-gray-900 mb-1">
                    אנחנו משתמשים ב-Cookies 🍪
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    אנחנו משתמשים ב-cookies כדי שהאתר יעבוד כמו שצריך, לזכור שאתה מחובר, ולהבין איך
                    אנחנו יכולים לשפר את השירות. ניתן לבחור איזה סוגים לאשר.{' '}
                    <Link href="/privacy" className="text-purple-600 hover:underline font-medium">
                      קרא עוד במדיניות הפרטיות
                    </Link>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 order-3 sm:order-1"
                >
                  <Settings className="w-4 h-4" />
                  התאמה אישית
                </button>
                <button
                  onClick={rejectAll}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors order-2"
                >
                  רק הכרחיים
                </button>
                <button
                  onClick={acceptAll}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded-lg shadow-md transition-all order-1 sm:order-3"
                >
                  קבל הכל
                </button>
              </div>
            </div>
          )}

          {/* Settings view */}
          {showSettings && (
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 grid place-items-center">
                    <Settings className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-display font-bold text-gray-900 text-lg">
                    התאמה אישית של Cookies
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="סגור"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                {/* Necessary - always on */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-6 bg-green-500 rounded-full grid place-items-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      Cookies הכרחיים
                      <span className="text-xs text-gray-500 mr-2">(תמיד פעיל)</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      נדרשים להפעלת השירות הבסיסי - התחברות, אבטחה, העדפות שפה
                    </div>
                  </div>
                </div>

                {/* Analytics */}
                <label className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="relative inline-flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-200 peer-checked:bg-purple-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      אנליטיקה ושיפור השירות
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      עוזר לנו להבין איך משתמשים באתר ולשפר אותו (סטטיסטיקות אנונימיות)
                    </div>
                  </div>
                </label>

                {/* Marketing */}
                <label className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="relative inline-flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-200 peer-checked:bg-purple-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      שיווק והתאמה אישית
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      מאפשר לנו להציג תוכן מותאם אישית ולמדוד הצלחת קמפיינים
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={rejectAll}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg"
                >
                  רק הכרחיים
                </button>
                <button
                  onClick={saveCustom}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded-lg shadow-md"
                >
                  שמור העדפות
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
