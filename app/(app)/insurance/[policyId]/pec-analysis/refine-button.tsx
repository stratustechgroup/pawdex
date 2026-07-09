"use client";

import { useActionState } from "react";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import type { PolicyPECAnalysis } from "@/lib/db/pec-analysis";

import { refineAction, type RefineState } from "./actions";

const initial: RefineState = { status: "idle" };

export function RefineButton({
  policyId,
  initialAnalysis,
}: {
  policyId: string;
  initialAnalysis: PolicyPECAnalysis;
}) {
  const [state, formAction, pending] = useActionState(refineAction, initial);

  const verdictByEventId = new Map<string, { verdict: string; rationale: string }>();
  if (state.status === "refined") {
    for (const v of state.verdicts) {
      verdictByEventId.set(v.event_id, {
        verdict: v.verdict,
        rationale: v.rationale,
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <form
        action={formAction}
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input type="hidden" name="policy_id" value={policyId} />
        {state.status === "error" && (
          <span
            style={{
              font: "400 11.5px var(--font-inter)",
              color: "#b54a4a",
            }}
          >
            {state.message}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            border: "1px solid var(--pw-accent)",
            background: "var(--pw-accent)",
            color: "var(--pw-accent-fg)",
            font: "500 12.5px var(--font-inter)",
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          <Icon name="sparkles" size={12} />
          {pending
            ? "Reviewing…"
            : state.status === "refined"
              ? "Re-review with AI"
              : "Confirm with AI"}
        </button>
      </form>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {initialAnalysis.flagged.map((event) => {
          const verdict = verdictByEventId.get(event.event_id);
          return (
            <li
              key={event.event_id}
              className="pw-card"
              style={{
                padding: 14,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                borderLeft: `3px solid ${borderColorFor(verdict?.verdict)}`,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: bgColorFor(verdict?.verdict),
                  color: fgColorFor(verdict?.verdict),
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={iconFor(verdict?.verdict)} size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      font: "600 13.5px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    {event.title}
                  </span>
                  <span
                    style={{
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {format(new Date(event.occurred_on), "MMM d, yyyy")}
                  </span>
                  {verdict && <VerdictPill verdict={verdict.verdict} />}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    font: "400 12px var(--font-inter)",
                    color: "var(--pw-text-secondary)",
                  }}
                >
                  Heuristic match: &ldquo;{event.matches[0].exclusion}&rdquo;
                </div>
                {verdict && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "var(--pw-surface-muted)",
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text)",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong
                      style={{
                        font: "600 10.5px var(--font-inter)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      AI ·{" "}
                    </strong>
                    {verdict.rationale}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    match: { label: "Match", bg: "#fce8e8", fg: "#7a2424" },
    ambiguous: { label: "Ambiguous", bg: "#fff6e8", fg: "#6a4a10" },
    false_positive: {
      label: "Likely false positive",
      bg: "var(--pw-accent-soft)",
      fg: "var(--pw-accent-fg-on-soft)",
    },
  };
  const m = map[verdict] ?? { label: verdict, bg: "var(--pw-surface-muted)", fg: "var(--pw-text)" };
  return (
    <span
      style={{
        font: "500 10.5px var(--font-inter)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: m.bg,
        color: m.fg,
        padding: "2px 8px",
        borderRadius: 999,
      }}
    >
      {m.label}
    </span>
  );
}

function borderColorFor(v: string | undefined): string {
  if (v === "match") return "#b54a4a";
  if (v === "ambiguous") return "#c9a227";
  if (v === "false_positive") return "var(--pw-accent)";
  return "var(--pw-border)";
}
function bgColorFor(v: string | undefined): string {
  if (v === "match") return "#fce8e8";
  if (v === "ambiguous") return "#fff6e8";
  if (v === "false_positive") return "var(--pw-accent-soft)";
  return "var(--pw-surface-muted)";
}
function fgColorFor(v: string | undefined): string {
  if (v === "match") return "#7a2424";
  if (v === "ambiguous") return "#6a4a10";
  if (v === "false_positive") return "var(--pw-accent-fg-on-soft)";
  return "var(--pw-text-muted)";
}
function iconFor(v: string | undefined): string {
  if (v === "match") return "alert";
  if (v === "ambiguous") return "info";
  if (v === "false_positive") return "checkCircle";
  return "alert";
}
