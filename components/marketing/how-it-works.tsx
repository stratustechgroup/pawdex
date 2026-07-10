import { Icon } from "@/components/brand/icon";

const STEPS = [
  {
    n: "01",
    icon: "mail",
    title: "Forward or snap any vet document",
    body: "Email a PDF to your private Pawdex address, or photograph a paper record. Vaccine certs, SOAP notes, lab panels, invoices, discharge papers. Any clinic, any format.",
  },
  {
    n: "02",
    icon: "sparkles",
    title: "AI reads it, you approve it",
    body: "Pawdex extracts the vaccines, weights, medications and diagnoses, then shows you every fact linked back to the exact line it came from. Nothing enters your pet's record until you say yes.",
  },
  {
    n: "03",
    icon: "clock",
    title: "A lifelong timeline, kept current",
    body: "Approved facts become a clean, searchable history. Reminders, travel packets and a full record that moves with your pet come free on top.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mk-section">
      <div className="mk-container">
        <div className="mk-reveal" style={{ maxWidth: 640 }}>
          <span className="mk-eyebrow">How it works</span>
          <h2
            className="mk-serif mk-h2"
            style={{ margin: "20px 0 0", color: "var(--pw-text)" }}
          >
            Three steps. Then it just keeps itself up to date.
          </h2>
        </div>

        <div
          style={{
            marginTop: 48,
            display: "grid",
            gap: 40,
            gridTemplateColumns: "1fr",
            alignItems: "center",
          }}
          className="mk-hiw-grid"
        >
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="mk-reveal"
                style={{
                  display: "flex",
                  gap: 18,
                  padding: "22px 4px",
                  borderTop: "1px solid var(--pw-border)",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "var(--pw-accent-soft)",
                    color: "var(--pw-accent-fg-on-soft)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={s.icon} size={19} />
                </div>
                <div>
                  <div
                    className="mono"
                    style={{
                      font: "500 11px var(--font-jetbrains)",
                      letterSpacing: "0.12em",
                      color: "var(--pw-text-subtle)",
                    }}
                  >
                    {s.n}
                  </div>
                  <h3
                    style={{
                      margin: "6px 0 6px",
                      font: "600 17px var(--font-inter)",
                      letterSpacing: "-0.01em",
                      color: "var(--pw-text)",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      maxWidth: "52ch",
                      font: "400 14px/1.6 var(--font-inter)",
                      color: "var(--pw-text-secondary)",
                    }}
                  >
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <ReviewMock />
        </div>
      </div>
    </section>
  );
}

// Stylized "human review" screen — the thing no inbox or folder gives you:
// every extracted fact carries the source it came from, one tap from proof.
function ReviewMock() {
  return (
    <div
      className="mk-card mk-reveal"
      style={{
        padding: 18,
        boxShadow: "var(--pw-shadow-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 14,
          borderBottom: "1px solid var(--pw-border)",
        }}
      >
        <Icon name="fileCheck" size={16} style={{ color: "var(--pw-accent)" }} />
        <span
          style={{ font: "600 13px var(--font-inter)", color: "var(--pw-text)" }}
        >
          Review before it is saved
        </span>
        <span className="pw-badge pending" style={{ marginLeft: "auto" }}>
          <span className="pw-dot" />
          4 to confirm
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <ReviewRow
          fact="Rabies vaccine"
          detail="Administered 04/12/2026 · 3-year"
          cite="Banfield SOAP · page 2"
        />
        <ReviewRow
          fact="Weight"
          detail="64.2 lb, up from 61.0 lb"
          cite="Banfield SOAP · page 1"
        />
        <ReviewRow
          fact="Carprofen 75 mg"
          detail="Twice daily with food"
          cite="Discharge notes · page 3"
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 16,
        }}
      >
        <span
          className="mk-btn mk-btn-primary"
          style={{ height: 38, flex: 1, fontSize: 13 }}
        >
          <Icon name="check" size={14} />
          Approve all
        </span>
        <span
          className="mk-btn mk-btn-ghost"
          style={{ height: 38, fontSize: 13 }}
        >
          Edit
        </span>
      </div>
    </div>
  );
}

function ReviewRow({
  fact,
  detail,
  cite,
}: {
  fact: string;
  detail: string;
  cite: string;
}) {
  return (
    <div
      style={{
        padding: "11px 12px",
        borderRadius: 12,
        border: "1px solid var(--pw-border)",
        background: "var(--pw-surface-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{ font: "600 13.5px var(--font-inter)", color: "var(--pw-text)" }}
        >
          {fact}
        </span>
        <span
          style={{
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {detail}
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        <span className="mk-cite">
          <Icon name="link" size={10} />
          {cite}
        </span>
      </div>
    </div>
  );
}
