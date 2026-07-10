import { Icon } from "@/components/brand/icon";

const CARDS = [
  {
    icon: "arrowRight",
    title: "Records that travel with the animal",
    body: "Adopt out, rehome or hand off to a new owner and the full medical history goes with the pet, not stranded in your old inbox. The new family starts with day one, not a blank page.",
  },
  {
    icon: "link",
    title: "Every fact linked to its source",
    body: "Pawdex never asks you to just trust the AI. Each vaccine, weight and dose points back to the exact document and page it was read from, reviewed by a human before it counts.",
  },
  {
    icon: "paw",
    title: "Built for breeders and litters",
    body: "Run a litter ledger, log day-one records for every puppy, and transfer each one to its new home at go-home time with vaccines and vet visits already in place.",
  },
  {
    icon: "shieldCheck",
    title: "Your data stays yours",
    body: "Personally identifying information is never shared, full stop. Contributing de-identified data to research is a separate, explicit opt-in you can revoke at any time.",
  },
];

export function Differentiators() {
  return (
    <section
      id="why"
      className="mk-section"
      style={{ background: "var(--pw-surface-2)" }}
    >
      <div className="mk-container">
        <div className="mk-reveal" style={{ maxWidth: 660 }}>
          <span className="mk-eyebrow">Why Pawdex</span>
          <h2
            className="mk-serif mk-h2"
            style={{ margin: "20px 0 14px", color: "var(--pw-text)" }}
          >
            What a folder of PDFs will never do for you.
          </h2>
          <p className="mk-lead" style={{ maxWidth: "56ch" }}>
            A shared drive stores files. Pawdex understands them, stands behind
            every fact, and keeps the record whole across a pet&apos;s whole life.
          </p>
        </div>

        <div
          className="mk-diff-grid"
          style={{
            marginTop: 44,
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(2, 1fr)",
          }}
        >
          {CARDS.map((c) => (
            <article
              key={c.title}
              className="mk-card mk-reveal"
              style={{ padding: 26 }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  background: "var(--pw-accent-soft)",
                  color: "var(--pw-accent-fg-on-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <Icon name={c.icon} size={20} />
              </div>
              <h3
                style={{
                  margin: "0 0 8px",
                  font: "600 18px var(--font-inter)",
                  letterSpacing: "-0.015em",
                  color: "var(--pw-text)",
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  font: "400 14px/1.62 var(--font-inter)",
                  color: "var(--pw-text-secondary)",
                }}
              >
                {c.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
