import { PaperField } from "@/components/marketing/paper-field";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

// Chapter 0. The stake, stated before anything is explained.
//
// The old hero put a tidy product mock on the right, which argued the
// conclusion before making the case. This one puts the problem there instead:
// a drifting field of vet paperwork that reads as a kitchen drawer. Scene A
// then resolves that exact field into a record, so the hero image is the setup
// for a payoff rather than a decoration.
//
// Nothing here pins. The first screen has to be scrollable and clickable the
// moment it paints, and the waitlist form stays exactly where it has always
// been.
export function Hero() {
  return (
    <section className="mk-hero mk-hero--field" id="hero">
      <PaperField variant="hero" />

      <div className="mk-container mk-hero-copy">
        <span className="mk-eyebrow mk-reveal">
          The permanent record for pets
        </span>
        <h1
          className="mk-display mk-reveal"
          style={{ margin: "24px 0 0", color: "var(--pw-text)" }}
        >
          They can&apos;t tell you their history. <em>Pawdex can.</em>
        </h1>
        <p
          className="mk-lead mk-reveal"
          style={{ margin: "24px 0 0", maxWidth: "46ch" }}
        >
          Your pet&apos;s medical story is scattered across clinics, inboxes and
          a shoebox of paper. Forward any vet document to Pawdex and it becomes
          one clean, source-cited timeline that stays current for life, and
          follows them wherever life goes.
        </p>
        <div className="mk-reveal" style={{ marginTop: 32 }}>
          <WaitlistForm source="hero" />
        </div>
      </div>

      {/* Sentinel for the header's persistent CTA. Zero height, no paint: its
          only job is to give a view() timeline something to track so the header
          can react to "the hero has left" without a scroll listener. */}
      <div className="mk-hero-sentinel" aria-hidden="true" />
    </section>
  );
}
