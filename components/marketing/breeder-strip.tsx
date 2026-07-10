import { Icon } from "@/components/brand/icon";

const ITEMS = [
  { icon: "inbox", label: "Litter ledger", note: "Every puppy in one view" },
  { icon: "syringe", label: "Day-one records", note: "Dewormings, shots, vet checks" },
  { icon: "arrowRight", label: "Transfer at go-home", note: "History follows each pup" },
];

export function BreederStrip() {
  return (
    <section className="mk-section" style={{ paddingBlock: "clamp(40px, 6vw, 72px)" }}>
      <div className="mk-container">
        <div
          className="mk-card mk-reveal mk-breeder"
          style={{
            padding: "clamp(28px, 4vw, 44px)",
            background:
              "linear-gradient(135deg, var(--pw-accent) 0%, var(--pw-accent-pressed) 100%)",
            border: "none",
            display: "grid",
            gap: 28,
            gridTemplateColumns: "1fr",
            alignItems: "center",
            color: "#fff",
          }}
        >
          <div>
            <span
              style={{
                font: "600 11.5px var(--font-inter)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.82)",
              }}
            >
              For breeders
            </span>
            <h2
              className="mk-serif"
              style={{
                margin: "14px 0 10px",
                fontSize: "clamp(1.7rem, 3vw, 2.3rem)",
                color: "#fff",
              }}
            >
              Send every puppy home with its records already started.
            </h2>
            <p
              style={{
                margin: 0,
                maxWidth: "52ch",
                font: "400 15px/1.6 var(--font-inter)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Track a whole litter from day one, then hand each puppy&apos;s full
              health history to its new family at go-home. Buyers remember the
              breeder who made that effortless.
            </p>
          </div>

          <div
            className="mk-breeder-items"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(3, 1fr)",
            }}
          >
            {ITEMS.map((it) => (
              <div
                key={it.label}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 14,
                  padding: "16px 16px 18px",
                }}
              >
                <Icon name={it.icon} size={19} style={{ color: "#fff" }} />
                <div
                  style={{
                    marginTop: 12,
                    font: "600 14px var(--font-inter)",
                    color: "#fff",
                  }}
                >
                  {it.label}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    font: "400 12.5px var(--font-inter)",
                    color: "rgba(255,255,255,0.82)",
                  }}
                >
                  {it.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
