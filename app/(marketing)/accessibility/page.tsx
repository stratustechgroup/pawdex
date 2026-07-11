import type { Metadata } from "next";

import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Accessibility | Pawdex",
  description:
    "Pawdex targets WCAG 2.1 Level AA. How we build for accessibility, where we are, and how to reach us if something gets in your way.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <LegalShell
      eyebrow="Commitment"
      title="Accessibility"
      updated="Last reviewed July 10, 2026"
    >
      <p className="mk-legal-lead">
        Your pet&apos;s medical history should be usable by everyone who needs
        it. We build Pawdex to be operable with a keyboard, legible at real-world
        contrast, and understandable with a screen reader.
      </p>

      <h2>Conformance target</h2>
      <p>
        Pawdex aims to conform to the{" "}
        <a
          href="https://www.w3.org/TR/WCAG21/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Web Content Accessibility Guidelines (WCAG) 2.1
        </a>{" "}
        at Level AA. That is the standard we hold new work to, and the bar we
        measure the existing product against.
      </p>

      <h2>What that means in practice</h2>
      <ul>
        <li>
          Every page has a skip-to-content link, landmark regions, and a
          sensible heading order, so you can move around without a mouse.
        </li>
        <li>
          Interactive controls (menus, tabs, dialogs, expandable sections) carry
          the ARIA roles and states assistive technology needs, and show a clear
          focus outline when tabbed to.
        </li>
        <li>
          Form fields have real labels, and status messages are announced to
          screen readers.
        </li>
        <li>
          Text and interface colors are chosen to meet AA contrast in both the
          light and dark themes.
        </li>
        <li>
          Images that carry meaning have text alternatives.
        </li>
      </ul>

      <h2>How we test</h2>
      <p>
        We run automated accessibility checks (axe) against our core pages as
        part of getting this product to launch, and we fix the serious and
        critical issues we find. Automated tools cannot catch everything, so we
        also rely on manual keyboard and screen-reader checks. Accessibility is
        ongoing work, not a one-time pass.
      </p>

      <h2>Known limitations</h2>
      <p>
        Pawdex is in early access and still growing. Some newer or less-traveled
        corners of the product may not yet meet our AA target. If you hit one,
        please tell us: real reports are the fastest way we improve.
      </p>

      <h2>Contact us</h2>
      <p>
        If something in Pawdex is hard or impossible to use, email{" "}
        <a href="mailto:support@pawdex.co">support@pawdex.co</a> with what you
        were trying to do and the assistive technology you use. We will work with
        you directly and prioritize a fix.
      </p>

      <h2>Change log</h2>
      <p>
        July 10, 2026: Reviewed as part of the pre-launch compliance pass. No
        changes to our WCAG 2.1 Level AA target; effective date refreshed.
      </p>
    </LegalShell>
  );
}
