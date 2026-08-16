import { SiteHeader } from "@/components/marketing/site-header";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { FormatTicker } from "@/components/marketing/format-ticker";
import { Claims } from "@/components/marketing/claims";
import { Faq, FAQS } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ScrollRail } from "@/components/marketing/scroll-rail";
import { Hero } from "@/components/marketing/hero";
import { SceneShoebox } from "@/components/marketing/scene-shoebox";
import { SceneLife } from "@/components/marketing/scene-life";
import { PlanFit } from "@/components/marketing/plan-fit";
import {
  JsonLd,
  softwareApplicationSchema,
  faqPageSchema,
} from "@/components/marketing/structured-data";

// Six chapters, and none of them can be reordered.
//
// That is the whole point. The page this replaced was nine sections that could
// have been shuffled without a visitor noticing, which is what made it read as
// generic: not the palette, not the type, the fact that every section was the
// same shape making an interchangeable point.
//
//   0  Hero          the stake
//   1  Shoebox       the mess becoming a record
//      Ticker        a palate cleanser between the two big scenes
//   2  Life          one animal, litter to senior, the feature strips absorbed
//                    as episodes rather than pitches
//   3  Claims        the rigour, including the citation scene
//   4  Pricing       the fit finder, closing on the waitlist during beta
//      FAQ
//   5  Close         short, still, no motion at all
const CHAPTERS = [
  { id: "hero", label: "The problem" },
  { id: "scene-shoebox", label: "The record" },
  { id: "scene-life", label: "A life" },
  { id: "why-pawdex", label: "The proof" },
  { id: "pricing", label: "Pricing" },
  { id: "waitlist", label: "Early access" },
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
        <ScrollRail chapters={CHAPTERS} />

        <Hero />
        <SceneShoebox />
        <FormatTicker />
        <SceneLife />
        <Claims />

        <section id="pricing">
          {/* No disclosure here: the auto-renewal wording is compliance-owned
              and belongs on the page that actually sells, not on a beta
              waitlist CTA. */}
          <PlanFit disclosure="" cta="waitlist" />
        </section>

        <Faq />

        {/* Chapter 5. After this much scroll, the strongest thing available is
            to stop moving. No parallax, no scene, no ornament. */}
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
            <p
              className="mk-lead"
              style={{ margin: "20px auto 0", maxWidth: "44ch" }}
            >
              Join the waitlist and be first in when we open the doors. Your
              future self, standing in an emergency vet at 2 a.m., says thanks.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 30,
              }}
            >
              <WaitlistForm source="footer-cta" center />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
