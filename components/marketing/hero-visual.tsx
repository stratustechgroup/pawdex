import { Icon } from "@/components/brand/icon";

// The hero is the product doing its job, staged as a 9-second loop:
// a scanned clinic document is swept, three records slide out carrying their
// source citations, the reviewed state lands, and the payoff notification
// arrives. Pure CSS choreography (keyframes in marketing.css). Decorative,
// so the whole stage is aria-hidden.
export function HeroVisual() {
  return (
    <div className="mk-sim" aria-hidden="true">
      {/* Back layer: the messy input */}
      <div className="mk-sim-doc">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span className="mk-mono-tag" style={{ color: "var(--pw-text-subtle)" }}>
            RIVERBEND VET · VISIT
          </span>
          <span className="mk-mono-tag" style={{ color: "var(--pw-text-subtle)" }}>
            p.2/6
          </span>
        </div>
        <div className="mk-sim-doc-line" style={{ width: "88%" }} />
        <div className="mk-sim-doc-line" style={{ width: "70%" }} />
        <div className="mk-sim-doc-line hl" style={{ width: "94%" }} />
        <div className="mk-sim-doc-line" style={{ width: "56%" }} />
        <div className="mk-sim-doc-line hl" style={{ width: "82%" }} />
        <div className="mk-sim-doc-line" style={{ width: "76%" }} />
        <div className="mk-sim-doc-line" style={{ width: "64%" }} />
        <div className="mk-sim-doc-line hl" style={{ width: "90%" }} />
        <div className="mk-sim-doc-line" style={{ width: "42%" }} />
      </div>

      {/* Front layer: the structured result */}
      <div className="mk-sim-record">
        <div className="mk-sim-record-head">
          <span className="mk-sim-avatar">L</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 14px var(--mk-body)", color: "var(--pw-text)" }}>
              Luna
            </div>
            <div className="mk-small" style={{ fontSize: 12 }}>
              Golden Retriever · 3 yrs
            </div>
          </div>
          <span className="mk-mono-tag" style={{ color: "var(--pw-text-subtle)" }}>
            3 found
          </span>
        </div>

        <div className="mk-sim-chip">
          <span
            className="mk-status-dot"
            style={{ background: "var(--pw-status-up-dot)" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
              Rabies vaccine
            </div>
            <div className="mk-small" style={{ fontSize: 11.5 }}>
              3-year · expires Mar 2029
            </div>
          </div>
          <span className="mk-cite">p.2 ¶4</span>
        </div>

        <div className="mk-sim-chip">
          <span
            className="mk-status-dot"
            style={{ background: "var(--pw-status-due-dot)" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
              Heartworm test
            </div>
            <div className="mk-small" style={{ fontSize: 11.5 }}>
              negative · Apr 12
            </div>
          </div>
          <span className="mk-cite">p.3 ¶1</span>
        </div>

        <div className="mk-sim-chip">
          <span
            className="mk-status-dot"
            style={{ background: "var(--pw-status-up-dot)" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "550 13px var(--mk-body)", color: "var(--pw-text)" }}>
              Weight 29.4 kg
            </div>
            <div className="mk-small" style={{ fontSize: 11.5 }}>
              up 0.3 kg since January
            </div>
          </div>
          <span className="mk-cite">p.2 ¶1</span>
        </div>

        <div className="mk-sim-reviewed">
          <Icon name="checkCircle" size={14} />
          Reviewed by you · added to Luna&apos;s timeline
        </div>
      </div>

      {/* The payoff: Pawdex speaks up before it matters */}
      <div className="mk-sim-toast">
        <span className="mk-sim-toast-icon">
          <Icon name="bell" size={16} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "600 13px var(--mk-body)",
              color: "var(--pw-text)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            Pawdex
            <span
              className="mk-mono-tag"
              style={{ color: "var(--pw-text-subtle)", fontWeight: 500 }}
            >
              now
            </span>
          </div>
          <div
            style={{
              font: "400 12.5px/1.45 var(--mk-body)",
              color: "var(--pw-text-secondary)",
              marginTop: 2,
            }}
          >
            Luna&apos;s Bordetella expires before her boarding stay on Aug 12.
            Book a booster this month.
          </div>
        </div>
      </div>
    </div>
  );
}
