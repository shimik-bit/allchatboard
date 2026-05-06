/**
 * Avatar fetcher
 * ==============
 *
 * Pulls a contact's WhatsApp profile picture URL via Green API and stores it
 * on gg_member_profiles.avatar_url. This is intentionally independent of
 * AI profile extraction — avatars don't require an LLM, just a phone number,
 * and there's no reason to make a 900-profile workspace wait for the AI to
 * run on every member before any of them get a photo.
 *
 * Throttled per profile (default 7 days) so we don't repeatedly hit Green
 * API for users who deliberately have no public picture or whose photos
 * haven't changed.
 *
 * History: previously this logic lived inside profile-extractor.ts and was
 * called only inside the AI extraction success path. Result: 900/901
 * profiles in the user's workspace had never had an avatar fetch attempted
 * because the AI extraction never ran on them (most members didn't have
 * 5+ text messages, so they never went through extractProfile()). This
 * file extracts the avatar logic so it can run independently — driven by
 * the AI extractor when a profile gets extracted, by a backfill endpoint,
 * or by a daily cron.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAvatar } from './green-api-client';

export const AVATAR_REFRESH_DAYS = 7;

export type AvatarFetchOutcome =
  | 'updated' // got a URL, saved it
  | 'no_picture' // Green API said available:false
  | 'throttled' // last fetch within AVATAR_REFRESH_DAYS, skipped
  | 'no_credentials' // workspace has no WhatsApp creds
  | 'error'; // network/API error

/**
 * Fetch + store the avatar for a single profile.
 *
 * Returns an outcome tag (never throws). Always updates avatar_fetched_at
 * even on no_picture so the throttle takes effect for users without a
 * photo, preventing repeated lookups.
 */
export async function fetchAndStoreAvatar(
  supabase: SupabaseClient,
  profile: {
    id: string;
    phone: string;
    workspace_id: string;
    avatar_fetched_at: string | null;
  },
  opts?: {
    /** Force-refetch even if within the 7-day throttle window. */
    force?: boolean;
    /**
     * Pre-fetched workspace credentials. When backfilling many profiles in
     * the same workspace, the caller can avoid one DB round-trip per profile
     * by loading creds once and passing them in.
     */
    credentials?: { instanceId: string; apiToken: string } | null;
  },
): Promise<AvatarFetchOutcome> {
  // Throttle: skip if we fetched recently. Manual triggers can pass
  // force:true to bypass (e.g. user clicks "refresh avatars").
  if (!opts?.force && profile.avatar_fetched_at) {
    const daysSince =
      (Date.now() - new Date(profile.avatar_fetched_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < AVATAR_REFRESH_DAYS) return 'throttled';
  }

  // Get credentials. Caller can short-circuit with a pre-loaded copy.
  let creds = opts?.credentials ?? null;
  if (!creds) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('whatsapp_instance_id, whatsapp_token')
      .eq('id', profile.workspace_id)
      .single();
    if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
      return 'no_credentials';
    }
    creds = {
      instanceId: workspace.whatsapp_instance_id,
      apiToken: workspace.whatsapp_token,
    };
  }

  // chatId for individual contacts is "<phone>@c.us"
  const chatId = profile.phone.includes('@')
    ? profile.phone
    : `${profile.phone}@c.us`;

  let avatarResult;
  try {
    avatarResult = await getAvatar(creds, chatId);
  } catch (err) {
    console.error('[avatar-fetcher] getAvatar threw:', err);
    return 'error';
  }

  // Always update avatar_fetched_at so the throttle works even on misses.
  const update: { avatar_fetched_at: string; avatar_url?: string | null } = {
    avatar_fetched_at: new Date().toISOString(),
  };

  let outcome: AvatarFetchOutcome;
  if (avatarResult.ok && avatarResult.data?.urlAvatar) {
    update.avatar_url = avatarResult.data.urlAvatar;
    outcome = 'updated';
  } else if (avatarResult.ok) {
    // Green API responded successfully but the user has no public picture
    update.avatar_url = null;
    outcome = 'no_picture';
  } else {
    // Network/API error — don't blow away an existing avatar URL on a
    // transient failure. Skip the avatar_url field so it stays as-is.
    return 'error';
  }

  await supabase
    .from('gg_member_profiles')
    .update(update)
    .eq('id', profile.id);

  return outcome;
}

/**
 * Backfill avatars for many profiles in a single workspace.
 *
 * Loads credentials ONCE (rather than per-profile), then iterates with a
 * small inter-request delay to avoid spiking Green API's rate limit.
 *
 * @param maxProfiles  How many to process this run. Caller chooses based
 *                     on serverless function maxDuration. At ~250ms per
 *                     Green API call, 200 profiles ≈ 50s.
 * @param onlyMissing  If true (default), only processes profiles where
 *                     avatar_fetched_at IS NULL. If false, also re-runs
 *                     stale ones past AVATAR_REFRESH_DAYS.
 */
export async function backfillWorkspaceAvatars(opts: {
  supabase: SupabaseClient;
  workspaceId: string;
  maxProfiles?: number;
  onlyMissing?: boolean;
}): Promise<{
  processed: number;
  updated: number;
  no_picture: number;
  throttled: number;
  errors: number;
}> {
  const {
    supabase,
    workspaceId,
    maxProfiles = 200,
    onlyMissing = true,
  } = opts;

  // Load creds once. If there are no creds, we can short-circuit the
  // whole batch instead of failing per-profile.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
    return { processed: 0, updated: 0, no_picture: 0, throttled: 0, errors: 0 };
  }

  const credentials = {
    instanceId: workspace.whatsapp_instance_id as string,
    apiToken: workspace.whatsapp_token as string,
  };

  // Fetch the candidate set. Order by oldest-attempted-first so a partial
  // run still makes progress on the longest-waiting profiles.
  let query = supabase
    .from('gg_member_profiles')
    .select('id, phone, workspace_id, avatar_fetched_at')
    .eq('workspace_id', workspaceId)
    .order('avatar_fetched_at', { ascending: true, nullsFirst: true })
    .limit(maxProfiles);

  if (onlyMissing) {
    query = query.is('avatar_fetched_at', null);
  } else {
    // Get either never-fetched OR stale (older than refresh window)
    const cutoff = new Date(
      Date.now() - AVATAR_REFRESH_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.or(`avatar_fetched_at.is.null,avatar_fetched_at.lt.${cutoff}`);
  }

  const { data: profiles, error } = await query;
  if (error || !profiles) {
    console.error('[avatar-backfill] query failed:', error);
    return { processed: 0, updated: 0, no_picture: 0, throttled: 0, errors: 0 };
  }

  let updated = 0;
  let noPic = 0;
  let throttled = 0;
  let errors = 0;

  for (const profile of profiles) {
    const outcome = await fetchAndStoreAvatar(
      supabase,
      profile as { id: string; phone: string; workspace_id: string; avatar_fetched_at: string | null },
      { credentials, force: !onlyMissing },
    );
    if (outcome === 'updated') updated++;
    else if (outcome === 'no_picture') noPic++;
    else if (outcome === 'throttled') throttled++;
    else if (outcome === 'error') errors++;

    // Small inter-request delay. Green API doesn't publish exact rate limits
    // but their docs warn about bursts. 100ms = 10 req/s, well under any
    // reasonable threshold.
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    processed: profiles.length,
    updated,
    no_picture: noPic,
    throttled,
    errors,
  };
}
