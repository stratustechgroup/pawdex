import { ProductSurface } from "@/components/marketing/product-surface";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

// The hero leads with the thing no competitor has.
//
// docs/competitive-landscape.md is explicit that AI document extraction,
// records-grounded Q&A, family sharing and reminders are commoditized or
// commoditizing fast, and that MyPetID ships the first three free today. Its
// instruction is literal: "do not lead marketing with these."
//
// The previous headline led with exactly those ("Forward any vet document. It
// becomes one dated, cited timeline"), which is the half of the product a
// visitor can already get elsewhere for nothing.
//
// What the same document lists as genuinely differentiated, with no direct
// competitor found: owner-to-owner transfer of the full medical record at a
// change of custody. That is now the headline. The extraction is still in the
// lead sentence, where it belongs, as the mechanism rather than the promise.
//
// The claim is also the true one about the architecture: pets are decoupled
// from households precisely so the record survives a change of hands.
//
// Linear, Mercury and Oura were all read side by side before this was written,
// and they agree on the shape of a hero that works:
//
//   - the headline is large and short, two lines, and it starts well down the
//     viewport rather than at the top of it
//   - the lead is ONE sentence, not a paragraph
//   - there is one call to action, small, not a wall of form
//   - and one large real visual carries the rest of the fold
//
// The previous version had a 42px headline in a narrow column beside a 500px
// product card, with the rest of the fold empty. It read as a wireframe. The
// visual is now the widest thing on the page.
export function Hero() {
  return (
    <section className="mk-hero" id="hero">
      <div className="mk-container">
        <div className="mk-hero-copy">
          <h1 className="mk-display mk-hero-title">
            Their history
            <br />
            <em>goes with them.</em>
          </h1>
          <p className="mk-lead mk-hero-lead">
            Forward any vet document and it becomes one dated, cited record.
            Rehome or adopt them out, and the whole record transfers to the
            next family intact.
          </p>
          <div className="mk-hero-cta">
            <WaitlistForm source="hero" />
          </div>
        </div>
      </div>

      <div className="mk-hero-visual">
        <ProductSurface />
      </div>

      <div className="mk-hero-sentinel" aria-hidden="true" />
    </section>
  );
}
