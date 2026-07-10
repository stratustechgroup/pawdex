import { Icon } from "@/components/brand/icon";

// Full-bleed forest band. One idea only: the record starts before the owner.
export function BreederStrip() {
  return (
    <section id="breeders" className="mk-band">
      <div className="mk-container mk-section" style={{ paddingBlock: "clamp(64px, 9vw, 110px)" }}>
        <div className="mk-band-grid">
          <div>
            <span className="mk-eyebrow mk-reveal">For breeders</span>
            <h2 className="mk-h2 mk-reveal" style={{ margin: "18px 0 0", color: "#f3f0e7" }}>
              Send every puppy home with a <em style={{ color: "#8fc7a6" }}>head start</em>.
            </h2>
            <p className="mk-lead mk-reveal" style={{ margin: "18px 0 0", maxWidth: "52ch" }}>
              Run the whole litter in one ledger: weights from birth, first
              vaccines, dewormings, vet checks. At go-home, each family scans a
              link and the puppy&apos;s record becomes theirs, with your kennel
              credited as its origin. No more photocopied packets that end up in
              a junk drawer.
            </p>
            <ul
              className="mk-reveal"
              style={{
                listStyle: "none",
                margin: "26px 0 0",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[
                "Litter ledger with per-puppy records from day one",
                "Placement states: available, reserved, placed",
                "One-tap transfer at pickup, full history included",
              ].map((line) => (
                <li
                  key={line}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    font: "450 14.5px var(--mk-body)",
                    color: "color-mix(in srgb, #efece3 88%, transparent)",
                  }}
                >
                  <Icon name="check" size={14} style={{ color: "#8fc7a6", flexShrink: 0 }} />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="mk-band-card mk-reveal" style={{ padding: 20 }} aria-hidden="true">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingBottom: 14,
                borderBottom: "1px solid color-mix(in srgb, #ffffff 12%, transparent)",
              }}
            >
              <span style={{ font: "600 14.5px var(--mk-body)", color: "#f3f0e7" }}>
                Willow × Ranger · spring litter
              </span>
              <span className="mk-mono-tag" style={{ color: "#9fb3a6" }}>
                6 puppies
              </span>
            </div>
            {[
              { name: "Maple", state: "placed", tone: "#8fc7a6" },
              { name: "Alder", state: "placed", tone: "#8fc7a6" },
              { name: "Juniper", state: "reserved", tone: "#d9b98a" },
              { name: "Birch", state: "available", tone: "#9fb3a6" },
            ].map((p) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 2px",
                  borderBottom: "1px solid color-mix(in srgb, #ffffff 8%, transparent)",
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "color-mix(in srgb, #ffffff 10%, transparent)",
                    display: "grid",
                    placeItems: "center",
                    font: "650 12px var(--mk-body)",
                    color: "#f3f0e7",
                    flexShrink: 0,
                  }}
                >
                  {p.name[0]}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "550 13.5px var(--mk-body)", color: "#f3f0e7" }}>
                    {p.name}
                  </div>
                  <div style={{ font: "400 11.5px var(--mk-body)", color: "#9fb3a6" }}>
                    11 records · weight curve · first shots
                  </div>
                </div>
                <span
                  className="mk-mono-tag"
                  style={{
                    color: p.tone,
                    border: `1px solid color-mix(in srgb, ${p.tone} 45%, transparent)`,
                    borderRadius: 999,
                    padding: "5px 10px",
                  }}
                >
                  {p.state}
                </span>
              </div>
            ))}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                font: "500 12.5px var(--mk-body)",
                color: "#c9d6cd",
              }}
            >
              <Icon name="send" size={13} style={{ color: "#8fc7a6" }} />
              Maple&apos;s record transferred to the Hendersons · 2:14 pm
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
