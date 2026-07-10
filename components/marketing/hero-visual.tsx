import { Icon } from "@/components/brand/icon";

// The signature hero visual: a scanned vet document resolving into structured,
// source-cited records. Pure CSS animation (keyframes live in marketing.css);
// staggered via inline animation-delay. Decorative, so it is aria-hidden.

type Row = {
  icon: string;
  label: string;
  value: string;
  cite: string;
};

const ROWS: Row[] = [
  { icon: "syringe", label: "Rabies vaccine", value: "Due Apr 2027", cite: "p.2" },
  { icon: "scale", label: "Weight", value: "64.2 lb", cite: "p.1" },
  { icon: "pill", label: "Carprofen", value: "75 mg · 2× daily", cite: "p.3" },
  { icon: "activity", label: "Bloodwork", value: "All in range", cite: "p.4" },
];

export function HeroVisual() {
  return (
    <div className="mk-hero-doc" aria-hidden>
      {/* Back paper — the raw scan, faint and slightly rotated. */}
      <div
        style={{
          position: "absolute",
          inset: "6% 10% 2% 4%",
          background: "var(--pw-surface)",
          border: "1px solid var(--pw-border)",
          borderRadius: 10,
          boxShadow: "var(--pw-shadow-sm)",
          transform: "rotate(-4deg)",
          padding: 18,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 6,
              borderRadius: 3,
              background: "var(--pw-surface-3)",
              margin: "0 0 11px",
              width: `${[92, 80, 88, 62, 84, 74, 90, 58, 70][i]}%`,
            }}
          />
        ))}
        <div className="mk-scan" />
      </div>

      {/* Front panel — the structured, cited result. */}
      <div
        className="mk-card"
        style={{
          position: "absolute",
          inset: "16% -2% 8% 34%",
          padding: 16,
          boxShadow: "var(--pw-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            paddingBottom: 4,
          }}
        >
          <span
            className="pw-pet-photo"
            style={{ width: 30, height: 30, fontSize: 12 }}
          >
            C
          </span>
          <div style={{ lineHeight: 1.2 }}>
            <div
              style={{ font: "600 13px var(--font-inter)", color: "var(--pw-text)" }}
            >
              Cooper
            </div>
            <div
              style={{
                font: "400 10.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              from Banfield_SOAP.pdf
            </div>
          </div>
          <span
            className="mk-cite mk-pill-pop"
            style={{ marginLeft: "auto", animationDelay: "1.1s" }}
          >
            <Icon name="sparkles" size={10} />
            AI reviewed
          </span>
        </div>

        {ROWS.map((r, i) => (
          <div
            key={r.label}
            className="mk-row-in"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 10,
              background: "var(--pw-surface-2)",
              border: "1px solid var(--pw-border)",
              animationDelay: `${0.5 + i * 0.22}s`,
            }}
          >
            <span style={{ color: "var(--pw-accent)", display: "inline-flex" }}>
              <Icon name={r.icon} size={15} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  font: "550 12px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  font: "400 11px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                {r.value}
              </div>
            </div>
            <span
              className="mk-cite mk-pill-pop"
              style={{ animationDelay: `${0.8 + i * 0.22}s` }}
            >
              {r.cite}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
