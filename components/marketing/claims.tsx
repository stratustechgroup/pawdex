import { Icon } from "@/components/brand/icon";

// Chapter 3, the proof. "What we can do that others can't", four concrete
// claims, each carrying a small proof artifact instead of an icon-and-blurb
// card.
//
// This used to be a three-up grid of equal cards, which is the layout that
// made the page read as interchangeable blocks. It is now an asymmetric
// stack: alternating rows, one claim at a time, with room for the proof to be
// a real artifact rather than a thumbnail. Claim 02 hosts Scene C, where the
// citation stops being a badge and becomes a thing you watch happen.
//
// The quantified stats moved here from the hero. They belong with the rigour
// argument, not above the fold: numbers persuade someone who is already
// interested, and the hero's job is to make them interested.

function TransferDiagram() {
  const stop = (initial: string, label: string, active?: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 74 }}>
      <span
        className="mk-sim-avatar"
        style={{
          width: 44,
          height: 44,
          fontSize: 15,
          background: active ? "var(--pw-accent)" : "var(--pw-accent-soft-2)",
          color: active ? "#f6f4ee" : "var(--pw-accent-fg-on-soft)",
        }}
      >
        {initial}
      </span>
      <span className="mk-small" style={{ fontSize: 11.5, textAlign: "center" }}>
        {label}
      </span>
    </div>
  );
  const arrow = (
    <div
      aria-hidden
      style={{
        flex: 1,
        minWidth: 28,
        display: "flex",
        alignItems: "center",
        transform: "translateY(-12px)",
      }}
    >
      <span style={{ flex: 1, height: 1, background: "var(--pw-border-strong)" }} />
      <Icon name="chevronRight" size={13} style={{ color: "var(--pw-text-subtle)", marginLeft: -2 }} />
    </div>
  );
  return (
    <div aria-hidden="true" style={{ marginTop: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4, paddingTop: 18 }}>
        {stop("H", "the breeder")}
        {arrow}
        {stop("Y", "you", true)}
        {arrow}
        {stop("A", "the adopter")}
      </div>
      <div
        className="mk-card"
        style={{
          marginTop: 16,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="fileCheck" size={15} style={{ color: "var(--pw-accent)", flexShrink: 0 }} />
        <span className="mk-small" style={{ fontSize: 12.5, color: "var(--pw-text-secondary)" }}>
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
    index: "02",
    icon: "link",
    title: "Every fact shows its source.",
    body: "AI that reads medical records has to show its work. Every extracted fact carries a citation to the exact page and paragraph it came from, kept forever, so you can always check the source yourself.",
    proof: (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto", paddingTop: 16 }}>
        <span className="mk-cite">rabies · p.2 ¶4</span>
        <span className="mk-cite">lepto · p.1 ¶3</span>
        <span className="mk-cite">weight · p.2 ¶1</span>
        <span className="mk-cite">T4 &lt;20 · p.4 ¶2</span>
      </div>
    ),
  },
  {
    index: "03",
    icon: "eye",
    title: "A human in the loop. You.",
    body: "Nothing lands on the record until you approve it. Duplicates get flagged with a reversible skip, never silently merged, because a vanished dose is worse than a doubled one.",
    proof: (
      <div
        className="mk-card"
        style={{
          marginTop: "auto",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="checkCircle" size={15} style={{ color: "var(--pw-status-up-dot)", flexShrink: 0 }} />
        <span className="mk-small" style={{ fontSize: 12.5 }}>
          2 added · 1 skipped as duplicate · reviewed by you
        </span>
      </div>
    ),
  },
  {
    index: "04",
    icon: "shieldCheck",
    title: "Your data is not the product.",
    body: "Your name, contacts and location are never shared, full stop. Contributing de-identified records to veterinary research is a separate, unchecked-by-default choice you can revoke anytime.",
    proof: (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto", paddingTop: 16 }}>
        <span
          className="mk-cite"
          style={{ background: "var(--pw-status-up-bg)", color: "var(--pw-status-up-fg)" }}
        >
          PII never shared
        </span>
        <span className="mk-cite">research opt-in · off by default</span>
        <span className="mk-cite">revocable</span>
      </div>
    ),
  },
];

export function Claims() {
  return (
    <section
      id="why-pawdex"
      className="mk-section"
      style={{ background: "var(--pw-surface)" }}
    >
      <div className="mk-container mk-crossfade">
        <span className="mk-eyebrow">Why Pawdex</span>
        <h2 className="mk-h2" style={{ margin: "18px 0 0", maxWidth: "20ch" }}>
          The parts nobody else does.
        </h2>
      </div>

      {/* 01. The widest claim gets the widest treatment. */}
      <div className="mk-claim-row mk-crossfade">
        <div className="mk-claim-row-copy">
          <span className="mk-claim-index">01</span>
          <h3 className="mk-h3 mk-claim-row-title">
            The record belongs to the animal.
          </h3>
          <p className="mk-lead mk-claim-row-body">
            Everywhere else, a pet&apos;s history dies with an owner&apos;s
            login. Pawdex treats the animal as the permanent thing: adopt a dog
            out with a signup link and their entire cited history transfers to
            the new family in one tap.
          </p>
        </div>
        <div className="mk-claim-row-proof">
          <TransferDiagram />
        </div>
      </div>

      {/* 02. This used to be a two-beat pinned scene, three screens tall, to
          make one point: the citation is real and you can follow it. The point
          survives as a static side-by-side. */}
      <div className="mk-claim-row mk-claim-row--flip mk-crossfade">
        <div className="mk-claim-row-copy">
          <span className="mk-claim-index">02</span>
          <h3 className="mk-h3 mk-claim-row-title">
            Every fact shows its source.
          </h3>
          <p className="mk-lead mk-claim-row-body">
            Every extracted fact carries a citation to the exact page it came
            from, kept forever, so you can check it yourself.
          </p>
        </div>
        <div className="mk-claim-row-proof">
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
        </div>
      </div>

      {/* 03 and 04 alternate. */}
      {CLAIMS.slice(1).map((c, i) => (
        <div
          key={c.index}
          className={
            i % 2 === 0
              ? "mk-claim-row mk-crossfade"
              : "mk-claim-row mk-claim-row--flip mk-crossfade"
          }
        >
          <div className="mk-claim-row-copy">
            <span className="mk-claim-index">{c.index}</span>
            <h3 className="mk-h3 mk-claim-row-title">{c.title}</h3>
            <p className="mk-lead mk-claim-row-body">{c.body}</p>
          </div>
          <div className="mk-claim-row-proof">{c.proof}</div>
        </div>
      ))}

      {/* The numbers, where they belong. */}
      <div className="mk-container mk-stats">
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
