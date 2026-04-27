import Link from 'next/link';
import {
  MessageSquare, Sparkles, LayoutGrid, Zap,
  Users, Shield, Search, BarChart3, Award,
  Trash2, UserX, Crown, Check, X, ArrowLeft,
  Briefcase, Globe, Bell,
} from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export default function HomePage() {
  const { t, dir } = getT('he');
  const ArrowDir = ArrowLeft;
  const arrowRotate = dir === 'rtl' ? '' : 'rotate-180';

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-brand-50/30" dir={dir}>
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/taskflow-logo.png"
              alt="TaskFlow AI"
              className="h-12 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-3">
            <a href="#groupguard" className="hidden sm:inline text-sm text-gray-600 hover:text-purple-600 transition-colors">
              {t('home.nav_protection')}
            </a>
            <Link href="/auth/login" className="btn-ghost">{t('auth.login')}</Link>
            <Link href="/auth/signup" className="btn-primary">{t('home.cta_start_free')}</Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          {t('home.hero_badge')}
        </div>
        <h1 className="font-display font-bold text-5xl md:text-7xl leading-tight mb-6">
          {t('home.hero_title_part1')}
          <br />
          <span className="bg-gradient-to-l from-brand-600 to-purple-500 bg-clip-text text-transparent">
            {t('home.hero_title_part2')}
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          {t('home.hero_description')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/auth/signup" className="btn-primary text-base px-6 py-3">
            {t('home.cta_start_trial_14_days')}
          </Link>
          <Link href="#features" className="btn-secondary text-base px-6 py-3">
            {t('home.cta_how_it_works')}
          </Link>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<MessageSquare className="w-6 h-6" />}
          title={t('home.feature1_title')}
          desc={t('home.feature1_desc')}
        />
        <FeatureCard
          icon={<Sparkles className="w-6 h-6" />}
          title={t('home.feature2_title')}
          desc={t('home.feature2_desc')}
        />
        <FeatureCard
          icon={<LayoutGrid className="w-6 h-6" />}
          title={t('home.feature3_title')}
          desc={t('home.feature3_desc')}
        />
      </section>

      {/* GroupGuard + Member Profiles section */}
      <section id="groupguard" className="bg-gradient-to-b from-purple-50/40 via-white to-pink-50/30 py-20 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
              <Shield className="w-4 h-4" />
              {t('home.gg_badge')}
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
              <span className="bg-gradient-to-l from-purple-600 to-pink-500 bg-clip-text text-transparent">
                {t('home.gg_title_part1')}
              </span>{' '}
              {t('home.gg_title_part2')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('home.gg_description')}
            </p>
          </div>

          {/* Two pricing tiers based on bot permissions */}
          <div className="grid md:grid-cols-2 gap-6 mb-14">
            {/* Tier 1: Member */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3">
                    <Users className="w-3 h-3" />
                    {t('home.tier_member_badge')}
                  </div>
                  <h3 className="font-display font-bold text-2xl">
                    {t('home.tier_member_title')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('home.tier_member_subtitle')}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 grid place-items-center text-blue-600 flex-shrink-0">
                  <Users className="w-7 h-7" />
                </div>
              </div>

              <ul className="space-y-3 mb-2">
                <BotFeature
                  icon={<Briefcase className="w-4 h-4" />}
                  title={t('home.feat_profiles_title')}
                  desc={t('home.feat_profiles_desc')}
                />
                <BotFeature
                  icon={<Search className="w-4 h-4" />}
                  title={t('home.feat_search_title')}
                  desc={t('home.feat_search_desc')}
                />
                <BotFeature
                  icon={<BarChart3 className="w-4 h-4" />}
                  title={t('home.feat_dashboard_title')}
                  desc={t('home.feat_dashboard_desc')}
                />
                <BotFeature
                  icon={<Award className="w-4 h-4" />}
                  title={t('home.feat_completion_title')}
                  desc={t('home.feat_completion_desc')}
                />
                <BotFeature
                  icon={<Bell className="w-4 h-4" />}
                  title={t('home.feat_admin_tag_title')}
                  desc={t('home.feat_admin_tag_desc')}
                />
              </ul>
            </div>

            {/* Tier 2: Admin */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 sm:p-8 shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 -translate-x-12 blur-2xl"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full translate-y-12 translate-x-12 blur-2xl"></div>

              <div className="relative">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium mb-3 backdrop-blur">
                      <Crown className="w-3 h-3" />
                      {t('home.tier_admin_badge')}
                    </div>
                    <h3 className="font-display font-bold text-2xl">
                      {t('home.tier_admin_title_part1')}{' '}
                      <span className="text-yellow-200">{t('home.tier_admin_title_part2')}</span>
                    </h3>
                    <p className="text-sm text-purple-100 mt-1">
                      {t('home.tier_admin_subtitle')}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur grid place-items-center text-white flex-shrink-0">
                    <Shield className="w-7 h-7" />
                  </div>
                </div>

                <ul className="space-y-3">
                  <BotFeature
                    icon={<Trash2 className="w-4 h-4" />}
                    title={t('home.feat_delete_spam_title')}
                    desc={t('home.feat_delete_spam_desc')}
                    onDark
                  />
                  <BotFeature
                    icon={<UserX className="w-4 h-4" />}
                    title={t('home.feat_remove_spammers_title')}
                    desc={t('home.feat_remove_spammers_desc')}
                    onDark
                  />
                  <BotFeature
                    icon={<Globe className="w-4 h-4" />}
                    title={t('home.feat_block_country_title')}
                    desc={t('home.feat_block_country_desc')}
                    onDark
                  />
                  <BotFeature
                    icon={<Shield className="w-4 h-4" />}
                    title={t('home.feat_global_blocklist_title')}
                    desc={t('home.feat_global_blocklist_desc')}
                    onDark
                  />
                  <BotFeature
                    icon={<Sparkles className="w-4 h-4" />}
                    title={t('home.feat_manual_report_title')}
                    desc={t('home.feat_manual_report_desc')}
                    onDark
                  />
                </ul>
              </div>
            </div>
          </div>

          {/* Comparison table for clarity */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-display font-bold text-lg">{t('home.comparison_title')}</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {t('home.comparison_subtitle')}
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              <ComparisonRow feature={t('home.cmp_profiles')} member={true} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_search')} member={true} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_dashboard')} member={true} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_log')} member={true} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_admin_tag')} member={true} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_chat_warnings')} member={true} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_delete_spam')} member={false} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_remove_spammers')} member={false} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_block_country')} member={false} admin={true} t={t} />
              <ComparisonRow feature={t('home.cmp_global_blocklist')} member={false} admin={true} t={t} />
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4 text-sm">
              {t('home.bottom_cta_hint')}
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              {t('home.cta_start_trial')}
              <ArrowDir className={`w-4 h-4 ${arrowRotate}`} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          {t('home.footer_copyright', { year: new Date().getFullYear() })} <a href="https://allchat.co.il" className="hover:underline">AllChat</a>. {t('home.footer_built_with')} <Zap className="w-3.5 h-3.5 inline text-brand-500" /> {t('home.footer_in_israel')}
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon, title, desc,
}: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function BotFeature({
  icon, title, desc, onDark = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onDark?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 mt-0.5 ${
        onDark
          ? 'bg-white/15 text-yellow-200 backdrop-blur'
          : 'bg-blue-50 text-blue-600'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-sm ${onDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </div>
        <div className={`text-xs leading-relaxed ${onDark ? 'text-purple-100' : 'text-gray-600'}`}>
          {desc}
        </div>
      </div>
    </li>
  );
}

function ComparisonRow({
  feature, member, admin, t,
}: {
  feature: string;
  member: boolean;
  admin: boolean;
  t: (path: string) => string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
      <div className="text-sm text-gray-700 font-medium">{feature}</div>
      <div className="w-32 sm:w-40 text-center">
        {member ? (
          <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">{t('home.label_member')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center text-gray-300 text-sm">
            <X className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className="w-32 sm:w-40 text-center">
        {admin ? (
          <span className="inline-flex items-center gap-1 text-purple-600 text-sm">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">{t('home.label_admin')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center text-gray-300 text-sm">
            <X className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
}
