import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Icon } from "@/components/brand/icon";
import type { ActivityItem } from "@/lib/db/activity";

const ICON_TINT: Record<ActivityItem["kind"], string> = {
  document_added: "var(--pw-text-muted)",
  document_reviewed: "var(--pw-status-up-dot)",
  member_joined: "var(--pw-info-fg)",
  pet_transferred: "var(--pw-accent)",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="pw-card"
        style={{
          padding: "20px 16px",
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        Documents you upload or forward, and changes across the household, will
        appear here as a running timeline.
      </div>
    );
  }

  return (
    <div className="pw-card" style={{ padding: "6px 0" }}>
      <ol className="pw-timeline" role="list">
        {items.map((item, i) => {
          const inner = (
            <>
              <span className="pw-timeline-rail" aria-hidden>
                <span
                  className="pw-timeline-node"
                  style={{ color: ICON_TINT[item.kind] }}
                >
                  <Icon name={item.icon} size={13} />
                </span>
                {i < items.length - 1 && <span className="pw-timeline-line" />}
              </span>
              <span style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
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
                    font: "400 12px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {[
                    item.petName,
                    item.detail && item.detail !== item.petName
                      ? item.detail
                      : null,
                    item.actorName ? `by ${item.actorName}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span
                style={{
                  font: "400 11.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {formatDistanceToNow(new Date(item.at), { addSuffix: false })}
              </span>
            </>
          );
          return (
            <li key={item.id} role="listitem">
              {item.href ? (
                <Link href={item.href} className="pw-timeline-row">
                  {inner}
                </Link>
              ) : (
                <div className="pw-timeline-row">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
