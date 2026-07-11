import type { Metadata } from "next";

import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Pawdex",
  description:
    "How Pawdex collects, uses, and protects your information. We do not sell or share your personal information, and de-identified research participation is a separate, revocable opt-in.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy Policy"
      updated="Effective July 10, 2026"
    >
      <p className="mk-legal-lead">
        Pawdex keeps your pets&apos; medical records in one place. Those records
        are sensitive, and so is your trust. This policy explains what we
        collect, why, who we share it with (a short list of infrastructure
        providers, and no one else), and the rights you have over your data. We
        wrote it to be read, not to be survived.
      </p>

      <h2>Notice at collection</h2>
      <p>
        When you use Pawdex we collect the following categories of personal
        information, for the purposes described:
      </p>
      <ul>
        <li>
          <strong>Account identifiers</strong> such as your name, email address,
          and household details. We use these to create and secure your account,
          sign you in, and communicate with you about the service.
        </li>
        <li>
          <strong>Pet medical documents and records</strong> that you upload,
          forward by email, or photograph (vaccine certificates, SOAP notes, lab
          reports, invoices, and the structured facts we extract from them). We
          use these to build and organize your pet&apos;s medical history, keep
          it searchable, and surface what is due or overdue. This can include
          information about you where it appears in those documents (for
          example, an owner name or contact detail on a vet record).
        </li>
        <li>
          <strong>Usage and device data</strong> such as pages viewed, actions
          taken, approximate performance timings, and basic device or browser
          information. We use this to operate the service, fix problems, and
          understand which features are worth building.
        </li>
      </ul>
      <p>
        We collect this information directly from you, from the documents you
        provide, and, in the case of usage data, automatically as you use the
        product. We do not buy personal information about you from data brokers.
      </p>

      <h2>How we use your information</h2>
      <p>
        We use your information to provide Pawdex: to store and organize your
        records, extract and cite the facts inside them, send reminders and
        transactional email you ask for, respond to support requests, keep the
        service secure, and improve how it works. We only take outbound actions
        on your behalf (such as emailing a vet clinic to request records) with
        your explicit, per-feature consent, and you can withdraw that consent at
        any time.
      </p>

      <h2>We do not sell or share your personal information</h2>
      <p>
        We do not sell your personal information, and we do not share it for
        cross-context behavioral advertising, as those terms are defined under
        California law. We have not done so in the past and we have no plans to.
        There is no advertising network inside Pawdex.
      </p>
      <p>
        Because we do not sell or share your personal information, a Global
        Privacy Control (GPC) signal has nothing to opt you out of. We honor GPC
        as a matter of course: even if your browser sends one, our answer is the
        same, because selling and sharing are simply not part of how Pawdex
        works.
      </p>

      <h2>Analytics, and why there is no cookie banner</h2>
      <p>
        We use Vercel Web Analytics and Vercel Speed Insights to understand which
        pages are used and how fast they load. Both are privacy-first and
        cookieless: they set no advertising or tracking cookies, do not use
        third-party cookies, and do not build a profile that follows you across
        other sites. Visitors are counted using an anonymized hash of the
        incoming request that is discarded within 24 hours, not a persistent
        identifier. The data is aggregate (page, referrer, approximate
        city-level region, device and browser type) and is not used to identify
        you.
      </p>
      <p>
        Because we set no advertising or cross-site tracking cookies, sell
        nothing, and share nothing for advertising, there is no consent banner to
        click through. There is nothing to consent to. If we ever add technology
        that would change this, we will update this policy and ask first.
      </p>

      <h2>De-identified research (separate opt-in, off by default)</h2>
      <p>
        Pawdex is building an optional program to contribute de-identified,
        aggregate records to veterinary and animal-health research. This is
        entirely separate from using the product, and here is exactly how it
        works:
      </p>
      <ul>
        <li>
          <strong>Off by default.</strong> You are never enrolled automatically.
          Nothing is contributed unless you make a distinct, explicit choice to
          participate.
        </li>
        <li>
          <strong>Revocable.</strong> You can turn participation off at any time,
          going forward, from your account.
        </li>
        <li>
          <strong>De-identified.</strong> Before any data is used for research,
          direct identifiers (such as your name, email, and contact details) are
          stripped. Contributions are aggregate and de-identified.
        </li>
        <li>
          <strong>Never re-identified.</strong> We publicly commit that we will
          not attempt to re-identify de-identified data, and we will not permit
          others to do so. We maintain de-identified data as de-identified. This
          commitment is a condition of treating the data as de-identified under
          California law, and we hold ourselves to it.
        </li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We rely on a small set of infrastructure providers to run Pawdex. They
        process personal information only to provide services to us, under
        contracts that prohibit using it for their own purposes. They are
        service providers, not parties we sell or share data with:
      </p>
      <ul>
        <li>
          <strong>Vercel</strong>:application hosting and delivery.
        </li>
        <li>
          <strong>Supabase</strong>:database, authentication, and document
          storage.
        </li>
        <li>
          <strong>OpenRouter</strong>:access to the AI models that read and
          structure your documents.
        </li>
        <li>
          <strong>Resend</strong>:sending and receiving email (reminders,
          transactional messages, and forwarded vet records).
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep your account information and records for as long as your account
        is active, so your pet&apos;s history stays intact and available to you.
        You can delete individual records at any time, and you can delete your
        account, which removes your personal information and documents from the
        active service. We may retain limited information where the law requires
        it, and backups are purged on a rolling schedule. De-identified data,
        once de-identified, is not subject to these deletion mechanics because it
        no longer identifies you.
      </p>

      <h2>Your California privacy rights</h2>
      <p>
        If you are a California resident, the CCPA/CPRA gives you the right to:
      </p>
      <ul>
        <li>
          <strong>Know</strong> what personal information we have collected about
          you and how we use it.
        </li>
        <li>
          <strong>Delete</strong> the personal information we hold about you,
          subject to legal exceptions.
        </li>
        <li>
          <strong>Correct</strong> inaccurate personal information.
        </li>
        <li>
          <strong>Opt out</strong> of the sale or sharing of personal
          information. We do not sell or share, so there is nothing to opt out
          of, but the right stands.
        </li>
        <li>
          <strong>Non-discrimination.</strong> We will never charge you a
          different price or give you a lesser service for exercising these
          rights.
        </li>
      </ul>
      <p>
        You can exercise any of these rights by emailing{" "}
        <a href="mailto:privacy@pawdex.co">privacy@pawdex.co</a>. You may also
        use an authorized agent to make a request on your behalf; we will ask for
        proof of the agent&apos;s authorization and may need to verify your
        identity directly. We will not discriminate against you for exercising
        any of these rights.
      </p>

      <h2>Children</h2>
      <p>
        Pawdex is a product for pet owners and is not directed to children under
        13. We do not knowingly collect personal information from children under
        13. If you believe a child has provided us information, email{" "}
        <a href="mailto:privacy@pawdex.co">privacy@pawdex.co</a> and we will
        delete it.
      </p>

      <h2>Where Pawdex is offered</h2>
      <p>
        Pawdex is offered in the United States and is not directed to, or
        marketed in, the European Economic Area, the United Kingdom, or other
        regions with their own data-transfer regimes. We do not target those
        markets during early access. If you access Pawdex from outside the United
        States, you do so on your own initiative, and your information is
        processed on infrastructure located in the United States. When we open
        Pawdex to those regions, we will update this policy with the additional
        rights and disclosures those laws require.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make a material change to this policy, we will update the effective
        date above and, where appropriate, notify you in the product or by
        email. Continuing to use Pawdex after a change means you accept the
        updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests, or concerns about privacy go to{" "}
        <a href="mailto:privacy@pawdex.co">privacy@pawdex.co</a>. We read every
        one.
      </p>

      <h2>Change log</h2>
      <p>
        July 10, 2026: Added an Analytics section documenting our cookieless
        analytics and why no cookie-consent banner is needed, and a note that
        Pawdex is offered in the United States and not directed to the EEA or UK
        during early access.
      </p>
    </LegalShell>
  );
}
