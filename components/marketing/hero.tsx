import { ProductSurface } from "@/components/marketing/product-surface";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

// Chapter 0, rebuilt against real references rather than from principles.
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
            They can&apos;t tell you their history.
            <br />
            <em>Pawdex can.</em>
          </h1>
          <p className="mk-lead mk-hero-lead">
            Forward any vet document. It becomes one dated, cited timeline that
            follows your pet for life.
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
