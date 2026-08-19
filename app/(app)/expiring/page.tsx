import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import {
  listExpiringForHousehold,
  type ExpiringItem,
  type ExpiringStatus,
} from "@/lib/db/expiring";

export const metadata = { title: "Expiring soon · Pawdex" };
export const dynamic = "force-dynamic";

export default async function ExpiringPage() {
  const session = await requireSession();
  const items = await listExpiringForHousehold(session.householdId);

  const overdue = items.filter((i) => i.status === "overdue");
  const dueSoon = items.filter((i) => i.status === "due_soon");
  const warning = items.filter((i) => i.status === "warning");
  const ok = items.filter((i) => i.status === "ok");

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <SectionHead
        title="Expiration radar"
        sub={
          items.length === 0
            ? "Nothing on file with an expiration date yet. Add a vaccine or insurance policy and it'll show up here."
            : `${overdue.length} overdue · ${dueSoon.length} within 14 days · ${warning.length} within 60 days · ${ok.length} further out.`
        }
      />

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {overdue.length > 0 && (
            <Group title="Overdue" status="overdue" items={overdue} />
          )}
          {dueSoon.length > 0 && (
            <Group title="Due soon (≤ 14 days)" status="due_soon" items={dueSoon} />
          )}
          {warning.length > 0 && (
            <Group title="Coming up (≤ 60 days)" status="warning" items={warning} />
          )}
          {ok.length > 0 && (
            <Group title="Further out" status="ok" items={ok} />
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  status,
  items,
}: {
  title: string;
  status: ExpiringStatus;
  items: ExpiringItem[];
}) {
  return (
    <section>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            /* Square marker: one shape system. */
            background: dotColor(status),
          }}
        />
        <h2
          style={{
            margin: 0,
            font: "600 11.5px var(--font-inter)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--pw-text-muted)",
          }}
        >
          {title} · {items.length}
        </h2>
      </header>
      <ul
        className="pw-card"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {items.map((item, i) => (
          <li
            key={`${item.kind}:${item.entity_id}`}
            style={{
              padding: "14px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
              display: "flex",
              gap: 12,
              alignItems: "center",
              // The 3px status bar down the left edge of every row is gone.
              // Each row already states its status twice in words, in the
              // group heading above it and in its own "17d overdue" column,
              // and the bar was a third encoding carrying no label. On this
              // page in particular it also striped four different colours
              // down a single scroll, which is the effect the ban on coloured
              // left stripes exists to prevent.
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--pw-surface-muted)",
                color: "var(--pw-text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title={item.kind === "vaccine" ? "Vaccine" : "Insurance renewal"}
            >
              <Icon
                name={item.kind === "vaccine" ? "syringe" : "shieldCheck"}
                size={14}
              />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    font: "600 13.5px var(--font-inter)",
                    color: "var(--pw-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </span>
                {item.is_rabies && (
                  <span
                    style={{
                      font: "500 9.5px var(--pw-mono)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: "var(--pw-accent-soft)",
                      color: "var(--pw-accent-fg-on-soft)",
                      padding: "1px 6px",
                      borderRadius: 4,
                    }}
                  >
                    Legal
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 2,
                  font: "400 12px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                {item.pet_name ?? "Whole household"}
                {item.detail ? ` · ${item.detail}` : ""}
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                flexShrink: 0,
              }}
            >
              <span
                className="tnum"
                style={{
                  font: "600 13px var(--font-inter)",
                  color: dotColor(item.status),
                }}
              >
                {formatDays(item.days_until)}
              </span>
              <span
                className="tnum"
                style={{
                  font: "400 11px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                {format(new Date(item.expires_on), "MMM d, yyyy")}
              </span>
            </div>
            {linkFor(item) && (
              <Link
                href={linkFor(item)!}
                title="Open"
                style={{
                  color: "var(--pw-text-muted)",
                  paddingLeft: 4,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Icon name="chevronRight" size={14} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDays(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days}d`;
  if (days < 60) return `in ${Math.round(days / 7)} wk`;
  return `in ${Math.round(days / 30)} mo`;
}

function dotColor(status: ExpiringStatus): string {
  switch (status) {
    case "overdue":
      return "var(--pw-status-overdue-fg)";
    case "due_soon":
      return "var(--pw-status-due-fg)";
    case "warning":
      return "var(--pw-status-due-fg)";
    case "ok":
      return "var(--pw-accent)";
  }
}

function linkFor(item: ExpiringItem): string | null {
  if (item.kind === "vaccine" && item.pet_id) {
    return `/pets/${item.pet_id}/vaccines`;
  }
  if (item.kind === "policy_renewal") return "/insurance";
  return null;
}
