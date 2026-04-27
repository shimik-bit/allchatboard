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
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

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
  const [sort, setSort] = useState<Sort>('recent');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, search, sort, page]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        sort,
        page: String(page),
      });
      if (search) params.set('q', search);

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
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPage(0);
            }}
            className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="recent">{t('groupguard.members.sort_recent')}</option>
            <option value="active">{t('groupguard.members.sort_active')}</option>
            <option value="complete">{t('groupguard.members.sort_complete')}</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600">
        {loading ? t('groupguard.members.loading') : t('groupguard.members.total_in_db', { count: total })}
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

  return (
    <button
      onClick={onClick}
      className="text-right p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all bg-white relative overflow-hidden"
    >
      {/* Completeness ring (top corner) */}
      <CompletenessRing pct={profile.completeness_pct} />

      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
          {initials}
        </div>
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

      {/* Footer stats */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-2 border-t border-gray-100">
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
    </button>
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

  return (
    <div className="space-y-5">
      {/* Top section */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-medium text-2xl flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-gray-900">{displayName}</div>
          {p.profession && (
            <div className="text-sm text-gray-600 mt-1">{p.profession}</div>
          )}
          {p.specialization && (
            <div className="text-sm text-gray-500">{p.specialization}</div>
          )}
          <div className="text-xs text-gray-400 mt-1" dir="ltr">+{p.phone}</div>
        </div>
        <CompletenessRingLarge pct={p.completeness_pct} />
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
                <div className="text-gray-400 mt-1">
                  {new Date(m.received_at).toLocaleString(dateLocale)}
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
