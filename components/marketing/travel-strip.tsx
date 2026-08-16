import { Icon } from "@/components/brand/icon";

// Travel is the sharpest wedge into the product: a hard deadline, real
// consequences, and paperwork nobody understands. Every claim here maps to a
// shipped surface — EU readiness (pets/[petId]/eu-travel), the APHIS 7001
// worksheet (packet/aphis-7001), the compliance packet and its share link
// (packet/), and the emergency card. Nothing aspirational, same discipline as
// the legal pages: if the code doesn't do it, it isn't on this page.
//
// Deliberately hedged where the product is hedged. Pawdex prepares and tracks
// paperwork; it does not file anything, and it cannot promise a border officer
// says yes. Overclaiming here would be the kind of thing that gets a consumer
// product in trouble, and it would be a lie besides.
export function TravelStrip() {
  return (
    <section id="travel" className="mk-section">
      <div className="mk-container">
        <span className="mk-eyebrow mk-reveal">Travel &amp; boarding</span>
        <h2 className="mk-h2 mk-reveal" style={{ margin: "18px 0 0", maxWidth: "20ch" }}>
          The paperwork, <em>sorted before</em> you go.
        </h2>
        <p className="mk-lead mk-reveal" style={{ margin: "18px 0 0", maxWidth: "56ch" }}>
          Crossing a border with a pet means rabies timing, microchip format,
          titer windows and a federal form, each with its own rules. Pawdex
          already holds the records those rules are checked against, so it can
          tell you what is done, what is missing, and what you cannot fix in
          time.
        </p>

        <div
          className="mk-reveal"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
            gap: 18,
            marginTop: 34,
          }}
        >
          {[
            {
              icon: "checkCircle",
              title: "Destination readiness",
              body:
                "Pick where you're going and see what's outstanding. Pawdex reads your pet's own vaccination dates and tells you what's still required, what's already satisfied, and when a requirement can no longer be met before your date.",
            },
            {
              icon: "fileText",
              title: "APHIS 7001 worksheet",
              body:
                "The USDA health-certificate worksheet, pre-filled from your records: owner and origin, animal description, microchip number and registry, vaccination history. You take a complete draft to your vet instead of a blank form and a shoebox.",
            },
            {
              icon: "link",
              title: "One link for the boarder",
              body:
                "Send a kennel, sitter or airline a single link to the records they need. It expires on a date you choose, you can revoke it at any time, and you can see when it was last opened.",
            },
            {
              icon: "shield",
              title: "Emergency card",
              body:
                "A wallet-sized card with microchip number, allergies and current medications, for the vet you didn't plan on visiting. Print it or keep it on your phone.",
            },
          ].map((c) => (
            <article
              key={c.title}
              style={{
                padding: 20,
                borderRadius: 12,
                border: "1px solid var(--mk-border, rgba(0,0,0,0.1))",
                background: "var(--mk-surface, transparent)",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: "var(--mk-accent-soft, rgba(47,122,90,0.12))",
                  color: "var(--mk-accent-fg, #2f7a5a)",
                }}
              >
                <Icon name={c.icon} size={16} />
              </span>
              <h3
                style={{
                  margin: "14px 0 0",
                  font: "600 16px var(--mk-display, var(--mk-body))",
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  margin: "8px 0 0",
                  font: "400 14px/1.6 var(--mk-body)",
                  color: "var(--mk-text-muted, inherit)",
                }}
              >
                {c.body}
              </p>
            </article>
          ))}
        </div>

        <p
          className="mk-reveal"
          style={{
            margin: "26px 0 0",
            maxWidth: "62ch",
            font: "400 13px/1.6 var(--mk-body)",
            color: "var(--mk-text-muted, inherit)",
          }}
        >
          Pawdex prepares and tracks the paperwork. It doesn&apos;t file anything
          on your behalf, and requirements change: always confirm against the
          destination&apos;s official guidance and your vet before you travel.
        </p>
      </div>
    </section>
  );
}
