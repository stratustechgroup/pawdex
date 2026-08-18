import { SiteHeader } from "@/components/marketing/site-header";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { Claims } from "@/components/marketing/claims";
import { Faq, FAQS } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PlanFit } from "@/components/marketing/plan-fit";
import {
  JsonLd,
  softwareApplicationSchema,
  faqPageSchema,
} from "@/components/marketing/structured-data";

// Five sections. Roughly five screens.
//
// The version this replaces ran to eighteen screens, and a visitor had to
// scroll past fifteen of them to reach a price. Two pinned scroll scenes were
// five screens each, and a third sat inside the proof section. They were built
// to order and they were well made, and none of that matters: a marketing page
// where nothing is quickly reachable has failed at the only job it has.
//
// What was kept from that work: the real product components, the type, the flat
// treatment. What went: the scroll narrative, the progress rail, and the
// ticker. Every section below is now within about one screen of the one before
// it, and the header nav jumps to all of them.
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
        <Hero />
        <HowItWorks />
        <Claims />

        <section id="pricing">
          <PlanFit disclosure="" cta="waitlist" />
        </section>

        <Faq />

        <section id="waitlist" className="mk-final">
          <div className="mk-container">
            <h2 className="mk-display mk-final-title">
              One timeline. <em>For life.</em>
            </h2>
            <p className="mk-lead mk-final-lead">
              Join the waitlist and be first in when we open the doors.
            </p>
            <div className="mk-final-cta">
              <WaitlistForm source="footer-cta" center />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
