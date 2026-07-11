import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import type { Insight } from "@/lib/db/insights";

/**
 * Renders the derived, cited insights. Hidden entirely when there is nothing
 * honest to say (the caller passes an empty array). Each card states the
 * observation and, beneath it, the exact records it was computed from, matching
 * the product's citation discipline. Descriptive only, never prescriptive.
 */
export function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section aria-label="Insights" style={{ display: "grid", gap: 10 }}>
      {insights.map((it) => (
        <Link key={it.id} href={it.href} className="pw-insight">
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background:
                it.tone === "watch"
                  ? "var(--pw-status-due-bg)"
                  : "var(--pw-accent-soft)",
              color:
                it.tone === "watch"
                  ? "var(--pw-status-due-fg)"
                  : "var(--pw-accent-fg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name={it.icon} size={15} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "block",
                font: "500 13px var(--font-inter)",
                color: "var(--pw-text)",
                lineHeight: 1.35,
              }}
            >
              {it.headline}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 4,
                font: "400 11.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              <Icon name="link" size={10} style={{ flexShrink: 0 }} />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.citation}
              </span>
            </span>
          </span>
          <Icon
            name="chevronRight"
            size={14}
            style={{ color: "var(--pw-text-subtle)", flexShrink: 0 }}
          />
        </Link>
      ))}
    </section>
  );
}
