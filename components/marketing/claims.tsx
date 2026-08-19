import { Icon } from "@/components/brand/icon";

// The proof section: what Pawdex does that the alternatives do not.
//
// Shape. This was a three-up grid of equal cards once, which is the layout
// that made the page read as interchangeable blocks, and then an alternating
// stack of two-column rows, which fixed that. It is now a set of ledger
// entries: each claim is numbered in the page's 132px margin, its argument
// sits in the measure, and its proof sits beside the argument. The number was
// previously the first line of the copy column, where it read as decoration.
// In the margin it is doing the job a record's entry number does.
//
// Two things were cleaned up on the way through:
//
//   1. The old CLAIMS array carried four entries but the component rendered
//      the first two as hand-written JSX and mapped only over the tail, so one
//      entry was dead data that still looked authoritative. All four are data
//      now, and all four render the same way.
//   2. The proofs were built out of inline style objects (flex, gap, padding,
//      colours) inline in the markup. Those are classes now; the colours in
//      particular were the one place raw values were reaching the surface
//      outside the token block.
//
// The numbers moved here from the hero deliberately. Figures persuade someone
// who is already interested; the hero's job is to make them interested.

function TransferDiagram() {
  const stop = (initial: string, label: string, active?: boolean) => (
    <div className="mk-xfer-stop">
      <span
        className="mk-xfer-avatar"
        data-active={active ? "true" : undefined}
      >
        {initial}
      </span>
      <span className="mk-xfer-label">{label}</span>
    </div>
  );
  const arrow = (
    <div className="mk-xfer-link" aria-hidden>
      <span className="mk-xfer-line" />
      <Icon name="chevronRight" size={13} className="mk-xfer-chevron" />
    </div>
  );
  return (
    <div aria-hidden="true">
      <div className="mk-xfer">
        {stop("H", "the breeder")}
        {arrow}
        {stop("Y", "you", true)}
        {arrow}
        {stop("A", "the adopter")}
      </div>
      <div className="mk-note">
        <Icon name="fileCheck" size={15} className="mk-note-icon" />
        <span className="mk-note-text">
          Full medical history rides along at every handoff. The old owner keeps
          nothing they shouldn&apos;t; the new owner starts with everything.
        </span>
      </div>
    </div>
  );
}

// Quantified, honest, product-true. Concrete numbers beat adjectives.
const STATS = [
  { stat: "~1 min", label: "to read a 40-page vet chart, cover to cover" },
  {
    stat: "100%",
    label:
      "of extracted facts link back to the exact page of the original document",
  },
  { stat: "0", label: "records saved without your explicit approval" },
];

const CLAIMS = [
  {
    index: "02.1",
    title: "The record belongs to the animal.",
    // The going-home mechanics live in the Moments section now; this entry
    // keeps the guarantee register, not the scenario one.
    body: "Everywhere else, a pet's history dies with an owner's login. Pawdex treats the animal as the permanent thing: whoever holds the leash next inherits the whole cited history, at every change of hands, forever.",
    proof: <TransferDiagram />,
  },
  {
    index: "02.2",
    title: "Every fact shows its source.",
    body: "AI that reads medical records has to show its work. Every extracted fact carries a citation to the exact page it came from, kept forever, so you can check it yourself.",
    proof: (
      <figure className="mk-cite-proof">
        <div className="mk-cite-proof-fact">
          <span className="mk-cite-proof-label">Rabies, 3 year</span>
          <time className="mk-cite-proof-date">2024-03-11</time>
          <span className="mk-cite">p. 14</span>
        </div>
        <figcaption className="mk-cite-proof-cap">
          The badge opens the source page, with the line highlighted.
        </figcaption>
      </figure>
    ),
  },
  {
    index: "02.3",
    title: "A human in the loop. You.",
    body: "Nothing lands on the record until you approve it. Duplicates get flagged with a reversible skip, never silently merged, because a vanished dose is worse than a doubled one.",
    proof: (
      <div className="mk-note">
        <Icon name="checkCircle" size={15} className="mk-note-icon" />
        <span className="mk-note-text">
          2 added &middot; 1 skipped as duplicate &middot; reviewed by you
        </span>
      </div>
    ),
  },
  {
    index: "02.4",
    title: "Your data is not the product.",
    body: "Your name, contacts and location are never shared, full stop. Contributing de-identified records to veterinary research is a separate, unchecked-by-default choice you can revoke anytime.",
    proof: (
      <div className="mk-cite-set">
        <span className="mk-cite mk-cite--affirm">PII never shared</span>
        <span className="mk-cite">research opt-in &middot; off by default</span>
        <span className="mk-cite">revocable</span>
      </div>
    ),
  },
];

export function Claims() {
  return (
    <section id="why-pawdex" className="mk-section mk-claims-tail">
      <div className="mk-ledger">
        <div className="mk-entry-rule" />
        <div className="mk-ledger-body">
          <h2 className="mk-h2 mk-claims-title">The parts nobody else does.</h2>
        </div>
      </div>

      {CLAIMS.map((c) => (
        <div key={c.index} className="mk-ledger mk-claim-row mk-crossfade">
          <div className="mk-ledger-body mk-claim-inner">
            <div className="mk-claim-row-copy">
              <h3 className="mk-h3 mk-claim-row-title">{c.title}</h3>
              <p className="mk-lead mk-claim-row-body">{c.body}</p>
            </div>
            <div className="mk-claim-row-proof">{c.proof}</div>
          </div>
        </div>
      ))}

      {/* The numbers, where they belong. */}
      <div className="mk-stats">
        {STATS.map((s) => (
          <div key={s.stat} className="mk-stat">
            <div className="mk-stat-value">{s.stat}</div>
            <div className="mk-small mk-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
