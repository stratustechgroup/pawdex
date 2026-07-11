import type { Metadata } from "next";

import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service | Pawdex",
  description:
    "The terms for using Pawdex during early access. Pawdex organizes veterinary records; it does not provide veterinary or medical advice.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms of Service"
      updated="Effective July 10, 2026"
    >
      <p className="mk-legal-lead">
        These terms govern your use of Pawdex. They are meant to be fair and
        readable. By creating an account or using the service, you agree to
        them.
      </p>

      <h2>Early access</h2>
      <p>
        Pawdex is in early access. That means the product is still evolving:
        features may change, break, or be added, and we may adjust how the
        service works as we learn. We will do our best to keep your data intact
        and to give you notice of meaningful changes, but you should not treat
        an early-access product as your only copy of anything irreplaceable.
      </p>

      <h2>Pawdex is not veterinary or medical advice</h2>
      <p>
        Pawdex organizes and structures the veterinary records you give it. It
        is a records-organization tool, not a veterinary provider, and it does
        not practice veterinary medicine. Nothing in Pawdex, including extracted
        facts, summaries, reminders, or risk information, is veterinary or
        medical advice, diagnosis, or treatment. Always rely on a licensed
        veterinarian for decisions about your animal&apos;s health. Automated
        extraction can contain errors; verify anything important against the
        original document, which Pawdex keeps and links for exactly that reason.
        In an emergency, contact a veterinarian, not the app.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your account credentials secure and for
        activity that happens under your account. Tell us promptly at{" "}
        <a href="mailto:support@pawdex.co">support@pawdex.co</a> if you suspect
        unauthorized use. You must be old enough to form a binding contract to
        use Pawdex, and the service is not directed to children under 13.
      </p>

      <h2>Subscriptions, billing, and cancellation</h2>
      <p>
        Pawdex has a free tier that stays free. The core of the product, keeping
        your pets&apos; records organized, searchable, and exportable, does not
        require a paid plan, and we do not ask for a card to use it.
      </p>
      <p>
        If you choose a paid plan, here is how billing works. A paid plan
        renews automatically at the end of each billing period (monthly or
        annual, whichever you pick) at the price shown when you subscribed,
        until you cancel. We show the renewal terms and the exact amount next to
        where you confirm, and we send you a confirmation after you subscribe
        that repeats the plan, the amount, the billing date, and how to cancel.
        You are charged to the payment method you provide.
      </p>
      <p>
        You can cancel at any time, online, from your account settings. There is
        no phone call and no email to write. Cancellation is at least as easy as
        signing up was. When you cancel, your paid features stay active through
        the end of the period you already paid for, and then your account moves
        to the free tier. It does not lock.
      </p>
      <p>
        Your records are never held hostage to a subscription. Viewing your
        pets&apos; records and exporting your full data stay available for free,
        forever, including after you cancel a paid plan, downgrade, or let a plan
        lapse. A paid plan adds features; it is never the key to your own data.
      </p>
      <p>
        Refunds: monthly plans are not pro-rated, so if you cancel mid-month you
        keep access until the period ends and are not billed again. For annual
        plans we offer a 14-day cooling-off period: if you cancel within 14 days
        of the initial charge or a renewal, we refund that charge in full.
        Outside those windows, payments are non-refundable except where the law
        requires otherwise.
      </p>
      <p>
        If we ever raise the price of a plan you are on, we will tell you before
        the change takes effect, no fewer than seven and no more than thirty days
        ahead, in a message you can keep, and we will tell you how to cancel if
        you do not want to continue at the new price. A price increase never
        applies to a period you have already paid for.
      </p>
      <p>
        Early-access members who join before general availability keep the plan
        and price they signed up at for as long as they stay subscribed, even if
        our public pricing later goes up. If you leave and come back, current
        pricing applies.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Upload content you do not have the right to upload, or that infringes
          someone else&apos;s rights.
        </li>
        <li>
          Use Pawdex to break the law, harass others, or send unsolicited or
          deceptive email through our sending features.
        </li>
        <li>
          Attempt to breach, probe, or disrupt the service, other accounts, or
          our infrastructure, or to access data that is not yours.
        </li>
        <li>
          Scrape, resell, or misrepresent the service, or use it to build a
          competing dataset from other users&apos; information.
        </li>
      </ul>

      <h2>Your content and your data</h2>
      <p>
        Your records are yours. You keep all rights to the documents and
        information you put into Pawdex. You grant us the limited permission we
        need to host, process, extract, and display that content in order to
        provide the service to you. You can export your data. We commit to
        giving you a way to take your records with you, in a usable form, so you
        are never locked in.
      </p>

      <h2>Outbound actions on your behalf</h2>
      <p>
        Some features let Pawdex act for you, such as emailing a clinic to
        request records. These run only with your explicit, per-feature consent,
        and you can withdraw that consent at any time. You are responsible for
        the accuracy of the information you ask us to send.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using Pawdex and delete your account at any time. We may
        suspend or terminate an account that violates these terms or that we
        must act on for legal or security reasons; where we reasonably can, we
        will give notice and a chance to export first. On termination, the
        rights granted here end, and we handle your data as described in the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Warranty disclaimer</h2>
      <p>
        Pawdex is provided &quot;as is&quot; and &quot;as available,&quot;
        without warranties of any kind, whether express or implied, including
        fitness for a particular purpose and non-infringement, to the fullest
        extent the law allows. We do not warrant that the service will be
        uninterrupted, error-free, or that automated extraction will be
        complete or accurate.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Pawdex and its team will not be
        liable for indirect, incidental, special, consequential, or punitive
        damages, or for lost data or profits, arising from your use of the
        service. Our total liability for any claim relating to the service will
        not exceed the greater of the amount you paid us in the twelve months
        before the claim or one hundred U.S. dollars. Some jurisdictions do not
        allow certain limitations, so parts of this may not apply to you.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of California, without
        regard to its conflict-of-laws rules. The state and federal courts
        located in California will have jurisdiction over disputes that are not
        otherwise resolved.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as the product grows. If a change is material,
        we will update the effective date and, where appropriate, notify you.
        Continuing to use Pawdex after a change means you accept the updated
        terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms go to{" "}
        <a href="mailto:support@pawdex.co">support@pawdex.co</a>.
      </p>

      <h2>Change log</h2>
      <p>
        July 10, 2026: Added the Subscriptions, billing, and cancellation
        section covering auto-renewal, online cancellation, the permanent free
        tier, the commitment that records viewing and export stay free forever,
        refunds, price-change notice, and early-access grandfathering.
      </p>
    </LegalShell>
  );
}
