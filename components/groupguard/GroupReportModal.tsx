'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  X,
  Users,
  Globe2,
  Briefcase,
  MapPin,
  Languages,
  TrendingUp,
  Loader2,
  Sparkles,
  BarChart3,
} from 'lucide-react';

/**
 * GroupReportModal
 * =================
 *
 * Dialog showing aggregated breakdowns for a single group's members:
 * countries, professions, industries, cities, languages, profile-completeness
 * distribution, and a "top active members" leaderboard with avatars.
 *
 * Each breakdown bar is clickable — clicking filters the underlying member
 * list. Currently the filter is local-only (highlights the active filter
 * in the modal); a future iteration will deep-link this back to the
 * MembersTab with the filter pre-applied.
 *
 * Data comes from /api/groupguard/groups/[id]/report — a single round-trip
 * that returns all aggregations + top-N active members. We don't paginate
 * because per-group member counts are bounded (typically <2k) and the
 * payload stays under 100KB even at that size.
 */

type Bucket = { key: string; count: number; meta?: Record<string, unknown> };

type ReportData = {
  group: { id: string; name: string | null };
  summary: {
    total_members: number;
    with_extracted_profile: number;
    with_avatar: number;
    avg_completeness_pct: number;
  };
  breakdowns: {
    countries: Bucket[];
    professions: Bucket[];
    industries: Bucket[];
    cities: Bucket[];
    languages: Bucket[];
    completeness_distribution: Bucket[];
  };
  top_active: Array<{
    profile_id: string;
    name: string;
    phone: string | null;
    avatar_url: string | null;
    profession: string | null;
    message_count: number;
    completeness_pct: number | null;
  }>;
};

type FilterDimension =
  | 'country'
  | 'profession'
  | 'industry'
  | 'city'
  | 'language'
  | null;

export default function GroupReportModal({
  groupId,
  groupName,
  onClose,
}: {
  groupId: string;
  groupName: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Active local filter — stores both which dimension AND which value is
  // selected, e.g. {dim: 'country', value: 'ישראל'}. null = no filter.
  const [filter, setFilter] = useState<{ dim: FilterDimension; value: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/groupguard/groups/${groupId}/report`);
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(d.error || 'שגיאה בטעינת הדוח');
        } else {
          setData(d);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Friendly summary line that explains what's being shown right now.
  // Updates when the user picks a filter so they always know what slice
  // of the data the bars represent.
  const filterDescription = useMemo(() => {
    if (!filter || !data) return null;
    const labels: Record<NonNullable<FilterDimension>, string> = {
      country: 'מדינה',
      profession: 'מקצוע',
      industry: 'תעשייה',
      city: 'עיר',
      language: 'שפה',
    };
    return `${labels[filter.dim!]}: ${filter.value}`;
  }, [filter, data]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-start justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-white shadow">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl">דוח קבוצה</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">
                {groupName || '(ללא שם)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin ml-2" />
              <span>טוען נתוני קבוצה...</span>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={<Users className="w-4 h-4" />}
                  label="סה״כ חברים"
                  value={data.summary.total_members.toLocaleString('he-IL')}
                  color="purple"
                />
                <StatCard
                  icon={<Sparkles className="w-4 h-4" />}
                  label="פרופיל נסרק"
                  value={`${data.summary.with_extracted_profile} / ${data.summary.total_members}`}
                  color="green"
                />
                <StatCard
                  icon={<Users className="w-4 h-4" />}
                  label="עם תמונה"
                  value={`${data.summary.with_avatar} / ${data.summary.total_members}`}
                  color="blue"
                />
                <StatCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="ממוצע השלמה"
                  value={`${data.summary.avg_completeness_pct}%`}
                  color="amber"
                />
              </div>

              {/* Active filter pill — always visible when set, lets the user
                  see + clear without scrolling back to the breakdown. */}
              {filterDescription && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-purple-900">
                    🔍 מסונן ל: {filterDescription}
                  </span>
                  <button
                    onClick={() => setFilter(null)}
                    className="text-xs px-3 py-1 bg-white text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-bold"
                  >
                    הסר סינון
                  </button>
                </div>
              )}

              {/* Top active members — leaderboard with avatars */}
              {data.top_active.length > 0 && (
                <Section title="🔥 החברים הפעילים ביותר" subtitle="לפי כמות הודעות בקבוצה">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {data.top_active.slice(0, 5).map((m, idx) => (
                      <TopMemberCard key={m.profile_id} member={m} rank={idx + 1} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Breakdown grid — country / profession / industry / city /
                  language / completeness in a 2-up layout. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <BreakdownPanel
                  title="פילוח לפי מדינה"
                  icon={<Globe2 className="w-4 h-4" />}
                  buckets={data.breakdowns.countries}
                  total={data.summary.total_members}
                  active={filter?.dim === 'country' ? filter.value : null}
                  onPick={(value) =>
                    setFilter(filter?.dim === 'country' && filter.value === value ? null : { dim: 'country', value })
                  }
                  renderKey={(b) => (
                    <span className="flex items-center gap-1.5">
                      <span>{(b.meta?.flag as string) || '🏳️'}</span>
                      <span>{b.key}</span>
                    </span>
                  )}
                />

                <BreakdownPanel
                  title="פילוח לפי תעשייה"
                  icon={<Briefcase className="w-4 h-4" />}
                  buckets={data.breakdowns.industries}
                  total={data.summary.total_members}
                  active={filter?.dim === 'industry' ? filter.value : null}
                  onPick={(value) =>
                    setFilter(filter?.dim === 'industry' && filter.value === value ? null : { dim: 'industry', value })
                  }
                />

                <BreakdownPanel
                  title="פילוח לפי מקצוע"
                  icon={<Briefcase className="w-4 h-4" />}
                  buckets={data.breakdowns.professions}
                  total={data.summary.total_members}
                  active={filter?.dim === 'profession' ? filter.value : null}
                  onPick={(value) =>
                    setFilter(filter?.dim === 'profession' && filter.value === value ? null : { dim: 'profession', value })
                  }
                />

                <BreakdownPanel
                  title="פילוח לפי עיר"
                  icon={<MapPin className="w-4 h-4" />}
                  buckets={data.breakdowns.cities}
                  total={data.summary.total_members}
                  active={filter?.dim === 'city' ? filter.value : null}
                  onPick={(value) =>
                    setFilter(filter?.dim === 'city' && filter.value === value ? null : { dim: 'city', value })
                  }
                />

                <BreakdownPanel
                  title="פילוח לפי שפה"
                  icon={<Languages className="w-4 h-4" />}
                  buckets={data.breakdowns.languages}
                  total={data.summary.total_members}
                  active={filter?.dim === 'language' ? filter.value : null}
                  onPick={(value) =>
                    setFilter(filter?.dim === 'language' && filter.value === value ? null : { dim: 'language', value })
                  }
                />

                <BreakdownPanel
                  title="פילוח לפי השלמת פרופיל"
                  icon={<Sparkles className="w-4 h-4" />}
                  buckets={data.breakdowns.completeness_distribution}
                  total={data.summary.total_members}
                  // Completeness is informational, not filterable — picking a
                  // bucket like "1-25%" in the filter context doesn't make
                  // sense for the future "filter members" deep-link.
                  active={null}
                  onPick={() => {}}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'purple' | 'green' | 'blue' | 'amber';
}) {
  const colors = {
    purple: 'from-purple-50 to-pink-50 text-purple-700 border-purple-200',
    green: 'from-green-50 to-emerald-50 text-green-700 border-green-200',
    blue: 'from-blue-50 to-sky-50 text-blue-700 border-blue-200',
    amber: 'from-amber-50 to-yellow-50 text-amber-700 border-amber-200',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-3`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-black mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-bold text-base">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function TopMemberCard({
  member,
  rank,
}: {
  member: {
    profile_id: string;
    name: string;
    phone: string | null;
    avatar_url: string | null;
    profession: string | null;
    message_count: number;
    completeness_pct: number | null;
  };
  rank: number;
}) {
  const [imgErrored, setImgErrored] = useState(false);
  const initials = (member.name || '?').charAt(0).toUpperCase();
  const showImage = member.avatar_url && !imgErrored;
  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white hover:border-purple-300 transition-colors">
      <div className="flex items-start gap-2.5">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 grid place-items-center text-white font-bold overflow-hidden">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatar_url!}
                alt={initials}
                className="w-full h-full object-cover"
                onError={() => setImgErrored(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-white border-2 border-purple-200 grid place-items-center text-[10px] font-bold">
            {rankBadge}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate">{member.name}</div>
          {member.profession && (
            <div className="text-[11px] text-gray-500 truncate">{member.profession}</div>
          )}
          <div className="text-[11px] text-purple-700 font-bold mt-1">
            {member.message_count.toLocaleString('he-IL')} הודעות
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({
  title,
  icon,
  buckets,
  total,
  active,
  onPick,
  renderKey,
}: {
  title: string;
  icon: React.ReactNode;
  buckets: Bucket[];
  total: number;
  active: string | null;
  onPick: (value: string) => void;
  renderKey?: (b: Bucket) => React.ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const VISIBLE = 7;
  // Show top N by default with "show more" expansion. For small lists
  // (≤VISIBLE buckets) the toggle is hidden.
  const visibleBuckets = showAll ? buckets : buckets.slice(0, VISIBLE);
  const hiddenCount = buckets.length - visibleBuckets.length;
  const maxCount = buckets[0]?.count || 1;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-purple-600">{icon}</div>
        <h4 className="font-bold text-sm">{title}</h4>
        <span className="text-xs text-gray-400 ml-auto">{buckets.length} ערכים</span>
      </div>
      {buckets.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">אין נתונים</p>
      ) : (
        <div className="space-y-1.5">
          {visibleBuckets.map((b) => {
            const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
            const barWidth = (b.count / maxCount) * 100;
            const isActive = active === b.key;
            return (
              <button
                key={b.key}
                onClick={() => onPick(b.key)}
                className={`w-full text-right rounded-lg px-2 py-1.5 transition-colors group ${
                  isActive
                    ? 'bg-purple-100 ring-1 ring-purple-400'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[11px] text-gray-500 tabular-nums flex-shrink-0">
                    {b.count} ({pct}%)
                  </span>
                  <span className="text-xs truncate font-medium text-gray-800">
                    {renderKey ? renderKey(b) : b.key}
                  </span>
                </div>
                {/* Bar — width is relative to max bucket so the leader
                    always stretches across, smaller buckets are short. */}
                <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      isActive ? 'bg-purple-500' : 'bg-purple-300 group-hover:bg-purple-400'
                    } transition-all`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </button>
            );
          })}
          {hiddenCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center text-xs text-purple-600 hover:text-purple-800 font-bold py-1.5"
            >
              הצג {hiddenCount} נוספים ↓
            </button>
          )}
          {showAll && buckets.length > VISIBLE && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700 py-1.5"
            >
              הצג פחות ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}
