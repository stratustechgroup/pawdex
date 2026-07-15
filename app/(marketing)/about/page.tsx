import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Icon } from "@/components/brand/icon";
import {
  JsonLd,
  aboutPageSchema,
  organizationSchema,
} from "@/components/marketing/structured-data";

const TITLE = "About · Pawdex";
const DESCRIPTION =
  "Why Pawdex exists: one medical history that belongs to your pet and travels with them for life. What we built, what we believe, and where we are during early access.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    siteName: "Pawdex",
    url: "/about",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Where a pet's history actually lives before Pawdex. Rendered as a small
// artifact rather than a bulleted list, matching the marketing surface.
const SCATTER = [
  "A clinic patient portal you forgot the password to",
  "A PDF a receptionist emailed two years ago",
  "A rabies certificate folded in a drawer",
  "The last vet's system, in the city you moved from",
];

// The documents Pawdex reads, kept to the About fact list.
const DOC_TYPES = [
  "vaccine certificates",
  "visit summaries",
  "lab reports",
  "invoices",
  "EU pet passports",
  "insurance policies",
];

const STEPS = [
  {
    index: "01",
    title: "Send it any way you have it.",
    body: "Upload a file, snap a photo, or forward the email straight from your vet. Messy phone photos and forwarded PDFs are the normal case here, not the exception.",
  },
  {
    index: "02",
    title: "Every fact cites its source.",
    body: "The AI reads the document and pulls out the structured facts, and each one links back to the exact page it came from. You can always check it against the original.",
  },
  {
    index: "03",
    title: "Nothing is saved until you approve.",
    body: "You see what was found before it lands on the record. Confirm it, fix it, or skip it. The record is yours, and it only ever holds what you signed off on.",
  },
];

const VALUES = [
  {
    index: "01",
    title: "Your records are never held hostage.",
    body: "Viewing and exporting your data is free forever, including after you cancel. A paid plan can add features. It is never the key to your own history.",
  },
  {
    index: "02",
    title: "Privacy is the default, not a setting.",
    body: "Your identity and location are never shared. Contributing de-identified records to veterinary research is a separate choice, off by default, and revocable at any time.",
  },
  {
    index: "03",
    title: "Honest about what this is.",
    body: "Pawdex organizes records. It is not veterinary or medical advice, and it never replaces your vet. When something matters, confirm it with them.",
  },
  {
    index: "04",
    title: "US-only, for now, on purpose.",
    body: "We are building for the United States first so we can do it properly, rather than half-serving everywhere at once. More comes later, carefully.",
  },
];

export default function AboutPage() {
  return (
    <div id="top">
      <JsonLd data={aboutPageSchema()} />
      <JsonLd data={organizationSchema()} />
      <a href="#main" className="mk-skip">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main">
        {/* ---------------------------------------------------------- Hero */}
        <section className="mk-hero">
          <div className="mk-container">
            <span className="mk-eyebrow mk-reveal">About Pawdex</span>
            <h1
              className="mk-display mk-reveal"
              style={{ margin: "24px 0 0", maxWidth: "16ch", color: "var(--pw-text)" }}
            >
              Why Pawdex <em>exists.</em>
            </h1>
            <p
              className="mk-lead mk-reveal"
              style={{ margin: "24px 0 0", maxWidth: "56ch" }}
            >
              A pet cannot carry a folder. Their medical story ends up scattered
              across clinics, patient portals, emailed PDFs and paper in a
              drawer, and the one time you need all of it in one place, it
              isn&apos;t. Pawdex exists to end that: one medical history that
              belongs to the pet and stays with them for life.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------ The problem */}
        <section className="mk-section" style={{ background: "var(--pw-surface)" }}>
          <div className="mk-container mk-band-grid">
            <div>
              <span className="mk-eyebrow">The problem</span>
              <h2 className="mk-h2" style={{ margin: "18px 0 0", maxWidth: "18ch" }}>
                A life&apos;s worth of records, in a dozen places.
              </h2>
              <p className="mk-lead" style={{ margin: "18px 0 0", maxWidth: "46ch" }}>
                Every vaccine, every visit, every lab result is written down
                somewhere. The trouble is where. On their own, each piece is
                fine. Together, at the moment it matters, they may as well not
                exist.
              </p>
              <p className="mk-lead" style={{ margin: "16px 0 0", maxWidth: "46ch" }}>
                And it always matters at the worst time: dropping off for a
                boarding stay, sitting in a new vet&apos;s exam room, standing in
                an emergency clinic at 2 a.m., or handing a dog to the family
                adopting them. That is exactly when a scattered history becomes
                no history at all.
              </p>
            </div>

            <div
              className="mk-card"
              style={{ padding: "clamp(20px, 3vw, 30px)" }}
            >
              <span
                className="mk-mono-tag"
                style={{ color: "var(--pw-text-muted)", letterSpacing: "0.08em" }}
              >
                WHERE IT LIVES TODAY
              </span>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column" }}>
                {SCATTER.map((place, i) => (
                  <div
                    key={place}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="mk-status-dot"
                      style={{
                        background: "var(--pw-status-incomplete-dot)",
                        marginTop: 7,
                      }}
                    />
                    <span
                      className="mk-small"
                      style={{ fontSize: 13.5, color: "var(--pw-text-secondary)" }}
                    >
                      {place}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- What we built */}
        <section className="mk-section">
          <div className="mk-container">
            <span className="mk-eyebrow">What we built</span>
            <h2 className="mk-h2" style={{ margin: "18px 0 0", maxWidth: "20ch" }}>
              Forward the paper. Get a record.
            </h2>
            <p className="mk-lead" style={{ margin: "18px 0 0", maxWidth: "52ch" }}>
              Pawdex is one job done well. You send any vet document, however you
              have it, and AI turns it into a structured, searchable, on-schedule
              medical history you can actually trust.
            </p>

            <div
              style={{
                marginTop: 22,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {DOC_TYPES.map((d) => (
                <span key={d} className="mk-cite">
                  {d}
                </span>
              ))}
            </div>

            <div
              style={{
                marginTop: "clamp(28px, 4vw, 44px)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 18,
              }}
            >
              {STEPS.map((s) => (
                <div
                  key={s.index}
                  className="mk-card"
                  style={{
                    padding: "clamp(22px, 3vw, 30px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <span className="mk-claim-index">{s.index}</span>
                  <h3 className="mk-h3" style={{ margin: 0, color: "var(--pw-text)" }}>
                    {s.title}
                  </h3>
                  <p className="mk-lead" style={{ margin: 0, fontSize: 15.5 }}>
                    {s.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Portable record: the capability that sets Pawdex apart. */}
            <div
              className="mk-card"
              style={{
                marginTop: 18,
                padding: "clamp(24px, 3.4vw, 36px)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <span className="mk-claim-index">The record is portable</span>
              <h3 className="mk-h3" style={{ margin: 0, color: "var(--pw-text)", maxWidth: "24ch" }}>
                The record belongs to the pet, not the account.
              </h3>
              <p className="mk-lead" style={{ margin: 0, fontSize: 16, maxWidth: "62ch" }}>
                Because the history is tied to the animal, it can move with them.
                When a pet changes hands, adoption, rehoming, or a breeder placing
                a puppy, one transfer link hands the full cited history to the new
                family in a single step. Nobody has to start from a shrug.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span className="mk-cite">breeder</span>
                <Icon
                  name="chevronRight"
                  size={13}
                  style={{ color: "var(--pw-text-subtle)" }}
                />
                <span className="mk-cite">you</span>
                <Icon
                  name="chevronRight"
                  size={13}
                  style={{ color: "var(--pw-text-subtle)" }}
                />
                <span className="mk-cite">the adopter</span>
                <span
                  className="mk-small"
                  style={{ fontSize: 12.5, marginLeft: 4 }}
                >
                  one link, the whole history moves
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- What we believe */}
        <section className="mk-section" style={{ background: "var(--pw-surface)" }}>
          <div className="mk-container">
            <span className="mk-eyebrow">What we believe</span>
            <h2 className="mk-h2" style={{ margin: "18px 0 0", maxWidth: "20ch" }}>
              The principles we won&apos;t trade.
            </h2>

            <div className="mk-claims-grid" style={{ marginTop: "clamp(28px, 4vw, 48px)" }}>
              {VALUES.map((v) => (
                <div key={v.index} className="mk-card mk-claim">
                  <span className="mk-claim-index">{v.index}</span>
                  <h3 className="mk-h3" style={{ margin: 0, color: "var(--pw-text)" }}>
                    {v.title}
                  </h3>
                  <p className="mk-lead" style={{ margin: 0, fontSize: 15.5 }}>
                    {v.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Where we are */}
        <section className="mk-section">
          <div className="mk-container mk-band-grid">
            <div>
              <span className="mk-eyebrow">Where we are</span>
              <h2 className="mk-h2" style={{ margin: "18px 0 0", maxWidth: "16ch" }}>
                Early, and honest about it.
              </h2>
            </div>
            <div>
              <p className="mk-lead" style={{ margin: 0, maxWidth: "52ch" }}>
                Pawdex is in early access. We are onboarding the waitlist in small
                batches so every household gets a fast, attentive start instead of
                a crowded launch.
              </p>
              <p className="mk-lead" style={{ margin: "16px 0 0", maxWidth: "52ch" }}>
                We are small and still building, and we would rather say that than
                dress it up. There is no big company behind the curtain, no long
                list of logos, no numbers we have to inflate. There is a product
                we are getting right, one record at a time.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Final CTA */}
        <section className="mk-final">
          <div className="mk-container" style={{ position: "relative" }}>
            <span className="mk-eyebrow" style={{ justifyContent: "center" }}>
              Early access
            </span>
            <h2
              className="mk-display"
              style={{
                margin: "22px auto 0",
                maxWidth: "15ch",
                fontSize: "clamp(40px, 6.4vw, 76px)",
                color: "var(--pw-text)",
              }}
            >
              Give them a history <em>that lasts.</em>
            </h2>
            <p className="mk-lead" style={{ margin: "20px auto 0", maxWidth: "44ch" }}>
              Join the waitlist and be first in when we open the doors. One
              timeline for your pet, ready the moment you need it.
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
              <Link href="/#waitlist" className="mk-btn">
                Join the waitlist
                <Icon name="arrowRight" size={15} className="mk-btn-arrow" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
