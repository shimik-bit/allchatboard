// Public enqueue function — call this from any code path that produces a
// trackable event (group member joined, bot action taken, spam detected,
// etc.) to push it into the Sheets sync queue.
//
// Usage:
//   await enqueueSheetSync('gg_new_member', workspaceId, {
//     ts: new Date().toISOString(),
//     groupId: 'abc',
//     groupName: 'Sales Group',
//     phone: '972501234567',
//     displayName: 'John Doe',
//     ...
//   });
//
// Behaviour:
//   - Looks up the workspace's sync config for that event_type
//   - If no config exists, or it's disabled, returns silently (no-op).
//     The point: callers shouldn't have to check "is this synced" — they
//     just always call enqueue, and if the user opted out, nothing happens.
//   - If a config exists, inserts a row into google_sheet_sync_queue.
//     The worker (cron) will drain it within ~30s.
//
// This function is intentionally non-throwing — sync to Sheets is a
// nice-to-have, not a critical path. Failures are logged.

import { createAdminClient } from '@/lib/supabase/server';
import type { EventType } from './event-schemas';

export async function enqueueSheetSync(
  eventType: EventType,
  workspaceId: string,
  payload: Record<string, any>,
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Is there an enabled config for this workspace + event_type?
    const { data: config } = await admin
      .from('google_sheet_sync_configs')
      .select('id, is_enabled')
      .eq('workspace_id', workspaceId)
      .eq('event_type', eventType)
      .maybeSingle();

    if (!config || !config.is_enabled) {
      // No-op: the user hasn't opted into sync for this event type
      return;
    }

    // Enqueue
    const { error } = await admin
      .from('google_sheet_sync_queue')
      .insert({
        workspace_id: workspaceId,
        config_id: config.id,
        event_type: eventType,
        payload,
        // Other columns default: status='pending', attempts=0, enqueued_at=now()
      });

    if (error) {
      console.error(
        `[enqueueSheetSync] DB insert failed for ${eventType} in workspace ${workspaceId}:`,
        error,
      );
    }
  } catch (err) {
    // Catch-all so callers never fail because of sync issues
    console.error(`[enqueueSheetSync] Unexpected error:`, err);
  }
}
