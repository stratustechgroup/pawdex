import { SiteHeader } from "@/components/marketing/site-header";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { FormatTicker } from "@/components/marketing/format-ticker";
import { Lifecycle } from "@/components/marketing/lifecycle";
import { Claims } from "@/components/marketing/claims";
import { BreederStrip } from "@/components/marketing/breeder-strip";
import { Faq, FAQS } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  JsonLd,
  softwareApplicationSchema,
  faqPageSchema,
} from "@/components/marketing/structured-data";

// Quantified, honest, product-true. The Flighty lesson: concrete numbers
// beat adjectives.
const STATS = [
  {
    stat: "~1 min",
    label: "to read a 40-page vet chart, cover to cover",
  },
  {
    stat: "100%",
    label: "of extracted facts link back to the exact page of the original document",
  },
  {
    stat: "0",
    label: "records saved without your explicit approval",
  },
];

export default function MarketingHome() {
  return (
    <div id="top">
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <a href="#main" className="mk-skip">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main">
      {/* ------------------------------------------------------------- Hero */}
      <section className="mk-hero">
        <div className="mk-container mk-hero-grid">
          <div>
            <span className="mk-eyebrow mk-reveal">The permanent record for pets</span>
            <h1 className="mk-display mk-reveal" style={{ margin: "24px 0 0", color: "var(--pw-text)" }}>
              They can&apos;t tell you their history. <em>Pawdex can.</em>
            </h1>
            <p className="mk-lead mk-reveal" style={{ margin: "24px 0 0", maxWidth: "46ch" }}>
              Your pet&apos;s medical story is scattered across clinics, inboxes
              and a shoebox of paper. Forward any vet document to Pawdex and it
              becomes one clean, source-cited timeline that stays current for
              life, and follows them wherever life goes.
            </p>
            <div className="mk-reveal" style={{ marginTop: 32 }}>
              <WaitlistForm source="hero" />
            </div>
          </div>
          <HeroVisual />
        </div>

        {/* Quantified claims strip */}
        <div className="mk-container" style={{ marginTop: "clamp(40px, 6vw, 72px)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 0,
              borderTop: "1px solid var(--pw-border)",
            }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.stat}
                style={{
                  padding: "22px 24px 4px",
                  borderLeft: i === 0 ? "none" : "1px solid var(--pw-border)",
                }}
                className="max-sm:!border-l-0"
              >
                <div
                  style={{
                    font: "600 clamp(22px, 2.6vw, 30px) var(--mk-mono)",
                    letterSpacing: "-0.02em",
                    color: "var(--pw-accent)",
                  }}
                >
                  {s.stat}
                </div>
                <div className="mk-small" style={{ marginTop: 6, maxWidth: "30ch" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reads-everything ticker */}
      <FormatTicker />

      <Lifecycle />
      <Claims />
      <BreederStrip />
      <Faq />

      {/* -------------------------------------------------------- Final CTA */}
      <section id="waitlist" className="mk-final">
        <div className="mk-container" style={{ position: "relative" }}>
          <span className="mk-eyebrow" style={{ justifyContent: "center" }}>
            Early access
          </span>
          <h2
            className="mk-display"
            style={{
              margin: "22px auto 0",
              maxWidth: "14ch",
              fontSize: "clamp(40px, 6.4vw, 76px)",
              color: "var(--pw-text)",
            }}
          >
            One timeline. <em>For life.</em>
          </h2>
          <p className="mk-lead" style={{ margin: "20px auto 0", maxWidth: "44ch" }}>
            Join the waitlist and be first in when we open the doors. Your
            future self, standing in an emergency vet at 2 a.m., says thanks.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
            <WaitlistForm source="footer-cta" center />
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
