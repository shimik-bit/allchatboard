'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  User,
  Briefcase,
  Globe,
  MapPin,
  TrendingUp,
  Filter,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Calendar,
  MessageCircle,
  Award,
  X,
  ExternalLink,
  RefreshCw,
  Phone,
  MessageSquareText,
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';
import { resolvePhoneCountry } from '@/lib/utils/phone-country';

// ============================================================================
// Types
// ============================================================================

type Profile = {
  id: string;
  phone: string;
  display_name: string | null;
  full_name: string | null;
  profession: string | null;
  specialization: string | null;
  business_name: string | null;
  business_type: string | null;
  websites: string[] | null;
  city: string | null;
  skills: string[] | null;
  interests: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  completeness_pct: number;
  message_count: number;
  groups_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_extracted_at: string | null;
};

type DetailedProfile = Profile & {
  business_type: string | null;
  social_handles: Record<string, string>;
  languages: string[] | null;
  notable_topics: string[] | null;
  workspace_id: string;
};

type ProfileDetail = {
  profile: DetailedProfile;
  groups: Array<{
    group_id: string;
    group_name: string;
    message_count: number;
    first_seen_at: string;
    last_seen_at: string;
  }>;
  recent_messages: Array<{
    id: string;
    text: string;
    received_at: string;
    group_id: string;
    group_name: string | null;
  }>;
};

type Sort = 'recent' | 'active' | 'complete';


// ============================================================================
// Main component
// ============================================================================

export default function MembersTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useT();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Default to 'complete' (sort by profile completeness DESC) so the most
  // useful, fully-extracted profiles surface at the top — empty profiles
  // (just a phone number, no name/profession) sink to the bottom where
  // they belong. Users can still switch to 'recent' or 'active' from the
  // dropdown. Previous default was 'recent' which buried good profiles
  // under cards full of "?" avatars.
  const [sort, setSort] = useState<Sort>('complete');
  const [groupFilter, setGroupFilter] = useState<string>(''); // '' = all groups
  const [groups, setGroups] = useState<Array<{ id: string; group_name: string | null; member_count?: number }>>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Manual rescan state — separate from the page `loading` flag so the
  // grid stays interactive while the AI extraction runs in the background.
  // `rescanResult` is shown as a transient toast under the button after
  // a run completes; it auto-clears after 6 seconds.
  const [rescanning, setRescanning] = useState(false);
  const [rescanResult, setRescanResult] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Avatar backfill state — kept separate from rescan state because they're
  // independent operations (avatars don't need AI; AI doesn't need avatars).
  // Toast auto-dismisses on the same 6-second timer.
  const [avatarFetching, setAvatarFetching] = useState(false);
  const [avatarResult, setAvatarResult] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  async function handleAvatarBackfill() {
    if (avatarFetching) return;
    setAvatarFetching(true);
    setAvatarResult(null);
    try {
      const res = await fetch('/api/groupguard/profiles/avatars-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setAvatarResult({
          type: 'error',
          text: d.error || 'שגיאה בטעינת תמונות פרופיל',
        });
      } else if (d.processed === 0) {
        setAvatarResult({
          type: 'info',
          text: 'אין פרופילים שדורשים טעינת תמונה. כל התמונות עודכנו ב-7 הימים האחרונים.',
        });
      } else {
        setAvatarResult({
          type: 'success',
          text: `נסרקו ${d.processed} פרופילים: ${d.updated} עם תמונה, ${d.no_picture} ללא תמונה זמינה.`,
        });
        await load();
      }
    } catch (e: any) {
      setAvatarResult({ type: 'error', text: String(e?.message || e) });
    } finally {
      setAvatarFetching(false);
      setTimeout(() => setAvatarResult(null), 6000);
    }
  }

  async function handleRescan() {
    if (rescanning) return;
    setRescanning(true);
    setRescanResult(null);
    try {
      const res = await fetch('/api/groupguard/profiles/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setRescanResult({
          type: 'error',
          text: d.error || t('groupguard.members.rescan_error'),
        });
      } else if (d.processed === 0) {
        // No candidates needed extraction — likely all profiles are fresh
        setRescanResult({
          type: 'info',
          text: t('groupguard.members.rescan_none'),
        });
      } else {
        setRescanResult({
          type: 'success',
          text: t('groupguard.members.rescan_done', {
            processed: d.processed,
            updated: d.updated,
          }),
        });
        // Refresh the grid to show the newly-extracted fields
        await load();
      }
    } catch (e: any) {
      setRescanResult({
        type: 'error',
        text: String(e?.message || e),
      });
    } finally {
      setRescanning(false);
      // Auto-dismiss the toast after 6 seconds
      setTimeout(() => setRescanResult(null), 6000);
    }
  }

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load groups list once for the filter dropdown. We don't include this
  // in the load() function below because groups change rarely and this
  // saves a round-trip on every search/sort/page change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/groupguard/groups?workspace_id=${workspaceId}`);
        const d = await res.json();
        if (cancelled) return;
        // Endpoint returns { groups: [{id, group_name, ...}], ... }
        setGroups(
          (d.groups || []).map((g: any) => ({
            id: g.id,
            group_name: g.group_name,
            member_count: g.member_count,
          })),
        );
      } catch {
        // Non-fatal — dropdown just shows empty list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, search, sort, page, groupFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        sort,
        page: String(page),
      });
      if (search) params.set('q', search);
      if (groupFilter) params.set('group_id', groupFilter);

      const res = await fetch(`/api/groupguard/profiles?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error);
      } else {
        setProfiles(d.profiles || []);
        setTotalPages(d.total_pages || 0);
        setTotal(d.total || 0);
        setError(null);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-600 mb-1">
          {t('groupguard.members.description')}
        </p>
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {t('groupguard.members.auto_update_hint')}
        </p>
      </div>

      {/* Search bar + sort */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('groupguard.members.search_placeholder')}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setPage(0);
            }}
            className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 max-w-[200px]"
          >
            <option value="">{t('groupguard.members.all_groups') || 'כל הקבוצות'}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.group_name || '(ללא שם)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPage(0);
            }}
            className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="complete">{t('groupguard.members.sort_complete')}</option>
            <option value="recent">{t('groupguard.members.sort_recent')}</option>
            <option value="active">{t('groupguard.members.sort_active')}</option>
          </select>
        </div>

        {/* Manual rescan — kicks the AI extraction without waiting for the
            6-hour cron. Disabled while a scan is in progress so users can't
            spam-click it (each click costs OpenAI tokens). */}
        <button
          onClick={handleRescan}
          disabled={rescanning}
          className="flex items-center gap-1.5 px-3 py-2 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={t('groupguard.members.rescan_tooltip')}
        >
          <RefreshCw className={`w-4 h-4 ${rescanning ? 'animate-spin' : ''}`} />
          {rescanning
            ? t('groupguard.members.rescan_running')
            : t('groupguard.members.rescan_button')}
        </button>

        {/* Avatar backfill — fetches WhatsApp profile pics for members who
            don't have one yet. Independent of AI extraction (some workspaces
            have hundreds of members but few text messages, so AI extraction
            never runs on them; their avatars used to stay empty forever). */}
        <button
          onClick={handleAvatarBackfill}
          disabled={avatarFetching}
          className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="טוען תמונות פרופיל מ-WhatsApp עבור חברים שעדיין אין להם תמונה"
        >
          <User className={`w-4 h-4 ${avatarFetching ? 'animate-pulse' : ''}`} />
          {avatarFetching ? 'טוען תמונות...' : 'טען תמונות פרופיל'}
        </button>
      </div>

      {/* Rescan result toast — shown briefly after a manual scan finishes. */}
      {rescanResult && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border ${
            rescanResult.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : rescanResult.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {rescanResult.text}
        </div>
      )}

      {/* Avatar backfill result toast — separate from rescan toast because
          users may run both operations and want to see each result. */}
      {avatarResult && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border ${
            avatarResult.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : avatarResult.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {avatarResult.text}
        </div>
      )}

      {/* Stats + active filter pill — when a group is selected the user
          gets a clear visual reminder of WHICH group they're filtering to,
          plus a one-click way to clear back to "all groups". Without this
          the dropdown is the only signal and it's easy to forget what's
          applied while scrolling. */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-sm text-gray-600">
          {loading ? t('groupguard.members.loading') : t('groupguard.members.total_in_db', { count: total })}
        </div>
        {groupFilter && (
          <button
            onClick={() => {
              setGroupFilter('');
              setPage(0);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-bold hover:bg-purple-200 transition-colors"
            title="הסר סינון"
          >
            <span>📁</span>
            <span className="truncate max-w-[180px]">
              {groups.find((g) => g.id === groupFilter)?.group_name || '(ללא שם)'}
            </span>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Grid */}
      {!loading && profiles.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            {search ? t('groupguard.members.no_results') : t('groupguard.members.no_profiles')}
          </p>
          {!search && (
            <p className="text-xs text-gray-400 mt-1">
              {t('groupguard.members.no_profiles_hint')}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onClick={() => setSelectedProfileId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
            {t('groupguard.members.previous')}
          </button>
          <div className="text-sm text-gray-600">
            {t('groupguard.members.page_of', { page: page + 1, total: totalPages })}
          </div>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {t('groupguard.members.next')}
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedProfileId && (
        <ProfileDetailModal
          profileId={selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
        />
      )}
    </div>
  );
}


// ============================================================================
// Profile card
// ============================================================================

function ProfileCard({
  profile,
  onClick,
}: {
  profile: Profile;
  onClick: () => void;
}) {
  const { t } = useT();
  const displayName = profile.full_name || profile.display_name || `+${profile.phone}`;
  const initials = getInitials(displayName);

  // The card itself is clickable (opens the detail modal), but we also want
  // tel: and wa.me/ shortcuts inside it. <a> inside <button> is invalid HTML,
  // so we use a div + onClick with role=button + Enter key handling instead.
  // The two action <a>s call stopPropagation so clicking them doesn't also
  // open the modal.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="text-right p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all bg-white relative overflow-hidden cursor-pointer"
    >
      {/* Completeness ring (top corner) */}
      <CompletenessRing pct={profile.completeness_pct} />

      <div className="flex items-start gap-3 mb-3">
        <Avatar
          url={profile.avatar_url}
          initials={initials}
          size="md"
        />
        <div className="flex-1 min-w-0 pr-6">
          <div className="font-medium text-gray-900 truncate">
            {displayName}
          </div>
          {profile.profession && (
            <div className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
              <Briefcase className="w-3 h-3" />
              {profile.profession}
            </div>
          )}
          {!profile.profession && (
            <div className="text-xs text-gray-400 truncate" dir="ltr">
              +{profile.phone}
            </div>
          )}
        </div>
      </div>

      {/* Business info */}
      {profile.business_name && (
        <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
          <Globe className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{profile.business_name}</span>
        </div>
      )}

      {/* Bio preview */}
      {profile.bio && (
        <div className="text-xs text-gray-500 line-clamp-2 mb-2">
          {profile.bio}
        </div>
      )}

      {/* Skills/Interests tags */}
      {(profile.skills && profile.skills.length > 0) ||
      (profile.interests && profile.interests.length > 0) ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {(profile.skills || []).slice(0, 3).map((s) => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
              {s}
            </span>
          ))}
          {(profile.interests || []).slice(0, 2).map((i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
              {i}
            </span>
          ))}
        </div>
      ) : null}

      {/* Footer: stats on the start side, contact actions on the end side */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3 text-[10px] text-gray-400 min-w-0">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {profile.message_count}
          </span>
          <span className="flex items-center gap-1">
            <Award className="w-3 h-3" />
            {t('groupguard.members.groups_count', { count: profile.groups_count })}
          </span>
          {profile.city && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {profile.city}
            </span>
          )}
        </div>

        {/* Contact action buttons — stopPropagation prevents the parent card
            click from firing, so a tap on these opens tel: / wa.me directly
            without also bouncing into the profile modal. */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={`tel:+${profile.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 grid place-items-center rounded-full bg-gray-50 hover:bg-purple-100 text-gray-600 hover:text-purple-700 transition-colors"
            title={t('groupguard.members.call_action')}
            aria-label={t('groupguard.members.call_action')}
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <a
            href={`https://wa.me/${profile.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 grid place-items-center rounded-full bg-green-50 hover:bg-green-600 text-green-700 hover:text-white transition-colors"
            title={t('groupguard.members.whatsapp_action')}
            aria-label={t('groupguard.members.whatsapp_action')}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// Completeness ring
// ============================================================================

function CompletenessRing({ pct }: { pct: number }) {
  const { t } = useT();
  const colors =
    pct >= 70 ? 'text-green-600 bg-green-50' :
    pct >= 40 ? 'text-amber-600 bg-amber-50' :
    'text-gray-500 bg-gray-50';

  return (
    <div
      className={`absolute top-2 left-2 w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold ${colors}`}
      title={t('groupguard.members.info_collected', { pct })}
    >
      {pct}%
    </div>
  );
}


// ============================================================================
// Profile Detail Modal
// ============================================================================

function ProfileDetailModal({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const [data, setData] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groupguard/profiles/${profileId}`);
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else setData(d);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="bg-white w-full sm:max-w-2xl max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-lg">{t('groupguard.members.member_profile')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && <div className="text-center py-8 text-gray-500">{t('groupguard.members.loading')}</div>}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {data && <ProfileDetailContent data={data} />}
        </div>
      </div>
    </div>
  );
}


function ProfileDetailContent({ data }: { data: ProfileDetail }) {
  const { t, locale } = useT();
  const p = data.profile;
  const displayName = p.full_name || p.display_name || `+${p.phone}`;
  const initials = getInitials(displayName);
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-US';

  // Country lookup from the phone prefix — used to display flag + country name
  // beside the phone number. Falls back to null if prefix is unrecognized.
  const country = resolvePhoneCountry(p.phone);
  const countryName = country
    ? (locale === 'he' ? country.name : country.nameEn)
    : null;

  // Format phone for display: "+972 55-669-1165" — easier to read than the
  // raw run-on digits. Israeli numbers (10 digits after country code) use
  // the standard 3-3-4 grouping; everything else just gets a +CC space.
  const displayPhone = formatPhoneForDisplay(p.phone);

  return (
    <div className="space-y-5">
      {/* Top section — avatar, name, profession, completeness ring */}
      <div className="flex items-start gap-4">
        <Avatar
          url={p.avatar_url}
          initials={initials}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-gray-900">{displayName}</div>
          {p.profession && (
            <div className="text-sm text-gray-600 mt-1">{p.profession}</div>
          )}
          {p.specialization && (
            <div className="text-sm text-gray-500">{p.specialization}</div>
          )}
        </div>
        <CompletenessRingLarge pct={p.completeness_pct} />
      </div>

      {/* Phone + contact actions — clickable phone (tel:), WhatsApp shortcut,
          country flag/name. Lives in its own card so it reads as a "contact"
          block, not buried under the avatar. */}
      <div className="bg-gradient-to-br from-purple-50/40 to-pink-50/30 border border-purple-100 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Phone link with country prefix */}
          <a
            href={`tel:+${p.phone}`}
            className="flex items-center gap-2 group min-w-0"
            dir="ltr"
          >
            {country && (
              <span className="text-base flex-shrink-0" title={country.nameEn}>
                {country.flag}
              </span>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 group-hover:text-purple-700 transition-colors truncate">
                {displayPhone}
              </div>
              {countryName && (
                <div
                  className="text-[11px] text-gray-500"
                  dir={locale === 'he' ? 'rtl' : 'ltr'}
                >
                  {countryName}
                </div>
              )}
            </div>
          </a>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={`tel:+${p.phone}`}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
              title={t('groupguard.members.call_action')}
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('groupguard.members.call_action')}</span>
            </a>
            <a
              href={`https://wa.me/${p.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
              title={t('groupguard.members.whatsapp_action')}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('groupguard.members.whatsapp_action')}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bio */}
      {p.bio && (
        <Section icon={<User className="w-4 h-4" />} title={t('groupguard.members.bio_title')}>
          <p className="text-sm text-gray-700">{p.bio}</p>
        </Section>
      )}

      {/* Business */}
      {(p.business_name || p.business_type) && (
        <Section icon={<Briefcase className="w-4 h-4" />} title={t('groupguard.members.business_title')}>
          {p.business_name && (
            <div className="text-sm font-medium text-gray-900">{p.business_name}</div>
          )}
          {p.business_type && (
            <div className="text-xs text-gray-500">{p.business_type}</div>
          )}
        </Section>
      )}

      {/* Websites + social */}
      {((p.websites && p.websites.length > 0) ||
        Object.keys(p.social_handles || {}).length > 0) && (
        <Section icon={<Globe className="w-4 h-4" />} title={t('groupguard.members.links_title')}>
          <div className="space-y-1">
            {(p.websites || []).map((url) => (
              <a
                key={url}
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-purple-600 hover:underline"
                dir="ltr"
              >
                {url}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
            {Object.entries(p.social_handles || {}).map(([k, v]) => (
              <div key={k} className="text-sm text-gray-600">
                <span className="font-medium">{k}:</span>{' '}
                <span dir="ltr">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Location */}
      {p.city && (
        <Section icon={<MapPin className="w-4 h-4" />} title={t('groupguard.members.location_title')}>
          <p className="text-sm text-gray-700">{p.city}</p>
        </Section>
      )}

      {/* Skills */}
      {p.skills && p.skills.length > 0 && (
        <Section icon={<Award className="w-4 h-4" />} title={t('groupguard.members.skills_title')}>
          <div className="flex flex-wrap gap-1.5">
            {p.skills.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Interests */}
      {p.interests && p.interests.length > 0 && (
        <Section icon={<Sparkles className="w-4 h-4" />} title={t('groupguard.members.interests_title')}>
          <div className="flex flex-wrap gap-1.5">
            {p.interests.map((i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {i}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Notable topics */}
      {p.notable_topics && p.notable_topics.length > 0 && (
        <Section icon={<TrendingUp className="w-4 h-4" />} title={t('groupguard.members.notable_topics_title')}>
          <div className="flex flex-wrap gap-1.5">
            {p.notable_topics.map((tp) => (
              <span key={tp} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                {tp}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Languages */}
      {p.languages && p.languages.length > 0 && (
        <Section icon={<Globe className="w-4 h-4" />} title={t('groupguard.members.languages_title')}>
          <div className="text-sm text-gray-700">{p.languages.join(', ')}</div>
        </Section>
      )}

      {/* Stats */}
      <Section icon={<TrendingUp className="w-4 h-4" />} title={t('groupguard.members.stats_title')}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t('groupguard.members.messages')} value={p.message_count} locale={locale} />
          <Stat label={t('groupguard.members.groups')} value={p.groups_count} locale={locale} />
          <Stat
            label={t('groupguard.members.activity_days')}
            value={Math.max(1, Math.floor((new Date(p.last_seen_at).getTime() - new Date(p.first_seen_at).getTime()) / (1000 * 60 * 60 * 24)))}
            locale={locale}
          />
        </div>
      </Section>

      {/* Groups */}
      {data.groups.length > 0 && (
        <Section icon={<MessageCircle className="w-4 h-4" />} title={t('groupguard.members.member_of_groups', { count: data.groups.length })}>
          <div className="space-y-1.5">
            {data.groups.slice(0, 10).map((g) => (
              <div key={g.group_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate">{g.group_name}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">{t('groupguard.members.messages_count_label', { count: g.message_count })}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recent messages */}
      {data.recent_messages.length > 0 && (
        <Section icon={<MessageCircle className="w-4 h-4" />} title={t('groupguard.members.recent_messages')}>
          <div className="space-y-2">
            {data.recent_messages.slice(0, 5).map((m) => (
              <div key={m.id} className="text-xs bg-gray-50 rounded p-2">
                <div className="text-gray-700 line-clamp-3">{m.text}</div>
                <div className="text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{new Date(m.received_at).toLocaleString(dateLocale)}</span>
                  {m.group_name && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                        <MessageCircle className="w-2.5 h-2.5" />
                        {m.group_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Footer info */}
      <div className="text-[10px] text-gray-400 text-center border-t border-gray-100 pt-3 flex flex-wrap justify-center gap-2">
        <span>{t('groupguard.members.first_seen')}: {new Date(p.first_seen_at).toLocaleDateString(dateLocale)}</span>
        <span>•</span>
        <span>{t('groupguard.members.last_activity')}: {new Date(p.last_seen_at).toLocaleDateString(dateLocale)}</span>
        {p.last_extracted_at && (
          <>
            <span>•</span>
            <span>{t('groupguard.members.last_ai_analysis')}: {new Date(p.last_extracted_at).toLocaleDateString(dateLocale)}</span>
          </>
        )}
      </div>
    </div>
  );
}


function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}


function Stat({ label, value, locale }: { label: string; value: number; locale?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="text-lg font-bold text-gray-900">{value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US')}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}


function CompletenessRingLarge({ pct }: { pct: number }) {
  const { t } = useT();
  const colors =
    pct >= 70 ? 'text-green-600 bg-green-50 border-green-200' :
    pct >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-gray-500 bg-gray-50 border-gray-200';

  return (
    <div
      className={`flex-shrink-0 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center ${colors}`}
    >
      <div className="text-base font-bold leading-none">{pct}%</div>
      <div className="text-[8px] mt-0.5">{t('groupguard.members.profile_label')}</div>
    </div>
  );
}


// ============================================================================
// Helpers
// ============================================================================

function getInitials(name: string): string {
  if (!name) return '?';
  if (name.startsWith('+')) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format a phone number for human-readable display.
 *
 * Israeli numbers (972 + 9 digits) get nicely grouped:
 *   972556691165 → "+972 55-669-1165"
 * Other countries get a simpler "+CC rest" format since we don't know their
 * local grouping conventions:
 *   14155551234  → "+1 4155551234"
 *
 * The raw digits are preserved in tel:/wa.me links — only the *display* is
 * grouped. Returns the original with a leading "+" if no formatting matches.
 */
function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  // Israeli mobile: 972 + 5X-XXX-XXXX
  if (digits.startsWith('972') && digits.length === 12) {
    return `+972 ${digits.slice(3, 5)}-${digits.slice(5, 8)}-${digits.slice(8)}`;
  }

  // Best-effort generic: try to split off a 1-3 digit country code with a
  // simple heuristic. We don't try to be clever — just give it some breathing
  // room from the rest of the digits.
  const cc = resolvePhoneCountry(digits);
  if (cc) {
    return `+${cc.code} ${digits.slice(cc.code.length)}`;
  }

  return `+${digits}`;
}

/**
 * Avatar — shows the user's WhatsApp profile picture if available, falls back
 * to an initials gradient circle otherwise.
 *
 * Uses an internal "image failed to load" state because Green API URLs can
 * occasionally 403 even after they resolved successfully a moment earlier
 * (CDN auth quirks). When that happens we silently fall back to initials
 * rather than show a broken-image icon.
 */
function Avatar({
  url,
  initials,
  size,
}: {
  url: string | null;
  initials: string;
  size: 'md' | 'lg';
}) {
  const [errored, setErrored] = useState(false);
  const dimensions = size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-12 h-12 text-sm';
  const showImage = url && !errored;

  return (
    <div
      className={`${dimensions} rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={initials}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
