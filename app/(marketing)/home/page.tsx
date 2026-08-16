import { SiteHeader } from "@/components/marketing/site-header";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { FormatTicker } from "@/components/marketing/format-ticker";
import { Lifecycle } from "@/components/marketing/lifecycle";
import { Claims } from "@/components/marketing/claims";
import { TravelStrip } from "@/components/marketing/travel-strip";
import { BreederStrip } from "@/components/marketing/breeder-strip";
import { Faq, FAQS } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ScrollRail } from "@/components/marketing/scroll-rail";
import { Hero } from "@/components/marketing/hero";
import { SceneShoebox } from "@/components/marketing/scene-shoebox";
import {
  JsonLd,
  softwareApplicationSchema,
  faqPageSchema,
} from "@/components/marketing/structured-data";

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
      <ScrollRail
        chapters={[
          { id: "top", label: "Top" },
          { id: "waitlist", label: "Early access" },
        ]}
      />
      <Hero />
      <SceneShoebox />

      {/* Reads-everything ticker */}
      <FormatTicker />

      <Lifecycle />
      <Claims />
      <TravelStrip />
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
