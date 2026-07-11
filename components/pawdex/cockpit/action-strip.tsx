import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import type { ActionItem } from "@/lib/db/cockpit";

const SEVERITY_STYLE: Record<
  ActionItem["severity"],
  { bg: string; fg: string; dot: string; label: string }
> = {
  overdue: {
    bg: "var(--pw-status-overdue-bg)",
    fg: "var(--pw-status-overdue-fg)",
    dot: "var(--pw-status-overdue-dot)",
    label: "Overdue",
  },
  due: {
    bg: "var(--pw-status-due-bg)",
    fg: "var(--pw-status-due-fg)",
    dot: "var(--pw-status-due-dot)",
    label: "Due soon",
  },
  attention: {
    bg: "var(--pw-info-bg)",
    fg: "var(--pw-info-fg)",
    dot: "var(--pw-info-fg)",
    label: "Needs a look",
  },
};

export function ActionStrip({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return <AllCaughtUp />;

  const shown = items.slice(0, 5);
  const overflow = items.length - shown.length;

  return (
    <section aria-label="Needs attention" style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: SEVERITY_STYLE[shown[0].severity].dot,
            animation:
              shown[0].severity === "overdue"
                ? "pw-pulse 2.2s ease-in-out infinite"
                : undefined,
          }}
        />
        <h2
          style={{
            font: "600 13px var(--font-inter)",
            color: "var(--pw-text)",
            letterSpacing: "-0.005em",
            margin: 0,
          }}
        >
          Needs attention
        </h2>
        <span
          style={{
            font: "500 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {items.length}
        </span>
      </div>

      <div className="pw-action-strip">
        {shown.map((item) => {
          const s = SEVERITY_STYLE[item.severity];
          return (
            <Link key={item.id} href={item.href} className="pw-action-card">
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: s.dot,
                }}
              />
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: s.bg,
                  color: s.fg,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={item.icon} size={15} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    font: "500 13px var(--font-inter)",
                    color: "var(--pw-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </span>
                <span
                  style={{
                    display: "block",
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    marginTop: 2,
                  }}
                >
                  {item.petName ? `${item.petName} · ` : ""}
                  {s.label}
                </span>
              </span>
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  font: "600 11.5px var(--font-inter)",
                  color: "var(--pw-accent-fg)",
                  flexShrink: 0,
                }}
              >
                {item.cta}
                <Icon name="arrowRight" size={12} />
              </span>
            </Link>
          );
        })}
      </div>

      {overflow > 0 && (
        <Link
          href="/expiring"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 10,
            font: "500 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            textDecoration: "none",
          }}
        >
          {overflow} more {overflow === 1 ? "item" : "items"} in the radar
          <Icon name="arrowRight" size={12} />
        </Link>
      )}
    </section>
  );
}

function AllCaughtUp() {
  return (
    <section aria-label="Needs attention" style={{ marginBottom: 28 }}>
      <div
        className="pw-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 18px",
          background: "var(--pw-accent-soft)",
          borderColor: "var(--pw-accent-soft-2)",
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--pw-surface)",
            color: "var(--pw-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 0 1px var(--pw-accent-soft-2)",
          }}
        >
          <Icon name="checkCircle" size={17} />
        </span>
        <div>
          <div
            style={{
              font: "600 13.5px var(--font-inter)",
              color: "var(--pw-accent-fg)",
            }}
          >
            All caught up
          </div>
          <div
            style={{
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              marginTop: 2,
            }}
          >
            No overdue vaccines, renewals, or documents waiting. We&apos;ll
            surface the next deadline as it approaches.
          </div>
        </div>
      </div>
    </section>
  );
}
