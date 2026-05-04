import Link from 'next/link';
import {
  MessageSquare, Sparkles, LayoutGrid, Zap,
  Users, Shield, Search, BarChart3, Award,
  Trash2, UserX, Crown, Check, X, ArrowLeft,
  Briefcase, Globe, Bell,
  // New icons used by the redesigned sections below
  Smartphone, BrainCircuit, TrendingUp,
  Building2, Scale, Stethoscope, ShoppingCart, GraduationCap, Headphones,
  ChevronDown, User,
} from 'lucide-react';
import { getT } from '@/lib/i18n/server';

/**
 * Landing page (taskflow-ai.com).
 *
 * Section order — top to bottom:
 *   1. Header (sticky)
 *   2. Hero — text + visual mockup (WhatsApp message → table row)
 *   3. Stats — 4 numbers as social proof
 *   4. Features — 3 cards explaining what you get
 *   5. How it works — 3 numbered steps
 *   6. Industries — 6 industry cards (social proof: works for everyone)
 *   7. GroupGuard — deep dive into protection + member tiers (existing)
 *   8. FAQ — 6 collapsible questions
 *   9. Final CTA — gradient block before footer
 *  10. Footer
 *
 * Design notes:
 * - Mobile-first throughout. Hero title scales 4xl → 5xl → 7xl across breakpoints.
 * - Brand colors: brand-* (custom tailwind) + purple/pink gradients from existing pages.
 * - All copy goes through t() — strings live in lib/i18n/locales/{he,en}.ts under `home.`
 * - FAQ uses native <details>/<summary> for keyboard accessibility + zero JS.
 */
export default function HomePage() {
  const { t, dir } = getT('he');
  const ArrowDir = ArrowLeft;
  const arrowRotate = dir === 'rtl' ? '' : 'rotate-180';

  return (
    <main className="min-h-screen bg-white" dir={dir}>
      {/* ───────── Header ───────── */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-20">
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

      {/* ───────── HERO ─────────
       * Text-centered, with a CSS-only mockup below the CTAs that visualizes
       * the core promise: WhatsApp message → extracted table row. */}
      <section className="bg-gradient-to-b from-white to-brand-50/40 px-6 py-12 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              {t('home.hero_badge')}
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-7xl leading-tight mb-6">
              {t('home.hero_title_part1')}
              <br />
              <span className="bg-gradient-to-l from-brand-600 to-purple-500 bg-clip-text text-transparent">
                {t('home.hero_title_part2')}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed">
              {t('home.hero_description')}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/auth/signup" className="btn-primary text-base px-6 py-3">
                {t('home.cta_start_trial_14_days')}
              </Link>
              <Link href="#how" className="btn-secondary text-base px-6 py-3">
                {t('home.cta_how_it_works')}
              </Link>
            </div>
          </div>

          {/* Visual mockup — message becomes a row */}
          <HeroMockup t={t} />
        </div>
      </section>

      {/* ───────── STATS ─────────
       * 4 big numbers, social-proof signal #1. 2 cols on mobile, 4 on desktop. */}
      <section className="border-y border-gray-100 bg-gradient-to-r from-purple-50/60 via-white to-pink-50/60 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {[
              { val: t('home.stat1_value'), label: t('home.stat1_label') },
              { val: t('home.stat2_value'), label: t('home.stat2_label') },
              { val: t('home.stat3_value'), label: t('home.stat3_label') },
              { val: t('home.stat4_value'), label: t('home.stat4_label') },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="font-display font-bold text-3xl sm:text-4xl md:text-5xl bg-gradient-to-l from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {s.val}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-2 leading-snug">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FEATURES ─────────
       * Existing 3 cards — what you get. */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
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

      {/* ───────── HOW IT WORKS ─────────
       * 3 steps. Each step has a tinted big number + icon + title + description.
       * Stacks vertically on mobile, horizontal on md+. */}
      <section id="how" className="bg-gradient-to-b from-white via-brand-50/30 to-white py-20 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              {t('home.how_eyebrow')}
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl mb-3">
              {t('home.how_title')}
            </h2>
            <p className="text-lg text-gray-600">
              {t('home.how_subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-8">
            <Step
              num={t('home.how_step1_num')}
              icon={<Smartphone className="w-6 h-6" />}
              title={t('home.how_step1_title')}
              desc={t('home.how_step1_desc')}
            />
            <Step
              num={t('home.how_step2_num')}
              icon={<BrainCircuit className="w-6 h-6" />}
              title={t('home.how_step2_title')}
              desc={t('home.how_step2_desc')}
            />
            <Step
              num={t('home.how_step3_num')}
              icon={<TrendingUp className="w-6 h-6" />}
              title={t('home.how_step3_title')}
              desc={t('home.how_step3_desc')}
            />
          </div>
        </div>
      </section>

      {/* ───────── INDUSTRIES ─────────
       * 6 industry cards, social-proof signal #2 ("works for any business").
       * 2 cols mobile, 3 cols desktop. */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
            <Globe className="w-4 h-4" />
            {t('home.industries_eyebrow')}
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-3">
            {t('home.industries_title')}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('home.industries_subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <IndustryCard icon={<Building2 className="w-6 h-6" />} label={t('home.industry_realestate')} />
          <IndustryCard icon={<Scale className="w-6 h-6" />} label={t('home.industry_legal')} />
          <IndustryCard icon={<Stethoscope className="w-6 h-6" />} label={t('home.industry_health')} />
          <IndustryCard icon={<ShoppingCart className="w-6 h-6" />} label={t('home.industry_retail')} />
          <IndustryCard icon={<GraduationCap className="w-6 h-6" />} label={t('home.industry_education')} />
          <IndustryCard icon={<Headphones className="w-6 h-6" />} label={t('home.industry_services')} />
        </div>
      </section>

      {/* ───────── GROUPGUARD (existing, untouched) ───────── */}
      <section id="groupguard" className="bg-gradient-to-b from-purple-50/40 via-white to-pink-50/30 py-20 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
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
                <BotFeature icon={<Briefcase className="w-4 h-4" />} title={t('home.feat_profiles_title')} desc={t('home.feat_profiles_desc')} />
                <BotFeature icon={<Search className="w-4 h-4" />} title={t('home.feat_search_title')} desc={t('home.feat_search_desc')} />
                <BotFeature icon={<BarChart3 className="w-4 h-4" />} title={t('home.feat_dashboard_title')} desc={t('home.feat_dashboard_desc')} />
                <BotFeature icon={<Award className="w-4 h-4" />} title={t('home.feat_completion_title')} desc={t('home.feat_completion_desc')} />
                <BotFeature icon={<Bell className="w-4 h-4" />} title={t('home.feat_admin_tag_title')} desc={t('home.feat_admin_tag_desc')} />
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
                  <BotFeature icon={<Trash2 className="w-4 h-4" />} title={t('home.feat_delete_spam_title')} desc={t('home.feat_delete_spam_desc')} onDark />
                  <BotFeature icon={<UserX className="w-4 h-4" />} title={t('home.feat_remove_spammers_title')} desc={t('home.feat_remove_spammers_desc')} onDark />
                  <BotFeature icon={<Globe className="w-4 h-4" />} title={t('home.feat_block_country_title')} desc={t('home.feat_block_country_desc')} onDark />
                  <BotFeature icon={<Shield className="w-4 h-4" />} title={t('home.feat_global_blocklist_title')} desc={t('home.feat_global_blocklist_desc')} onDark />
                  <BotFeature icon={<Sparkles className="w-4 h-4" />} title={t('home.feat_manual_report_title')} desc={t('home.feat_manual_report_desc')} onDark />
                </ul>
              </div>
            </div>
          </div>

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

      {/* ───────── FAQ ─────────
       * Native <details>/<summary> for keyboard accessibility, no JS needed. */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-4">
            <MessageSquare className="w-4 h-4" />
            {t('home.faq_eyebrow')}
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl">
            {t('home.faq_title')}
          </h2>
        </div>

        <div className="space-y-3">
          {([1, 2, 3, 4, 5, 6] as const).map((i) => (
            <FaqItem
              key={i}
              q={t(`home.faq${i}_q`)}
              a={t(`home.faq${i}_a`)}
            />
          ))}
        </div>
      </section>

      {/* ───────── FINAL CTA ─────────
       * Big gradient block before the footer. */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-purple-600 via-brand-600 to-pink-600 rounded-3xl p-8 sm:p-12 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
          {/* decorative blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-yellow-400/10 rounded-full translate-y-32 -translate-x-32 blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur text-white text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              {t('home.final_eyebrow')}
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl leading-tight mb-4">
              {t('home.final_title_part1')}
              <br />
              <span className="text-yellow-200">{t('home.final_title_part2')}</span>
            </h2>
            <p className="text-base sm:text-lg text-purple-100 max-w-xl mx-auto mb-8 leading-relaxed">
              {t('home.final_subtitle')}
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              <Link
                href="/auth/signup"
                className="bg-white text-purple-700 px-6 sm:px-7 py-3.5 rounded-xl font-bold hover:bg-purple-50 transition-colors shadow-lg"
              >
                {t('home.final_cta_primary')}
              </Link>
              <a
                href="mailto:hello@taskflow-ai.com"
                className="bg-white/10 backdrop-blur border border-white/30 text-white px-6 sm:px-7 py-3.5 rounded-xl font-bold hover:bg-white/20 transition-colors"
              >
                {t('home.final_cta_secondary')}
              </a>
            </div>
            <p className="text-xs sm:text-sm text-purple-100/80">
              {t('home.final_trust_signals')}
            </p>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          {t('home.footer_copyright', { year: new Date().getFullYear() })}{' '}
          <a href="https://allchat.co.il" className="hover:underline">AllChat</a>.{' '}
          {t('home.footer_built_with')}{' '}
          <Zap className="w-3.5 h-3.5 inline text-brand-500" />{' '}
          {t('home.footer_in_israel')}
        </div>
      </footer>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helper components — section building blocks, kept landing-page-local.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * HeroMockup — visual showing the core product loop:
 *   WhatsApp message arrives → AI extracts → table row appears.
 * Pure CSS/HTML (no images), so it's crisp on retina and scales fluidly.
 */
function HeroMockup({ t }: { t: (k: string) => string }) {
  return (
    <div className="relative max-w-md mx-auto" aria-hidden="true">
      {/* Top: WhatsApp-style message card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 transform -rotate-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <MessageSquare className="w-3.5 h-3.5 text-green-500" />
          <span className="font-medium">{t('home.hero_mockup_msg_label')}</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 grid place-items-center text-white flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900">{t('home.hero_mockup_msg_sender')}</span>
              <span className="text-xs text-gray-400">{t('home.hero_mockup_msg_time')}</span>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed">
              {t('home.hero_mockup_msg_text')}
            </div>
          </div>
        </div>
      </div>

      {/* Middle: AI label connecting the two cards */}
      <div className="flex flex-col items-center my-4 relative z-10">
        <div className="px-3 py-1.5 rounded-full bg-gradient-to-l from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
          <Sparkles className="w-3.5 h-3.5" />
          {t('home.hero_mockup_arrow_label')}
        </div>
      </div>

      {/* Bottom: extracted table row */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transform rotate-1">
        <div className="bg-gradient-to-l from-purple-50 to-pink-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-xs font-semibold text-purple-700">{t('home.hero_mockup_table_label')}</span>
        </div>
        <div className="p-4 space-y-2.5">
          <MockField label={t('home.hero_mockup_field_name')} value={t('home.hero_mockup_msg_sender')} />
          <MockField label={t('home.hero_mockup_field_property')} value={t('home.hero_mockup_value_property')} />
          <MockField label={t('home.hero_mockup_field_area')} value={t('home.hero_mockup_value_area')} />
          <MockField label={t('home.hero_mockup_field_budget')} value={t('home.hero_mockup_value_budget')} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500">{t('home.hero_mockup_field_status')}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t('home.hero_mockup_value_status')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 truncate">{value}</span>
    </div>
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

/** A single "how it works" step. */
function Step({
  num, icon, title, desc,
}: { num: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl font-display font-bold text-purple-300 leading-none">
          {num}
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 grid place-items-center text-white shadow-lg">
          {icon}
        </div>
      </div>
      <h3 className="font-display font-bold text-xl mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function IndustryCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 flex flex-col items-center text-center hover:border-purple-300 hover:shadow-md transition-all group">
      <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 grid place-items-center mb-3 group-hover:bg-gradient-to-br group-hover:from-purple-600 group-hover:to-pink-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div className="font-semibold text-sm text-gray-900">{label}</div>
    </div>
  );
}

/** FaqItem — collapsible Q&A using native <details>. Keyboard-accessible. */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-colors overflow-hidden">
      <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none">
        <span className="font-semibold text-gray-900 text-sm sm:text-base">{q}</span>
        <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
      </summary>
      <div className="px-4 pb-4 text-gray-600 leading-relaxed text-sm sm:text-base border-t border-gray-100 pt-3">
        {a}
      </div>
    </details>
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
