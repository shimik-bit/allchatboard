'use client';

import { useEffect, useRef } from 'react';

/**
 * WhatsAppAutoRecovery — background recovery trigger.
 *
 * Mounts in the dashboard layout. On every dashboard load, fires a
 * fire-and-forget POST to /api/whatsapp/recover with silent:true. The
 * server-side throttle (SILENT_RECOVERY_MIN_INTERVAL_MS = 5 minutes per
 * instance) protects Green API from being hammered when the user navigates
 * between pages — only one in any 5-minute window actually does work.
 *
 * No UI. Errors are swallowed silently. If anything was recovered, the
 * user sees it on their next manual refresh of the relevant page; we
 * don't toast/alert because this is meant to be invisible plumbing,
 * not an interruption.
 */
export default function WhatsAppAutoRecovery({ workspaceId }: { workspaceId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    // Only fire once per mount even under React StrictMode double-invoke.
    if (fired.current) return;
    fired.current = true;

    if (!workspaceId) return;

    // Tiny delay so this kicks off after the dashboard's own data fetches
    // get their network slot. Recovery doesn't matter if it's a few hundred
    // ms slower; the user-facing page should feel instant.
    const t = setTimeout(() => {
      fetch('/api/whatsapp/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, silent: true }),
        // keepalive lets the request complete even if the user navigates
        // away from the dashboard before the server is done — recovery
        // can take 30s+ when there are many messages to replay.
        keepalive: true,
      }).catch(() => {
        // Silent — this is a best-effort background task. The daily cron
        // is the ultimate safety net for any failures here.
      });
    }, 800);

    return () => clearTimeout(t);
  }, [workspaceId]);

  return null;
}
