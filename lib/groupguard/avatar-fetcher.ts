/**
 * Avatar + name fetcher
 * =====================
 *
 * Pulls both the contact's display name AND profile picture URL via Green
 * API's getContactInfo (one round-trip instead of two), then stores them
 * on gg_member_profiles. Independent of AI profile extraction — name and
 * avatar don't require an LLM.
 *
 * Throttled per profile (default 7 days).
 *
 * History: started life as just an avatar fetcher (PR #73 / #89). Extended
 * to fetch names too after observing that 1453/1454 profiles in a real
 * workspace had no display_name — they'd been bulk-upserted from group
 * member scans (which only provide phone numbers) and never reached any
 * other code path that would populate names.
 *
 * Caveats on name availability:
 *   - WhatsApp privacy: getContactInfo only returns 'name' for contacts
 *     YOU have saved + verified business accounts. For arbitrary group
 *     members it usually returns empty strings.
 *   - Better source for anyone who has SENT a message: wa_messages.sender_name
 *     (the WhatsApp pushname, included in every message envelope). The
 *     SQL backfill migration handles that case in bulk.
 *   - Combining both sources gets us the maximum coverage. Neither alone
 *     is enough.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getContactInfo } from './green-api-client';

export const AVATAR_REFRESH_DAYS = 7;

export type AvatarFetchOutcome =
  | 'updated' // got useful info, saved it
  | 'no_picture' // contactInfo returned nothing useful
  | 'throttled' // last fetch within AVATAR_REFRESH_DAYS, skipped
  | 'no_credentials' // workspace has no WhatsApp creds
  | 'error'; // network/API error

/**
 * Fetch + store name AND avatar for a single profile via getContactInfo.
 *
 * Returns an outcome tag (never throws). Always updates avatar_fetched_at
 * even when no new data was returned, so the throttle prevents repeated
 * empty lookups.
 *
 * Field-update semantics:
 *   - avatar_url → updated whenever Green API returns one (overwrites stale)
 *   - display_name → only set when CURRENTLY NULL/empty AND Green API
 *                    returned a name. Won't clobber a name we already have
 *                    from sender_name or AI extraction.
 */
export async function fetchAndStoreAvatar(
  supabase: SupabaseClient,
  profile: {
    id: string;
    phone: string;
    workspace_id: string;
    avatar_fetched_at: string | null;
    display_name?: string | null;
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
  if (!opts?.force && profile.avatar_fetched_at) {
    const daysSince =
      (Date.now() - new Date(profile.avatar_fetched_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < AVATAR_REFRESH_DAYS) return 'throttled';
  }

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

  const chatId = profile.phone.includes('@')
    ? profile.phone
    : `${profile.phone}@c.us`;

  let info;
  try {
    info = await getContactInfo(creds, chatId);
  } catch (err) {
    console.error('[avatar-fetcher] getContactInfo threw:', err);
    return 'error';
  }

  if (!info.ok) {
    return 'error';
  }

  const update: {
    avatar_fetched_at: string;
    avatar_url?: string | null;
    display_name?: string;
  } = {
    avatar_fetched_at: new Date().toISOString(),
  };

  // Avatar handling — overwrite when we got one, leave alone when we didn't
  // (don't blow away a previously-fetched URL just because today's response
  // happened to be empty).
  if (info.data?.avatarUrl) {
    update.avatar_url = info.data.avatarUrl;
  }

  // Name handling — only fill in if we don't already have a display_name.
  // The 'contactName' field (your local saved name) is preferred over 'name'
  // (WhatsApp display name) when both are present, since contactName implies
  // an actual relationship rather than a stranger.
  const fetchedName = info.data?.contactName || info.data?.name || null;
  const hasExistingName =
    profile.display_name && profile.display_name.trim().length > 0;
  if (fetchedName && !hasExistingName) {
    update.display_name = fetchedName;
  }

  // Determine outcome before writing
  let outcome: AvatarFetchOutcome;
  if (update.avatar_url || update.display_name) {
    outcome = 'updated';
  } else {
    outcome = 'no_picture';
  }

  await supabase
    .from('gg_member_profiles')
    .update(update)
    .eq('id', profile.id);

  return outcome;
}

/**
 * Backfill avatars + names for many profiles in a single workspace.
 *
 * Loads credentials ONCE, then iterates with a small inter-request delay
 * to avoid spiking Green API's rate limit.
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

  // Need display_name in the select now (used for the "don't clobber"
  // check inside fetchAndStoreAvatar).
  let query = supabase
    .from('gg_member_profiles')
    .select('id, phone, workspace_id, avatar_fetched_at, display_name')
    .eq('workspace_id', workspaceId)
    .order('avatar_fetched_at', { ascending: true, nullsFirst: true })
    .limit(maxProfiles);

  if (onlyMissing) {
    query = query.is('avatar_fetched_at', null);
  } else {
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
      profile as {
        id: string;
        phone: string;
        workspace_id: string;
        avatar_fetched_at: string | null;
        display_name: string | null;
      },
      { credentials, force: !onlyMissing },
    );
    if (outcome === 'updated') updated++;
    else if (outcome === 'no_picture') noPic++;
    else if (outcome === 'throttled') throttled++;
    else if (outcome === 'error') errors++;

    // Inter-request delay (Green API rate-limit hygiene)
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
