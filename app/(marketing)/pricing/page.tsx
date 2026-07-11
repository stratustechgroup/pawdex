import type { Metadata } from "next";

import "./pricing.css";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { PricingFaq } from "@/components/marketing/pricing-faq";

const TITLE = "Pricing · Pawdex";
const DESCRIPTION =
  "Simple, honest pricing. Free forever for one or two pets, Household for the multi-pet family, and Breeder for kennels. Your records are always free to view and export.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    siteName: "Pawdex",
    url: "/pricing",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// COMPLIANCE-OWNED: short per-tier disclosure placed under each paid card. The
// compliance agent supplies the final CA-ARL auto-renewal wording; this is the
// interim placeholder until it lands. Kept short here (the full version lives
// in the pricing FAQ).
const TIER_DISCLOSURE =
  "Renews automatically at the listed price until cancelled. Cancel anytime online in Settings → Billing.";

export default function PricingPage() {
  return (
    <div id="top">
      <a href="#pricing-tiers" className="mk-skip">
        Skip to plans
      </a>
      <SiteHeader />

      <main id="main">
        <section className="pr-hero">
          <div className="mk-container">
            <span className="mk-eyebrow">Pricing</span>
            <h1 className="mk-display" style={{ marginTop: 18 }}>
              Priced to be your <em>record for life</em>.
            </h1>
            <p
              className="mk-lead"
              style={{ maxWidth: 560, margin: "20px auto 0" }}
            >
              A generous free tier that is a real home, not a trial. Pay only
              when you have more pets or want more from the AI. Your records stay
              free to view and export, forever, on every plan.
            </p>

            <div className="pr-banner">
              <span aria-hidden style={{ display: "inline-flex" }}>
                ✨
              </span>
              Everything is free during early access.{" "}
              <a
                href="#pricing-waitlist"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                Join the waitlist
              </a>{" "}
              to lock in a launch discount.
            </div>
          </div>
        </section>

        <section id="pricing-tiers" className="mk-container">
          <PricingTiers disclosure={TIER_DISCLOSURE} />

          <p
            className="mk-small"
            style={{ textAlign: "center", marginTop: 28, maxWidth: 640, marginInline: "auto" }}
          >
            Prices in USD. Breeder includes everything in Household plus litters,
            placement transfers, and kennel branding, with a friendly soft cap at
            50 active animals, never a hard lock on your records.
          </p>
        </section>

        <PricingFaq />

        <section id="pricing-waitlist" className="pr-cta">
          <div className="mk-container">
            <span className="mk-eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>
              Early access
            </span>
            <h2 className="mk-h2" style={{ marginTop: 16 }}>
              Start free while we&apos;re in <em>beta</em>.
            </h2>
            <p
              className="mk-lead"
              style={{ maxWidth: 500, margin: "16px auto 28px" }}
            >
              Payments aren&apos;t live yet, everyone on the waitlist gets every
              feature free during early access, and a grandfathered discount when
              paid plans launch.
            </p>
            <WaitlistForm source="pricing" center />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
