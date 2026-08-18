import { PetCardPreview } from "@/components/marketing/product-preview";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

// Chapter 0. The stake, stated before anything is explained.
//
// Two earlier versions of this hero were wrong in the same way. The first
// parked a tidy product mock on the right, arguing the conclusion before making
// the case. The second replaced it with a drifting field of vet paperwork built
// out of styled divs, which is a drawing of documents pretending to be
// documents: the most reliable signal that nobody involved has seen the real
// product.
//
// This one shows the actual product component, the same PawdexPetCard the
// signed-in app renders, next to the sentence that explains why it exists.
// Four text elements, no more: eyebrow, headline, subtext, one CTA.
export function Hero() {
  return (
    <section className="mk-hero mk-hero--split" id="hero">
      <div className="mk-container mk-hero-grid">
        <div className="mk-hero-copy">
          <span className="mk-eyebrow">The permanent record for pets</span>
          <h1 className="mk-display mk-hero-title">
            They can&apos;t tell you their history. <em>Pawdex can.</em>
          </h1>
          <p className="mk-lead mk-hero-lead">
            Forward any vet document. It becomes one dated, source-cited
            timeline that follows your pet for life.
          </p>
          <div className="mk-hero-cta">
            <WaitlistForm source="hero" />
          </div>
        </div>

        <div className="mk-hero-visual">
          <PetCardPreview />
        </div>
      </div>

      {/* Zero-height sentinel: gives a view() timeline something to track so the
          header can react to the hero leaving, with no scroll listener. */}
      <div className="mk-hero-sentinel" aria-hidden="true" />
    </section>
  );
}
