/**
 * PrivacyContentEn
 * ============================================================================
 * English privacy policy body — used at /en/privacy.
 *
 * Comprehensive, globally-compliant version covering:
 *   - Israeli Privacy Protection Law (PPL)
 *   - EU GDPR
 *   - US CCPA/CPRA
 *   - Google API Services User Data Policy (Limited Use requirements)
 *
 * Bump LAST_UPDATED_EN in `lib/terms/version.ts` when this changes.
 */

export default function PrivacyContentEn({ inModal = false }: { inModal?: boolean }) {
  const sectionClass = inModal ? 'mb-6' : 'mb-8';

  return (
    <div className="text-left" dir="ltr">

      {/* Introduction */}
      <section className={sectionClass}>
        <p className="text-gray-700 leading-relaxed mb-3 text-sm">
          This Privacy Policy explains how <strong>AllChat J4U Ltd.</strong>{' '}
          (Israeli company number 515738813), operating the TaskFlow AI
          service (the &ldquo;<strong>Service</strong>&rdquo;, &ldquo;
          <strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;, or
          &ldquo;<strong>our</strong>&rdquo;), collects, uses, stores, shares,
          and protects information about users (&ldquo;
          <strong>you</strong>&rdquo;, &ldquo;<strong>your</strong>&rdquo;) of
          the platform available at{' '}
          <a href="https://taskflow-ai.com" className="text-purple-600 hover:underline">
            taskflow-ai.com
          </a>{' '}
          and related services.
        </p>
        <p className="text-gray-700 leading-relaxed text-sm">
          We are committed to protecting your privacy in accordance with the
          Israeli Privacy Protection Law (1981), the EU General Data
          Protection Regulation (GDPR), the California Consumer Privacy Act
          as amended by the CPRA (CCPA), and the Google API Services User
          Data Policy, including the Limited Use requirements.
        </p>
      </section>

      {/* 1. Information we collect */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          1. Information We Collect
        </h2>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          1.1 Account information
        </h3>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm mb-4">
          <li>Full name, email address, phone number</li>
          <li>Business name and role</li>
          <li>Profile picture (if provided)</li>
          <li>Authentication credentials (passwords are hashed; we never store them in plaintext)</li>
        </ul>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          1.2 WhatsApp data
        </h3>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm mb-4">
          <li>Group names, member lists, and group metadata for groups you connect</li>
          <li>
            Messages routed through the Service for the purpose of
            classification, AI-powered insights, and automated workflows
          </li>
          <li>Media attachments (images, documents, audio) shared in connected groups</li>
          <li>Phone numbers of group members for analysis and spam detection</li>
        </ul>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          1.3 Google account data (when you connect Google integration)
        </h3>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm mb-4">
          <li>Your Google account email address and profile picture</li>
          <li>OAuth access and refresh tokens (encrypted at rest with AES-256-GCM)</li>
          <li>
            Limited Drive access via the <code>drive.file</code> scope: we can
            only see and modify files that the Service has created or that you
            explicitly opened with the Service
          </li>
          <li>
            Sheets access via the <code>spreadsheets</code> scope: we read and
            write only to spreadsheets you explicitly designate as sync
            destinations
          </li>
        </ul>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          1.4 Payment information
        </h3>
        <p className="text-gray-700 text-sm mb-4">
          Payment information is processed by our payment processors (Cardcom
          in Israel and others as applicable). We do not store full credit
          card numbers on our servers. We retain billing records (amount,
          date, plan, billing email) for accounting and tax purposes.
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          1.5 Technical and usage data
        </h3>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>IP address, browser type, operating system, device identifiers</li>
          <li>Login times, session duration, pages visited, features used</li>
          <li>Error logs and diagnostic information</li>
          <li>Cookies and similar tracking technologies (see Section 8)</li>
        </ul>
      </section>

      {/* 2. How we use information */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          2. How We Use Information
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          We use the information we collect for the following purposes (legal
          bases under GDPR shown in brackets):
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-gray-700 text-sm">
          <li>
            <strong>Service provision</strong>: message classification, board
            management, notifications, group protection, AI assistance
            [contractual necessity]
          </li>
          <li>
            <strong>Account management</strong>: authentication, billing,
            support [contractual necessity]
          </li>
          <li>
            <strong>Service improvement</strong>: performance analytics, bug
            fixes, feature development [legitimate interest]
          </li>
          <li>
            <strong>Communication</strong>: service announcements, security
            alerts, billing notices [contractual necessity / legitimate
            interest]
          </li>
          <li>
            <strong>Safety and abuse prevention</strong>: detecting misuse,
            preventing fraud, protecting users [legitimate interest]
          </li>
          <li>
            <strong>Legal compliance</strong>: tax, accounting, regulatory
            requirements [legal obligation]
          </li>
          <li>
            <strong>Marketing</strong>: only with your explicit, separately-
            given consent [consent — withdrawable at any time]
          </li>
        </ul>
      </section>

      {/* 3. Google API specific section - REQUIRED for verification */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          3. Google API Services — Limited Use Disclosure
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          TaskFlow AI&apos;s use and transfer of information received from
          Google APIs to any other app will adhere to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
            target="_blank"
            rel="noreferrer"
            className="text-purple-600 hover:underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          What we access
        </h3>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm mb-4">
          <li>
            Google Drive: only files created by the TaskFlow application or
            files you explicitly open with the TaskFlow application via the
            Google file picker (the <code>drive.file</code> scope)
          </li>
          <li>
            Google Sheets: read and write access to spreadsheets you
            explicitly designate as TaskFlow sync destinations
          </li>
          <li>Your Google profile email address and profile picture</li>
        </ul>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          What we do not do
        </h3>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm mb-4">
          <li>
            We <strong>do not</strong> use Google user data to serve
            advertising
          </li>
          <li>
            We <strong>do not</strong> sell, rent, or transfer Google user
            data to third parties
          </li>
          <li>
            We <strong>do not</strong> use Google user data to train
            generalized AI/ML models
          </li>
          <li>
            We <strong>do not</strong> read or process any files in your
            Google Drive that you did not explicitly share with the TaskFlow
            application
          </li>
          <li>
            Human access to Google user data is limited to: (a) with your
            explicit consent, (b) for security purposes (e.g., investigating
            abuse), (c) to comply with applicable law, or (d) for aggregated
            and anonymized internal operations
          </li>
        </ul>

        <h3 className="font-semibold text-gray-900 mb-2 text-base">
          How to revoke access
        </h3>
        <p className="text-gray-700 text-sm">
          You may revoke TaskFlow&apos;s access to your Google account at any
          time by visiting{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="text-purple-600 hover:underline"
          >
            myaccount.google.com/permissions
          </a>{' '}
          or by clicking &ldquo;Disconnect&rdquo; in your TaskFlow integration
          settings. Revoking access stops future synchronization; data
          previously synced to your own Google Drive/Sheets remains in your
          possession.
        </p>
      </section>

      {/* 4. Sharing */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          4. How We Share Information
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          We do not sell your personal information. We share data only with
          the following categories of recipients:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-gray-700 text-sm">
          <li>
            <strong>Service providers (sub-processors)</strong>: Supabase
            (database, EU/US), Vercel (hosting, US), OpenAI (AI inference,
            US), Anthropic (AI inference, US), Cardcom (payments, Israel),
            Green API (WhatsApp gateway, multiple regions), Resend (email,
            US), Google (when integration is enabled). Each is bound by a
            data processing agreement
          </li>
          <li>
            <strong>Other workspace members</strong>: data within your
            workspace is visible to other members you have invited
          </li>
          <li>
            <strong>Legal authorities</strong>: when required by valid legal
            process (court order, subpoena), and only to the minimum extent
            required by law
          </li>
          <li>
            <strong>Business transfers</strong>: in the event of a merger,
            acquisition, or asset sale, with notice to you and the
            opportunity to delete your data
          </li>
        </ul>
      </section>

      {/* 5. Retention */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          5. Data Retention
        </h2>
        <ul className="list-disc pl-6 space-y-1.5 text-gray-700 text-sm">
          <li>
            <strong>Account data</strong>: retained for as long as your
            account is active, plus 90 days after deletion
          </li>
          <li>
            <strong>Message metadata</strong>: per your selected plan (Trial:
            7 days; Starter: 30; Business: 90; Enterprise: 365)
          </li>
          <li>
            <strong>Message content</strong>: processed in real-time, not
            stored long-term unless explicitly enabled by you
          </li>
          <li>
            <strong>Billing records</strong>: 7 years (Israeli tax law
            requirement)
          </li>
          <li>
            <strong>OAuth tokens</strong>: until you disconnect the
            integration or your account is deleted
          </li>
          <li>
            <strong>Backup data</strong>: up to 30 days after primary data
            deletion
          </li>
        </ul>
      </section>

      {/* 6. Your rights */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          6. Your Rights
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          Depending on your jurisdiction, you have the following rights:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-gray-700 text-sm mb-3">
          <li>
            <strong>Access</strong>: request a copy of the data we hold about
            you
          </li>
          <li>
            <strong>Correction</strong>: ask us to fix inaccurate or
            incomplete data
          </li>
          <li>
            <strong>Erasure (&ldquo;right to be forgotten&rdquo;)</strong>:
            request deletion of your personal data, subject to legal
            retention obligations
          </li>
          <li>
            <strong>Portability</strong>: receive your data in a structured,
            machine-readable format
          </li>
          <li>
            <strong>Restriction of processing</strong>: limit how we use your
            data in specific circumstances
          </li>
          <li>
            <strong>Objection</strong>: object to processing based on
            legitimate interests or direct marketing
          </li>
          <li>
            <strong>Withdrawal of consent</strong>: where processing is based
            on consent, you may withdraw it at any time
          </li>
          <li>
            <strong>Lodge a complaint</strong>: with your local data
            protection authority (e.g., the Israeli Privacy Protection
            Authority, or your EU Member State&apos;s DPA)
          </li>
        </ul>
        <p className="text-gray-700 text-sm mb-3">
          <strong>California residents (CCPA/CPRA)</strong>: you additionally
          have the right to know what categories of personal information we
          collect and disclose, the right to non-discrimination for exercising
          your rights, and the right to opt out of any &ldquo;sale&rdquo; or
          &ldquo;sharing&rdquo; of personal information (we do not sell or
          share for cross-context advertising).
        </p>
        <p className="text-gray-700 text-sm">
          To exercise any of these rights, email us at{' '}
          <a href="mailto:privacy@taskflow-ai.com" className="text-purple-600 hover:underline">
            privacy@taskflow-ai.com
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      {/* 7. International transfers */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          7. International Data Transfers
        </h2>
        <p className="text-gray-700 text-sm">
          We are based in Israel. Data may be processed in Israel, the
          European Union, the United States, and other countries where our
          sub-processors operate. For transfers from the EU/EEA, we rely on
          the European Commission&apos;s adequacy decision regarding Israel,
          and Standard Contractual Clauses (SCCs) where applicable. By using
          the Service, you consent to such transfers.
        </p>
      </section>

      {/* 8. Cookies */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          8. Cookies and Tracking
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          We use the following categories of cookies:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>
            <strong>Strictly necessary</strong>: authentication session,
            workspace selection, CSRF protection — cannot be disabled
          </li>
          <li>
            <strong>Functional</strong>: language preference, UI state — can
            be disabled in your browser settings
          </li>
          <li>
            <strong>Analytics</strong>: aggregated usage statistics (no
            individual user tracking by third parties)
          </li>
        </ul>
      </section>

      {/* 9. Security */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          9. Security
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          We implement industry-standard technical and organizational measures
          to protect your data:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
          <li>TLS 1.3 encryption in transit</li>
          <li>AES-256 encryption at rest (database and backups)</li>
          <li>AES-256-GCM encryption for OAuth tokens</li>
          <li>Hashed passwords (bcrypt or equivalent)</li>
          <li>Role-based access controls; least-privilege principle for staff</li>
          <li>Row-level security policies in our database</li>
          <li>Regular security audits and penetration testing</li>
          <li>Incident response procedures with notification within 72 hours of confirmed breach (per GDPR)</li>
        </ul>
        <p className="text-gray-700 text-sm mt-3">
          No system is 100% secure. You are responsible for safeguarding your
          login credentials.
        </p>
      </section>

      {/* 10. Children */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          10. Children&apos;s Privacy
        </h2>
        <p className="text-gray-700 text-sm">
          The Service is not intended for users under the age of 16 (or the
          age of digital consent in your jurisdiction, whichever is higher).
          We do not knowingly collect personal information from children. If
          you believe we have collected such information, please contact us
          for immediate deletion.
        </p>
      </section>

      {/* 11. Changes */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          11. Changes to This Policy
        </h2>
        <p className="text-gray-700 text-sm">
          We may update this Privacy Policy from time to time. Material
          changes will be notified by email and via an in-app banner at least
          30 days before they take effect. Continued use of the Service after
          the effective date constitutes acceptance of the revised policy.
        </p>
      </section>

      {/* 12. Contact */}
      <section className={sectionClass}>
        <h2 className="font-display font-bold text-xl text-gray-900 mb-3">
          12. Contact Us
        </h2>
        <p className="text-gray-700 text-sm mb-3">
          Data Controller: <strong>AllChat J4U Ltd.</strong> (Israeli company
          number 515738813), Petah Tikva, Israel.
        </p>
        <ul className="list-none space-y-1 text-gray-700 text-sm">
          <li>Privacy inquiries: <a href="mailto:privacy@taskflow-ai.com" className="text-purple-600 hover:underline">privacy@taskflow-ai.com</a></li>
          <li>General support: <a href="mailto:support@taskflow-ai.com" className="text-purple-600 hover:underline">support@taskflow-ai.com</a></li>
          <li>Legal notices: <a href="mailto:legal@taskflow-ai.com" className="text-purple-600 hover:underline">legal@taskflow-ai.com</a></li>
        </ul>
        <p className="text-gray-700 text-sm mt-3">
          For EU users: we have not appointed a representative in the EU at
          this time, as we do not regularly process EU residents&apos; data on
          a large scale. You may still contact us at the address above.
        </p>
      </section>
    </div>
  );
}
