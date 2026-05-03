// Shared helper for hub sub-pages (CRM, RestoBot, BuildBot, etc.) that need
// to resolve "the workspace this user is currently viewing" — and crucially
// to refuse to leak data from a workspace they don't belong to.
//
// The pattern before this helper: each page read a `tf_active_workspace`
// cookie, then queried view tables with createAdminClient() filtered by
// that workspace_id. Two problems:
//   1. The cookie is client-controllable. A user could swap it for any UUID.
//   2. Several pages had a hardcoded UUID fallback to a real production
//      workspace, so visiting with no cookie would land you on someone
//      else's data.
//
// This helper:
//   * Reads the cookie *or* falls back to the user's first workspace.
//   * Verifies the user is actually a member of the resolved workspace.
//   * If not, returns null so the caller can render an empty/forbidden state.

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isValidLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';

export type ResolvedWorkspace = {
  wsId: string;
  locale: Locale;
};

/**
 * Resolve and authorize the active workspace for a hub sub-page.
 * Returns null when:
 *   - the user is not signed in
 *   - the user has no workspaces
 *   - the cookie points to a workspace the user is not a member of
 */
export async function resolveActiveWorkspaceForUser(): Promise<ResolvedWorkspace | null> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // All workspace IDs the user belongs to (RLS-scoped, but we also filter
  // by user_id explicitly as defence in depth).
  const { data: memberships } = await sb
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null);

  const memberIds = (memberships || []).map(
    (m: { workspace_id: string }) => m.workspace_id
  );
  if (memberIds.length === 0) return null;

  // Pick the cookie value if the user is actually a member of that ws,
  // otherwise fall back to their first membership.
  const cookieWsId = cookies().get('tf_active_workspace')?.value;
  const wsId = cookieWsId && memberIds.includes(cookieWsId)
    ? cookieWsId
    : memberIds[0];

  const { data: ws } = await sb
    .from('workspaces')
    .select('locale')
    .eq('id', wsId)
    .maybeSingle();

  const localeRaw = (ws as { locale?: string } | null)?.locale;
  return {
    wsId,
    locale: isValidLocale(localeRaw) ? (localeRaw as Locale) : DEFAULT_LOCALE,
  };
}
