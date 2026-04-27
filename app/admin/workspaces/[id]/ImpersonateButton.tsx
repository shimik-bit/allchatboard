'use client';

import { useState } from 'react';
import { Eye, AlertTriangle } from 'lucide-react';

export default function ImpersonateButton({
  targetUserId, targetEmail, workspaceId,
}: {
  targetUserId: string;
  targetEmail: string;
  workspaceId: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleImpersonate() {
    if (!reason.trim() || reason.length < 5) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          target_email: targetEmail,
          workspace_id: workspaceId,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('כשל: ' + (data.error || 'לא ניתן להיכנס כמשתמש'));
        setBusy(false);
        return;
      }
      // Redirect to the magic link OR open in new tab
      if (data.magic_link) {
        window.open(data.magic_link, '_blank');
        setShowModal(false);
        setBusy(false);
      }
    } catch (err: any) {
      alert('שגיאה: ' + err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded transition-colors flex items-center gap-1"
        title="היכנס כמשתמש זה"
      >
        <Eye className="w-3 h-3" />
        Impersonate
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-lg text-slate-100">פעולה רגישה</h3>
            </div>
            <p className="text-sm text-slate-300 mb-1">
              אתה עומד להיכנס כ-<span className="font-bold text-amber-400">{targetEmail}</span>
            </p>
            <p className="text-xs text-slate-400 mb-4">
              הפעולה תירשם בלוג audit עם השעה, IP, וסיבה. השאר מקצועי.
            </p>

            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              סיבה לכניסה <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="לדוגמה: דיבוג בעיית שמירת רשומות שדווחה"
              rows={3}
              className="w-full text-sm p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 mb-4 focus:outline-none focus:border-amber-500/50"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                disabled={busy}
              >
                ביטול
              </button>
              <button
                onClick={handleImpersonate}
                disabled={busy || reason.trim().length < 5}
                className="px-3 py-1.5 text-xs bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 rounded disabled:opacity-50"
              >
                {busy ? '...' : 'אשר וכנס'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
