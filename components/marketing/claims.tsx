import { Icon } from "@/components/brand/icon";

// "What we can do that others can't." Four concrete claims, each carrying a
// small proof artifact instead of an icon-and-blurb card.

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

const CLAIMS = [
  {
    index: "02",
    icon: "link",
    title: "Proof, not vibes.",
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
    <section id="why-pawdex" className="mk-section" style={{ background: "var(--pw-surface)" }}>
      <div className="mk-container">
        <span className="mk-eyebrow mk-reveal">Why Pawdex</span>
        <h2 className="mk-h2 mk-reveal" style={{ margin: "18px 0 0", maxWidth: "20ch" }}>
          The parts nobody else does.
        </h2>

        <div className="mk-claims-grid" style={{ marginTop: "clamp(28px, 4vw, 48px)" }}>
          <div className="mk-card mk-claim mk-claim--wide mk-reveal">
            <div className="mk-claim-wide-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span className="mk-claim-index">01</span>
                <h3 className="mk-h3" style={{ margin: 0, color: "var(--pw-text)" }}>
                  The record follows the animal, not the app account.
                </h3>
                <p className="mk-lead" style={{ margin: 0, fontSize: 16 }}>
                  Everywhere else, a pet&apos;s history dies with an owner&apos;s
                  login. Pawdex treats the animal as the permanent thing: adopt a
                  dog out with a signup link and their entire cited history
                  transfers to the new family in one tap.
                </p>
              </div>
              <TransferDiagram />
            </div>
          </div>

          {CLAIMS.map((c) => (
            <div key={c.index} className="mk-card mk-claim mk-reveal">
              <span className="mk-claim-index">{c.index}</span>
              <h3 className="mk-h3" style={{ margin: 0, color: "var(--pw-text)" }}>
                {c.title}
              </h3>
              <p className="mk-lead" style={{ margin: 0, fontSize: 15.5 }}>
                {c.body}
              </p>
              {c.proof}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
