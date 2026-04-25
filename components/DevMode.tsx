'use client';

import { useState } from 'react';
import { useDevMode } from '@/lib/hooks/useDevMode';
import { Wrench, AlertTriangle, X, Lock, Unlock, Clock } from 'lucide-react';

/**
 * DevModeOnly — wrapper that only renders children when dev mode is enabled.
 * Use for destructive UI (delete buttons, danger zones, etc.)
 */
export function DevModeOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { enabled } = useDevMode();
  if (!enabled) return <>{fallback || null}</>;
  return <>{children}</>;
}

/**
 * DevModeIndicator — orange banner shown at the top of every dashboard page
 * when dev mode is on. Reminds the user that destructive actions are unlocked.
 */
export function DevModeIndicator() {
  const { enabled, minutesRemaining, disable } = useDevMode();
  if (!enabled) return null;

  return (
    <div
      className="sticky top-0 z-40 bg-gradient-to-l from-amber-500 to-orange-500 text-white px-4 py-2 shadow-md"
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <Wrench className="w-4 h-4 flex-shrink-0 animate-pulse" />
        <span className="flex-1 font-medium">
          <strong>מצב מפתח פעיל</strong>
          <span className="opacity-90 mr-2">— פעולות הרסניות זמינות. השתמש בזהירות!</span>
        </span>
        <span className="hidden md:inline-flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-0.5">
          <Clock className="w-3 h-3" />
          נכבה אוטומטית בעוד {minutesRemaining} דק׳
        </span>
        <button
          onClick={disable}
          className="text-xs bg-white/20 hover:bg-white/30 rounded-md px-2.5 py-1 font-medium transition-colors"
        >
          כבה עכשיו
        </button>
      </div>
    </div>
  );
}

/**
 * DevModeToggle — the button users click to enable/disable dev mode.
 * Includes a confirmation modal on enable.
 */
export function DevModeToggle({ compact }: { compact?: boolean }) {
  const { enabled, toggle, minutesRemaining } = useDevMode();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    if (enabled) {
      toggle(); // disable - no confirmation needed
    } else {
      setShowConfirm(true);
    }
  }

  function handleConfirm() {
    setShowConfirm(false);
    toggle();
  }

  if (compact) {
    return (
      <>
        <button
          onClick={handleClick}
          title={enabled ? 'מצב מפתח פעיל - לחץ לכיבוי' : 'הפעל מצב מפתח'}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            enabled
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {enabled ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          <span>{enabled ? `מפתח (${minutesRemaining}׳)` : 'מצב מפתח'}</span>
        </button>
        {showConfirm && <DevModeConfirmModal onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
          enabled
            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
        }`}
      >
        <span className="flex items-center gap-2">
          {enabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span>מצב מפתח</span>
        </span>
        {enabled && (
          <span className="text-[11px] bg-amber-200 text-amber-800 rounded-full px-2 py-0.5">
            פעיל · {minutesRemaining}׳
          </span>
        )}
      </button>
      {showConfirm && <DevModeConfirmModal onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)} />}
    </>
  );
}

/**
 * Confirmation dialog shown when enabling dev mode.
 */
function DevModeConfirmModal({
  onConfirm, onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-l from-amber-50 to-orange-50 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 grid place-items-center text-white">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">להפעיל מצב מפתח?</h2>
              <p className="text-xs text-amber-800/80">פעולה רגישה — קרא לפני שתאשר</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-700">
            מצב מפתח פותח גישה לפעולות שעלולות <strong>לגרום לאיבוד נתונים</strong>:
          </p>
          <ul className="text-sm text-gray-700 space-y-1.5 pr-4 mr-2 border-r-2 border-amber-300">
            <li>🗑️ מחיקת שדות ועמודות (כולל הנתונים שבהם)</li>
            <li>🗂️ מחיקת/ארכיון טבלאות</li>
            <li>👥 הסרת חברים מסביבת העבודה</li>
            <li>📱 שינוי הגדרות WhatsApp ואינטגרציות</li>
            <li>🔐 שינוי הרשאות גישה</li>
            <li>🌍 מחיקת סביבת עבודה שלמה</li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <strong className="block mb-1">⏱️ נכבה אוטומטית אחרי 30 דקות אי-פעילות</strong>
            תמיד תוכל לכבות ידנית מהבאנר הכתום בראש הדף.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm">ביטול</button>
          <button
            onClick={onConfirm}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            הפעל מצב מפתח
          </button>
        </div>
      </div>
    </div>
  );
}
