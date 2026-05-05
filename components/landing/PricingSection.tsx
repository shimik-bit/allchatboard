'use client';

/**
 * PricingSection — landing page pricing block with Personal / Business tabs.
 *
 * Why this is a client component:
 *   The rest of the landing page is server-rendered (faster + better SEO),
 *   but the tab toggle needs useState. Keeping the toggle isolated to this
 *   one file means the rest of `/` stays static.
 *
 * How copy gets here:
 *   This component receives all i18n strings as props from the server-side
 *   page.tsx — i18n.t() runs on the server, then the resolved strings are
 *   passed in. The component itself never imports i18n. This avoids
 *   shipping the i18n bundle to the client just for this section.
 *
 * Layout logic:
 *   - "Personal" tab → 1 card, centered with max-w-md, looks featured
 *   - "Business" tab → 3 cards in a 3-col grid (1-col on mobile)
 *   The component swaps between these layouts when activeTab changes.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Check, Crown } from 'lucide-react';

export type Plan = {
  name: string;
  tagline: string;
  currency: string;
  price: string;
  period: string;       // e.g. "/ month" or "/ day"
  billing: string;      // e.g. "Billed monthly..." line under price
  cta: string;
  features: string[];
  highlight?: boolean;
  popularLabel?: string;
};

export function PricingSection({
  eyebrow, title, subtitle,
  tabPersonalLabel, tabBusinessLabel,
  personalPlans, businessPlans,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  tabPersonalLabel: string;
  tabBusinessLabel: string;
  personalPlans: Plan[];
  businessPlans: Plan[];
}) {
  // Default to "personal" — cheaper, friendlier for first-time visitors.
  // Business buyers will click. Cheap-first is generally better for landing
  // page conversion than enterprise-first.
  const [activeTab, setActiveTab] = useState<'personal' | 'business'>('personal');

  const plans = activeTab === 'personal' ? personalPlans : businessPlans;
  const isSinglePlan = plans.length === 1;

  return (
    <section
      id="pricing"
      className="relative px-6 py-20 overflow-hidden bg-gradient-to-b from-white via-purple-50/30 to-white"
    >
      {/* Decorative background blob — sits behind the cards for visual depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-200/20 rounded-full blur-3xl animate-blob" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
            <Crown className="w-4 h-4" />
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-3">
            {title}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Tab toggle pill — Personal / Business */}
        <div className="flex justify-center mb-10">
          <div
            role="tablist"
            aria-label="pricing-tabs"
            className="inline-flex items-center bg-white rounded-full p-1 border border-gray-200 shadow-sm"
          >
            <TabButton
              isActive={activeTab === 'personal'}
              onClick={() => setActiveTab('personal')}
              label={tabPersonalLabel}
            />
            <TabButton
              isActive={activeTab === 'business'}
              onClick={() => setActiveTab('business')}
              label={tabBusinessLabel}
            />
          </div>
        </div>

        {/* Cards — layout adapts based on count */}
        <div
          className={`grid gap-6 md:gap-4 lg:gap-6 items-stretch ${
            isSinglePlan ? 'max-w-md mx-auto' : 'md:grid-cols-3'
          }`}
        >
          {plans.map((p, i) => (
            <PricingCard key={`${activeTab}-${i}`} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** TabButton — one of the two pills inside the toggle. */
function TabButton({
  isActive, onClick, label,
}: { isActive: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
        isActive
          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * PricingCard — single tier in the pricing grid.
 *
 * Two visual modes:
 *   - default: white card with gray border, normal hover lift
 *   - highlight (used for the Pro/middle business tier): gradient bg, white
 *     text, "most popular" ribbon, slight upward translate on desktop
 *
 * The price block is split into currency + big number + period so each
 * piece can be styled independently (giant number, smaller suffix).
 */
function PricingCard({
  name, tagline, currency, price, period, billing, cta, features,
  highlight = false, popularLabel,
}: Plan) {
  return (
    <div
      className={`relative rounded-2xl p-6 sm:p-8 flex flex-col ${
        highlight
          ? 'bg-gradient-to-br from-purple-600 via-brand-600 to-pink-600 text-white shadow-2xl md:-translate-y-2 ring-1 ring-white/20'
          : 'bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all'
      }`}
    >
      {/* "Most popular" ribbon — only on highlighted card */}
      {highlight && popularLabel && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-yellow-300 text-purple-900 text-xs font-bold shadow-lg whitespace-nowrap">
          ⭐ {popularLabel}
        </div>
      )}

      {/* Plan name + tagline */}
      <div className="mb-5">
        <h3 className={`font-display font-bold text-2xl mb-1 ${highlight ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </h3>
        <p className={`text-sm ${highlight ? 'text-purple-100' : 'text-gray-500'}`}>
          {tagline}
        </p>
      </div>

      {/* Price block */}
      <div className="mb-2">
        <div className="flex items-baseline gap-1">
          <span className={`text-base font-medium ${highlight ? 'text-purple-100' : 'text-gray-500'}`}>
            {currency}
          </span>
          <span className={`font-display font-bold text-5xl ${highlight ? 'text-white' : 'text-gray-900'}`}>
            {price}
          </span>
          <span className={`text-sm ${highlight ? 'text-purple-100' : 'text-gray-500'}`}>
            {period}
          </span>
        </div>
        <p className={`text-xs mt-1 ${highlight ? 'text-purple-100/80' : 'text-gray-400'}`}>
          {billing}
        </p>
      </div>

      {/* Feature list with checkmarks */}
      <ul className="space-y-3 my-6 flex-grow">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                highlight ? 'text-yellow-200' : 'text-green-500'
              }`}
            />
            <span className={`text-sm leading-relaxed ${highlight ? 'text-white' : 'text-gray-700'}`}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href="/auth/signup"
        className={`block text-center px-6 py-3 rounded-xl font-bold transition-colors ${
          highlight
            ? 'bg-white text-purple-700 hover:bg-purple-50 shadow-lg'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
