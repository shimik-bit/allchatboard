/**
 * TermsContentEn
 * ============================================================================
 * English terms of service body — used at /en/terms.
 *
 * Globally compliant: Israel, EU, US. Covers Google API usage,
 * sub-processors, SLAs, dispute resolution, and AI-specific clauses.
 *
 * Bump CURRENT_TERMS_VERSION in `lib/terms/version.ts` when this changes
 * (existing users will be required to re-accept).
 */

export default function TermsContentEn({ inModal = false }: { inModal?: boolean }) {
  const sectionClass = inModal ? 'mb-6' : 'mb-8';

  return (
    <div className="text-left" dir="ltr">

      {/* Preamble */}
      <section className={sectionClass}>
        <p className="text-gray-700 leading-relaxed mb-3 text-sm">
          These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) govern
          your access to and use of TaskFlow AI (the &ldquo;
          <strong>Service</strong>&rdquo;), operated by{' '}
          <strong>AllChat J4U Ltd.</strong> (Israeli company number 515738813,
          &ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;,
          or &ldquo;<strong>our</strong>&rdquo;). By creating an account or
          using the Service, you agree to be bound by these Terms.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm font-semibold">
          IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICE.
        </p>
      </section>

      {/* 1. Eligibility */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          1. Eligibility
        </h2>
        <p className="text-gray-700 text-sm">
          You must be at least 18 years old (or the age of majority in your
          jurisdiction) and able to form a legally binding contract to use the
          Service. If you are using the Service on behalf of an organization,
          you represent that you have authority to bind that organization to
          these Terms.
        </p>
      </section>

      {/* 2. Service description */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          2. Service Description
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          TaskFlow AI is a SaaS platform for managing WhatsApp groups,
          customer communications, and business workflows. Features may
          include, without limitation:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>WhatsApp group management and protection (GroupGuard)</li>
          <li>AI-powered message classification and insights</li>
          <li>Task and project management boards</li>
          <li>Financial management and invoicing tools</li>
          <li>Integrations with third-party services (Google, AllChat, Green API, etc.)</li>
          <li>Automated workflows and notifications</li>
        </ul>
        <p className="text-gray-700 text-sm mt-3">
          We reserve the right to modify, suspend, or discontinue any feature
          at any time, with reasonable notice for material changes that
          adversely affect existing paid users.
        </p>
      </section>

      {/* 3. Accounts */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          3. Accounts and Security
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          To use the Service you must create an account by providing accurate
          and complete information. You are responsible for:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>Maintaining the confidentiality of your login credentials</li>
          <li>All activity that occurs under your account</li>
          <li>Notifying us immediately of any unauthorized access</li>
          <li>Ensuring your account information remains current and accurate</li>
        </ul>
      </section>

      {/* 4. Plans and Billing */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          4. Plans, Trials, and Billing
        </h2>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          4.1 Plans
        </h3>
        <p className="text-gray-700 text-sm mb-3">
          The Service is offered under several plans (Trial, Starter,
          Business, Enterprise) with different feature sets and usage
          limits. Current pricing and limits are displayed at{' '}
          <a href="https://taskflow-ai.com/pricing" className="text-purple-600 hover:underline">
            taskflow-ai.com/pricing
          </a>{' '}
          and may change with 30 days&apos; notice to existing subscribers.
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          4.2 Free trial
        </h3>
        <p className="text-gray-700 text-sm mb-3">
          We may offer a free trial period. At the end of the trial, your
          account will be downgraded to the free tier unless you upgrade.
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          4.3 Subscription fees
        </h3>
        <p className="text-gray-700 text-sm mb-3">
          Paid plans are billed in advance on a recurring monthly or annual
          basis. Fees are non-refundable except where required by law. You
          authorize us (or our payment processor, Cardcom) to charge your
          chosen payment method automatically.
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          4.4 Failed payments
        </h3>
        <p className="text-gray-700 text-sm mb-3">
          If a payment fails, we will retry and notify you. Continued failure
          for 7 days may result in suspension or downgrade.
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          4.5 Cancellation
        </h3>
        <p className="text-gray-700 text-sm">
          You may cancel at any time from your account settings. Cancellation
          takes effect at the end of the current billing period; no prorated
          refunds are issued for partial periods.
        </p>
      </section>

      {/* 5. Acceptable use */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          5. Acceptable Use
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          You agree not to use the Service to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>Send unsolicited messages (spam), bulk marketing without recipient consent, or any communications that violate WhatsApp&apos;s Business Solution Policy or Commerce Policy</li>
          <li>Violate any applicable law or regulation, including anti-spam, data protection, consumer protection, or telecommunications laws</li>
          <li>Infringe on intellectual property, privacy, publicity, or other legal rights of any party</li>
          <li>Distribute malware, viruses, or harmful code</li>
          <li>Attempt to gain unauthorized access to our systems, other users&apos; accounts, or third-party services</li>
          <li>Reverse engineer, decompile, or disassemble the Service</li>
          <li>Scrape, crawl, or extract data from the Service except via our official API</li>
          <li>Use the Service for any illegal, fraudulent, harmful, harassing, or deceptive purpose</li>
          <li>Resell or rent the Service to third parties without a written reseller agreement</li>
          <li>Send messages that promote violence, discrimination, hatred, or content that is sexually explicit, defamatory, or otherwise harmful</li>
        </ul>
        <p className="text-gray-700 text-sm mt-3">
          Violation of these rules may result in immediate suspension or
          termination without refund.
        </p>
      </section>

      {/* 6. Third-party services */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          6. Third-Party Services
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          The Service integrates with third-party platforms including, but
          not limited to: WhatsApp (via Green API and AllChat), Google
          (Drive, Sheets, OAuth), OpenAI, Anthropic, Cardcom (payments), and
          Supabase (database hosting). Your use of these integrations is
          subject to the respective providers&apos; terms and policies. We
          are not responsible for the availability, accuracy, or conduct of
          third-party services.
        </p>
        <p className="text-gray-700 text-sm">
          When you connect a Google account, you grant TaskFlow limited
          access to your Google Drive and Sheets as described in our{' '}
          <a href="/en/privacy" className="text-purple-600 hover:underline">
            Privacy Policy
          </a>
          , Section 3. We comply with the Google API Services User Data
          Policy, including the Limited Use requirements.
        </p>
      </section>

      {/* 7. WhatsApp specific terms */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          7. WhatsApp Specific Terms
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          TaskFlow is not affiliated with, endorsed by, or sponsored by
          WhatsApp Inc. or Meta Platforms, Inc. You are responsible for
          ensuring your use of WhatsApp through our Service complies with{' '}
          <a
            href="https://www.whatsapp.com/legal/business-terms"
            target="_blank"
            rel="noreferrer"
            className="text-purple-600 hover:underline"
          >
            WhatsApp&apos;s Business Terms
          </a>
          .
        </p>
        <p className="text-gray-700 text-sm">
          We are not liable for any account bans, message delivery failures,
          rate limiting, or feature unavailability imposed by WhatsApp or its
          providers.
        </p>
      </section>

      {/* 8. AI-specific terms */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          8. Artificial Intelligence Features
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          The Service uses third-party AI models (including OpenAI and
          Anthropic) to provide features such as classification, summarization,
          and content generation. AI-generated output:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>May be inaccurate, incomplete, biased, or inappropriate</li>
          <li>Should not be relied upon as legal, medical, financial, or other professional advice</li>
          <li>Is provided &ldquo;as is&rdquo; without warranty of any kind</li>
          <li>You are responsible for reviewing and verifying AI output before acting on it or sharing it</li>
        </ul>
        <p className="text-gray-700 text-sm mt-3">
          We process your data through AI models per our Privacy Policy. We
          have configured our AI providers to <strong>not</strong> use your
          data for model training where such configuration is available.
        </p>
      </section>

      {/* 9. Your content */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          9. Your Content
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          You retain all ownership rights to content you submit to the Service
          (&ldquo;<strong>Your Content</strong>&rdquo;), including messages,
          files, customer data, and documents. You grant us a worldwide,
          non-exclusive, royalty-free license to host, store, transmit,
          display, and process Your Content solely as necessary to provide
          the Service.
        </p>
        <p className="text-gray-700 text-sm">
          You represent and warrant that you have all rights necessary to
          submit Your Content and that doing so does not violate any law or
          third-party right.
        </p>
      </section>

      {/* 10. IP */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          10. Our Intellectual Property
        </h2>
        <p className="text-gray-700 text-sm">
          The Service, including all software, design, text, graphics,
          trademarks, and logos, is owned by AllChat J4U Ltd. or its
          licensors and is protected by intellectual property laws. We grant
          you a limited, non-exclusive, non-transferable, revocable license
          to use the Service for your internal business purposes during the
          term of these Terms.
        </p>
      </section>

      {/* 11. Suspension and termination */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          11. Suspension and Termination
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          We may suspend or terminate your access to the Service immediately
          if you:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>Breach these Terms or our Acceptable Use rules</li>
          <li>Fail to pay fees when due</li>
          <li>Pose a security or legal risk to us, other users, or third parties</li>
          <li>Are required to be removed by law or court order</li>
        </ul>
        <p className="text-gray-700 text-sm mt-3">
          Upon termination, we will delete Your Content within 90 days unless
          we are required by law to retain it.
        </p>
      </section>

      {/* 12. Disclaimers */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          12. Disclaimers
        </h2>
        <p className="text-gray-700 text-sm font-semibold uppercase mb-3">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express, implied, or statutory.
        </p>
        <p className="text-gray-700 text-sm">
          To the maximum extent permitted by applicable law, we disclaim all
          warranties including but not limited to merchantability, fitness
          for a particular purpose, non-infringement, accuracy, reliability,
          and uninterrupted availability. We do not warrant that the Service
          will be error-free, secure, or that defects will be corrected.
        </p>
      </section>

      {/* 13. Limitation of liability */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          13. Limitation of Liability
        </h2>
        <p className="text-gray-700 text-sm mb-3 font-semibold uppercase">
          To the maximum extent permitted by law, in no event shall AllChat J4U Ltd., its directors, employees, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities, arising from your use of the Service.
        </p>
        <p className="text-gray-700 text-sm">
          Our total aggregate liability for any claim arising from or related
          to the Service shall not exceed the greater of: (a) the fees you
          paid us in the 12 months preceding the claim, or (b) one hundred
          US dollars ($100). Some jurisdictions do not allow these
          limitations; in such cases, our liability is limited to the
          maximum extent permitted by law.
        </p>
      </section>

      {/* 14. Indemnification */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          14. Indemnification
        </h2>
        <p className="text-gray-700 text-sm">
          You agree to indemnify, defend, and hold harmless AllChat J4U Ltd.,
          its officers, directors, employees, and agents from any claims,
          liabilities, damages, losses, and expenses (including reasonable
          legal fees) arising out of or in any way connected to: (a) your use
          of the Service; (b) your violation of these Terms; (c) your
          violation of any third-party right; or (d) Your Content.
        </p>
      </section>

      {/* 15. Governing law and dispute resolution */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          15. Governing Law and Dispute Resolution
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          These Terms are governed by the laws of the State of Israel,
          without regard to conflict-of-law principles. Any dispute, claim,
          or controversy arising out of or relating to these Terms or the
          Service shall be resolved exclusively by the competent courts of
          Tel Aviv-Jaffa, Israel, and the parties consent to the personal
          jurisdiction of such courts.
        </p>
        <p className="text-gray-700 text-sm">
          <strong>EU consumers</strong>: nothing in this Section deprives you
          of mandatory consumer protections under your local law. You may
          also bring claims in the courts of your country of residence.
        </p>
      </section>

      {/* 16. Changes */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          16. Changes to These Terms
        </h2>
        <p className="text-gray-700 text-sm">
          We may update these Terms from time to time. Material changes will
          be notified by email and via an in-app banner at least 30 days
          before they take effect, and may require you to re-accept the
          updated Terms to continue using the Service.
        </p>
      </section>

      {/* 17. Miscellaneous */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          17. Miscellaneous
        </h2>
        <ul className="list-disc pl-6 space-y-1.5 text-gray-700 text-sm">
          <li>
            <strong>Entire agreement</strong>: these Terms, together with our
            Privacy Policy and any order forms, constitute the entire
            agreement between you and us
          </li>
          <li>
            <strong>Severability</strong>: if any provision is held
            unenforceable, the remaining provisions remain in full force
          </li>
          <li>
            <strong>No waiver</strong>: our failure to enforce any provision
            is not a waiver of our right to do so later
          </li>
          <li>
            <strong>Assignment</strong>: you may not assign these Terms
            without our prior written consent; we may assign these Terms in
            connection with a merger, acquisition, or asset sale
          </li>
          <li>
            <strong>Force majeure</strong>: we are not liable for delays or
            failures caused by events beyond our reasonable control
          </li>
          <li>
            <strong>Notices</strong>: we may give you notice by email to the
            address associated with your account; you may give us notice at{' '}
            <a href="mailto:legal@taskflow-ai.com" className="text-purple-600 hover:underline">
              legal@taskflow-ai.com
            </a>
          </li>
        </ul>
      </section>

      {/* 18. Contact */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          18. Contact
        </h2>
        <p className="text-gray-700 text-sm">
          AllChat J4U Ltd. (Israeli company number 515738813), Petah Tikva,
          Israel. Email:{' '}
          <a href="mailto:legal@taskflow-ai.com" className="text-purple-600 hover:underline">
            legal@taskflow-ai.com
          </a>
        </p>
      </section>
    </div>
  );
}
