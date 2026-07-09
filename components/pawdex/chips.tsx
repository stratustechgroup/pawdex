import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";

export function SponsoredChip({
  partner,
  tip,
  className,
}: {
  partner?: string;
  tip?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("pw-badge sponsored", className)}
      title={tip ?? "Pawdex is paid by this partner. See affiliate disclosure."}
    >
      <span className="pw-dot" />
      {partner ? `Sponsored · ${partner}` : "Sponsored"}
      <Icon name="info" size={10} style={{ opacity: 0.7 }} />
    </span>
  );
}

export function PartnerChip({ className }: { className?: string }) {
  return (
    <span
      className={cn("pw-badge", className)}
      style={{
        background: "var(--pw-sponsor-bg)",
        color: "var(--pw-sponsor-fg)",
        border: "1px solid var(--pw-sponsor-border)",
        height: 20,
        fontSize: 10.5,
        padding: "0 7px",
      }}
    >
      Partner network
    </span>
  );
}

export function PendingChip({
  days,
  label,
  className,
}: {
  days?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("pw-badge pending", className)}>
      <span
        className="pw-dot"
        style={{ animation: "pw-pulse 3s ease-in-out infinite" }}
      />
      {label ?? `Pending vet response · ${days ?? 0}d`}
    </span>
  );
}

export function TierChip({
  tier = "plus",
  className,
}: {
  tier?: "plus" | "core";
  className?: string;
}) {
  const isPlus = tier === "plus";
  return (
    <span
      className={cn("pw-badge tier", className)}
      style={{
        color: isPlus ? "var(--pw-accent-fg-on-soft)" : "var(--pw-text-muted)",
        borderColor: isPlus
          ? "var(--pw-accent-soft-2)"
          : "var(--pw-border-strong)",
        background: isPlus ? "var(--pw-accent-soft)" : "transparent",
      }}
    >
      <Icon name="sparkles" size={10} style={{ opacity: 0.7 }} />
      {isPlus ? "Answered with Claude" : "Pawdex Core"}
    </span>
  );
}

export function SentOnBehalfLockup({
  who = "you",
  size = "md",
}: {
  who?: string;
  size?: "sm" | "md";
}) {
  if (size === "sm") {
    return (
      <span
        className="pw-lockup-soyb"
        style={{ padding: "4px 9px 4px 6px", fontSize: 11 }}
      >
        <span className="pw-mark-circle" style={{ width: 16, height: 16 }}>
          <PawdexMark size={10} color="#FAF9F6" />
        </span>
        Sent by Pawdex for {who}
      </span>
    );
  }
  return (
    <span className="pw-lockup-soyb">
      <span className="pw-mark-circle">
        <PawdexMark size={11} color="#FAF9F6" />
      </span>
      <span>
        <span style={{ color: "var(--pw-text-muted)" }}>Sent by</span>{" "}
        <span style={{ color: "var(--pw-text)", fontWeight: 600 }}>Pawdex</span>{" "}
        <span style={{ color: "var(--pw-text-muted)" }}>on behalf of</span>{" "}
        <span style={{ color: "var(--pw-text)", fontWeight: 600 }}>{who}</span>
      </span>
    </span>
  );
}

export function InsurerLogo({
  name,
  size = 32,
  tone = "#2B5266",
}: {
  name: string;
  size?: number;
  tone?: string;
}) {
  const letter = ((name || "?").trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: tone,
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        font: `600 ${Math.round(size * 0.45)}px var(--font-inter)`,
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

export function ClaimTimeline({
  stage = "submitted",
  outcome,
}: {
  stage?: "drafted" | "submitted" | "responded" | "resolved";
  outcome?: "Paid" | "Partial" | "Denied" | "Appealed";
}) {
  const stages = [
    { id: "drafted", label: "Drafted" },
    { id: "submitted", label: "Submitted" },
    { id: "responded", label: "Insurer responded" },
    { id: "resolved", label: outcome ?? "Resolved" },
  ] as const;
  const stageIdx = stages.findIndex((s) => s.id === stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {stages.map((s, i) => {
        const done = i < stageIdx;
        const active = i === stageIdx;
        const isResolvedOutcome =
          i === 3 &&
          (outcome === "Paid" ||
            outcome === "Partial" ||
            outcome === "Denied" ||
            outcome === "Appealed");
        const tone =
          isResolvedOutcome && outcome === "Paid"
            ? "success"
            : isResolvedOutcome && outcome === "Denied"
              ? "danger"
              : "default";
        return (
          <div
            key={s.id}
            style={{ display: "contents" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: done
                    ? "var(--pw-accent)"
                    : active
                      ? tone === "danger"
                        ? "var(--pw-status-overdue-dot)"
                        : "var(--pw-text)"
                      : "var(--pw-surface)",
                  border: done || active ? "none" : "1.5px solid var(--pw-border-strong)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "600 10px var(--font-inter)",
                  flexShrink: 0,
                }}
              >
                {done && <Icon name="check" size={11} />}
                {active && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#fff",
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  font: "500 11.5px var(--font-inter)",
                  color: done || active ? "var(--pw-text)" : "var(--pw-text-subtle)",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span
                style={{
                  flex: 1,
                  minWidth: 16,
                  height: 2,
                  margin: "0 8px",
                  background:
                    i < stageIdx ? "var(--pw-accent)" : "var(--pw-border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <div>
        <div
          style={{
            font: "600 14px var(--font-inter)",
            color: "var(--pw-text)",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              marginTop: 3,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
