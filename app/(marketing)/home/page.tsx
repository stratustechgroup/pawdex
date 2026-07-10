import { Icon } from "@/components/brand/icon";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Differentiators } from "@/components/marketing/differentiators";
import { BreederStrip } from "@/components/marketing/breeder-strip";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";

const TRUST = [
  { icon: "mail", text: "Any clinic, any format" },
  { icon: "link", text: "Every fact cited" },
  { icon: "shieldCheck", text: "PII never shared" },
];

export default function MarketingHome() {
  return (
    <div id="top">
      <SiteHeader />

      {/* ---------------------------------------------------------------- Hero */}
      <section
        className="mk-container"
        style={{ paddingBlock: "clamp(48px, 8vw, 104px)" }}
      >
        <div
          className="mk-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <span className="mk-eyebrow mk-reveal">
              <Icon name="sparkles" size={12} />
              Pet medical records, finally organized
            </span>

            <h1
              className="mk-serif mk-display mk-reveal"
              style={{ margin: "22px 0 0", color: "var(--pw-text)" }}
            >
              Every vet record,
              <br />
              one timeline,{" "}
              <span style={{ color: "var(--pw-accent)" }}>for life.</span>
            </h1>

            <p
              className="mk-lead mk-reveal"
              style={{ margin: "22px 0 0", maxWidth: "50ch" }}
            >
              Your pet&apos;s history is scattered across clinics, inboxes and
              paper folders. Forward or snap any vet document and Pawdex turns it
              into a structured, source-cited record that stays current and
              travels with your pet forever.
            </p>

            <div className="mk-reveal" style={{ marginTop: 30 }}>
              <WaitlistForm source="hero" />
            </div>

            <ul
              className="mk-reveal"
              style={{
                listStyle: "none",
                margin: "26px 0 0",
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 22px",
              }}
            >
              {TRUST.map((t) => (
                <li
                  key={t.text}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    font: "500 12.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  <Icon
                    name={t.icon}
                    size={14}
                    style={{ color: "var(--pw-accent)" }}
                  />
                  {t.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mk-reveal">
            <HeroVisual />
          </div>
        </div>
      </section>

      <div className="mk-container">
        <div className="mk-hairline" />
      </div>

      <HowItWorks />
      <Differentiators />
      <BreederStrip />
      <Faq />

      {/* ------------------------------------------------------------ Final CTA */}
      <section id="waitlist" className="mk-section">
        <div className="mk-container">
          <div
            className="mk-card mk-reveal"
            style={{
              padding: "clamp(36px, 6vw, 72px)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span className="mk-eyebrow">Early access</span>
            <h2
              className="mk-serif mk-h2"
              style={{ margin: "20px 0 14px", maxWidth: "18ch", color: "var(--pw-text)" }}
            >
              Give your pet a record that lasts a lifetime.
            </h2>
            <p
              className="mk-lead"
              style={{ margin: "0 0 30px", maxWidth: "48ch" }}
            >
              Join the waitlist for free early access. We will email you the
              moment your spot opens.
            </p>
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              <WaitlistForm source="footer-cta" />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
