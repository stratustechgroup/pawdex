import { Icon } from "@/components/brand/icon";

// The Flighty pattern, translated: not three abstract steps but the three
// eras of owning an animal, each shown as the product actually behaves.
// CSS-only tabs (radio inputs + sibling selectors in marketing.css).

function DayOneVignette() {
  return (
    <div className="mk-vignette" aria-hidden="true">
      <div className="mk-card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 14,
            borderBottom: "1px solid var(--pw-border)",
          }}
        >
          <span className="mk-sim-avatar" style={{ width: 40, height: 40 }}>
            M
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ font: "600 15px var(--mk-body)", color: "var(--pw-text)" }}>
              Maple joined your household
            </div>
            <div className="mk-small" style={{ fontSize: 12 }}>
              transferred from Hickory Ridge Goldens
            </div>
          </div>
          <span className="mk-cite" style={{ background: "var(--pw-status-up-bg)", color: "var(--pw-status-up-fg)" }}>
            with history
          </span>
        </div>
        {[
          { icon: "syringe", label: "DHPP first dose", meta: "6 weeks · from the litter record" },
          { icon: "pill", label: "Deworming · pyrantel", meta: "2, 4 and 6 weeks" },
          { icon: "scale", label: "Weight curve since birth", meta: "8 entries · 0.4 kg to 3.1 kg" },
          { icon: "calendar", label: "Next: rabies at 16 weeks", meta: "reminder already set" },
        ].map((r) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 2px",
              borderBottom: "1px solid var(--pw-border)",
            }}
          >
            <Icon name={r.icon} size={15} style={{ color: "var(--pw-accent)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
                {r.label}
              </div>
              <div className="mk-small" style={{ fontSize: 11.5 }}>
                {r.meta}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EveryVisitVignette() {
  return (
    <div className="mk-vignette" aria-hidden="true">
      <div className="mk-card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingBottom: 12,
            borderBottom: "1px solid var(--pw-border)",
          }}
        >
          <Icon name="mail" size={15} style={{ color: "var(--pw-accent)" }} />
          <span style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
            Fwd: Baxter visit summary
          </span>
          <span className="mk-mono-tag" style={{ marginLeft: "auto", color: "var(--pw-text-subtle)" }}>
            2 min ago
          </span>
        </div>

        <div style={{ padding: "12px 2px", borderBottom: "1px solid var(--pw-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mk-status-dot" style={{ background: "var(--pw-status-up-dot)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
                Lepto booster
              </div>
              <div className="mk-small" style={{ fontSize: 11.5 }}>
                annual · due again Jun 2027
              </div>
            </div>
            <span className="mk-cite">p.1 ¶3</span>
            <span
              style={{
                font: "600 11px var(--mk-body)",
                color: "var(--pw-status-up-fg)",
                background: "var(--pw-status-up-bg)",
                borderRadius: 999,
                padding: "5px 10px",
              }}
            >
              add
            </span>
          </div>
        </div>

        <div style={{ padding: "12px 2px", borderBottom: "1px solid var(--pw-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mk-status-dot" style={{ background: "var(--pw-status-incomplete-dot)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
                Rabies · 3-year
              </div>
              <div className="mk-small" style={{ fontSize: 11.5 }}>
                you already have this one, from Riverbend in March
              </div>
            </div>
            <span className="mk-cite">p.1 ¶4</span>
            <span
              style={{
                font: "600 11px var(--mk-body)",
                color: "var(--pw-status-incomplete-fg)",
                background: "var(--pw-status-incomplete-bg)",
                borderRadius: 999,
                padding: "5px 10px",
              }}
            >
              skip
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span className="mk-small" style={{ fontSize: 12 }}>
            Nothing saves until you approve it.
          </span>
          <span
            className="mk-btn"
            style={{ height: 34, padding: "0 16px", fontSize: 12.5 }}
          >
            Approve 1 record
          </span>
        </div>
      </div>
    </div>
  );
}

function YearsLaterVignette() {
  return (
    <div className="mk-vignette" aria-hidden="true">
      <div className="mk-card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 2px 14px",
            borderBottom: "1px solid var(--pw-border)",
          }}
        >
          <Icon name="search" size={14} style={{ color: "var(--pw-text-muted)" }} />
          <span style={{ font: "400 13px var(--mk-body)", color: "var(--pw-text-secondary)" }}>
            When was Baxter&apos;s last lepto shot?
          </span>
        </div>
        <div style={{ padding: "14px 2px 4px" }}>
          <div style={{ font: "400 13.5px/1.6 var(--mk-body)", color: "var(--pw-text)" }}>
            June 3, 2026, at Lakeside Animal Hospital. It is an annual vaccine,
            so the next one is due June 2027. A reminder is set for May 6.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <span className="mk-cite">visit summary · p.1</span>
            <span className="mk-cite">3 clinics · 2 cities</span>
            <span className="mk-cite">6 years of history</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  {
    id: "mk-tab-1",
    index: "01",
    label: "Day one",
    heading: "Start with a history, not a blank page.",
    body: "Adopt from a breeder on Pawdex and the record arrives with the dog: birth weight, first shots, dewormings, parentage. Starting from scratch instead? Tell us the birthday and we project the whole first year of vaccines and checkups before your first vet visit.",
    vignette: <DayOneVignette />,
  },
  {
    id: "mk-tab-2",
    index: "02",
    label: "Every visit after",
    heading: "Forward the email. That's the whole workflow.",
    body: "Every pet gets its own forwarding address. Send anything to it, or snap the paper on the counter, and Pawdex reads it in about a minute. You see exactly what it found, each fact pinned to the page it came from, duplicates already flagged. One tap to approve.",
    vignette: <EveryVisitVignette />,
  },
  {
    id: "mk-tab-3",
    index: "03",
    label: "Years later",
    heading: "Six years, three clinics, one answer.",
    body: "The 2 a.m. emergency vet asks what she's allergic to and when her last rabies shot was. You are not digging through a shoebox. Ask in plain English and get the answer with its receipts, or hand over a boarding packet and emergency card that are always current.",
    vignette: <YearsLaterVignette />,
  },
];

export function Lifecycle() {
  return (
    <section id="how-it-works" className="mk-section">
      <div className="mk-container">
        <span className="mk-eyebrow mk-reveal">How it works</span>
        <h2 className="mk-h2 mk-reveal" style={{ margin: "18px 0 0", maxWidth: "22ch" }}>
          Built for the whole life, not just the next visit.
        </h2>

        <div className="mk-tabs" style={{ marginTop: "clamp(28px, 4vw, 44px)", position: "relative" }}>
          {TABS.map((t, i) => (
            <input
              key={t.id}
              type="radio"
              name="mk-lifecycle"
              id={t.id}
              defaultChecked={i === 0}
            />
          ))}
          <div className="mk-tab-labels" role="tablist">
            {TABS.map((t) => (
              <label key={t.id} className="mk-tab-label" htmlFor={t.id}>
                <span className="mk-tab-index">{t.index}</span>
                {t.label}
              </label>
            ))}
          </div>
          <div className="mk-tab-panels">
            {TABS.map((t) => (
              <div key={t.id} className="mk-tab-panel">
                <div>
                  <h3 className="mk-h3" style={{ margin: 0, color: "var(--pw-text)" }}>
                    {t.heading}
                  </h3>
                  <p className="mk-lead" style={{ margin: "14px 0 0", fontSize: 16.5 }}>
                    {t.body}
                  </p>
                </div>
                {t.vignette}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
