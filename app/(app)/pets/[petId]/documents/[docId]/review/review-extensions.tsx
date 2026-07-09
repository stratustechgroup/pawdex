"use client";

import { useState } from "react";

import { Icon } from "@/components/brand/icon";
import type {
  ExtractedBoilerplateBlock,
  ExtractedLabValue,
  ExtractedPetAttributes,
  ExtractedUpcomingReminder,
} from "@/lib/ai/extraction-schema";

// Drafts exposed back to the parent review form via `onChange` so they
// can ride along on the commitExtraction() call.
export type LabValueDraft = {
  skip: boolean;
  analyte: string;
  value: number | null;
  units: string | null;
  reference_low: number | null;
  reference_high: number | null;
  flag: string | null;
  collected_on: string;
  lab: string | null;
};

export type UpcomingReminderDraft = {
  skip: boolean;
  title: string;
  due_on: string;
  entity_type: "vaccine" | "exam" | "lab" | "preventative" | "other";
};

export type PetAttributesAccept = Partial<{
  breed: string | null;
  sex: "male" | "female" | "unknown";
  altered: boolean | null;
  date_of_birth: string | null;
  microchip_number: string | null;
  microchip_registry: string | null;
  microchip_implanted_on: string | null;
  color: string | null;
}>;

export type PetAttributeDiff = {
  field: keyof PetAttributesAccept;
  current: unknown;
  extracted: unknown;
};

export type ReviewExtensionsState = {
  labValues: LabValueDraft[];
  upcomingReminders: UpcomingReminderDraft[];
  petAttributeAccepts: PetAttributesAccept;
};

const FIELD_LABEL: Record<keyof PetAttributesAccept, string> = {
  breed: "Breed",
  sex: "Sex",
  altered: "Spayed / Neutered",
  date_of_birth: "Date of birth",
  microchip_number: "Microchip number",
  microchip_registry: "Microchip registry",
  microchip_implanted_on: "Microchip implanted on",
  color: "Color",
};

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function ReviewExtensions({
  labValues,
  labDupes,
  upcomingReminders,
  petAttributes,
  excludedBoilerplate,
  petAttributeDiffs,
  onChange,
}: {
  labValues: ExtractedLabValue[];
  /** Dedup matches keyed by lab-row index — an "exact" match means the same
   *  analyte + collection date + value is already stored; those rows are
   *  default-skipped (still visible + toggleable). "loose" matches (same
   *  analyte/date, different value — possibly a corrected result) only get
   *  the indicator, never a pre-skip. */
  labDupes?: Record<
    number,
    { match_strength: "exact" | "strong" | "loose" }[]
  >;
  upcomingReminders: ExtractedUpcomingReminder[];
  petAttributes: ExtractedPetAttributes;
  excludedBoilerplate: ExtractedBoilerplateBlock[];
  petAttributeDiffs: PetAttributeDiff[];
  onChange: (state: ReviewExtensionsState) => void;
}) {
  const [labs, setLabs] = useState<LabValueDraft[]>(() =>
    labValues.map((l, i) => ({
      skip:
        l.confidence < 0.5 ||
        l.value === null ||
        (labDupes?.[i]?.some(
          (m) => m.match_strength === "exact" || m.match_strength === "strong",
        ) ??
          false),
      analyte: l.analyte,
      value: l.value,
      units: l.units,
      reference_low: l.reference_low,
      reference_high: l.reference_high,
      flag: l.flag,
      collected_on: l.collected_on,
      lab: l.lab,
    })),
  );
  const [reminders, setReminders] = useState<UpcomingReminderDraft[]>(() =>
    upcomingReminders.map((r) => ({
      skip: r.confidence < 0.5,
      title: r.title,
      due_on: r.due_on,
      entity_type: r.entity_type,
    })),
  );
  const [accepts, setAccepts] = useState<PetAttributesAccept>({});

  function emit(next: Partial<ReviewExtensionsState>) {
    onChange({
      labValues: next.labValues ?? labs,
      upcomingReminders: next.upcomingReminders ?? reminders,
      petAttributeAccepts: next.petAttributeAccepts ?? accepts,
    });
  }

  function toggleLab(i: number, skip: boolean) {
    const next = labs.map((l, j) => (i === j ? { ...l, skip } : l));
    setLabs(next);
    emit({ labValues: next });
  }
  function toggleReminder(i: number, skip: boolean) {
    const next = reminders.map((r, j) => (i === j ? { ...r, skip } : r));
    setReminders(next);
    emit({ upcomingReminders: next });
  }
  function setAccept(field: keyof PetAttributesAccept, value: unknown | null) {
    const next = { ...accepts };
    if (value === null) {
      delete next[field];
    } else {
      // Type-narrow: the accepts type matches per-field union literals.
      (next as Record<string, unknown>)[field] = value;
    }
    setAccepts(next);
    emit({ petAttributeAccepts: next });
  }

  const hasAny =
    labs.length > 0 ||
    reminders.length > 0 ||
    petAttributeDiffs.length > 0 ||
    excludedBoilerplate.length > 0;

  if (!hasAny) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
      {/* ── Pet attribute reconciliation banner ────────────────── */}
      {petAttributeDiffs.length > 0 && (
        <section
          className="pw-card"
          style={{
            padding: 16,
            borderLeft: "3px solid var(--pw-accent)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="info" size={14} style={{ color: "var(--pw-accent)" }} />
            <h3
              style={{
                margin: 0,
                font: "600 13.5px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              This document says these details differently
            </h3>
          </header>
          <p
            style={{
              margin: 0,
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Compare what this document claims against your current pet record.
            Accept or skip each.
          </p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {petAttributeDiffs.map((d) => {
              const accepted = d.field in accepts;
              return (
                <li
                  key={d.field}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--pw-surface-muted)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, font: "400 12px var(--font-inter)" }}>
                    <div
                      style={{
                        font: "600 11.5px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {FIELD_LABEL[d.field]}
                    </div>
                    <div style={{ marginTop: 2, color: "var(--pw-text-muted)" }}>
                      Current:{" "}
                      <span style={{ color: "var(--pw-text)" }}>{displayValue(d.current)}</span>
                      <span style={{ margin: "0 6px" }}>·</span>
                      Document:{" "}
                      <span style={{ color: "var(--pw-text)", fontWeight: 600 }}>
                        {displayValue(d.extracted)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {accepted ? (
                      <button
                        type="button"
                        onClick={() => setAccept(d.field, null)}
                        style={pillButton(true)}
                      >
                        <Icon name="check" size={11} />
                        Will update
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setAccept(d.field, d.extracted)}
                          style={pillButton(false)}
                        >
                          Accept
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Upcoming reminders panel ─────────────────────────────── */}
      {reminders.length > 0 && (
        <section
          className="pw-card"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="bell" size={13} style={{ color: "var(--pw-text-muted)" }} />
            <h3
              style={{
                margin: 0,
                font: "600 13.5px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Upcoming reminders found in this document
            </h3>
            <span
              style={{
                marginLeft: "auto",
                font: "400 11.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              {reminders.filter((r) => !r.skip).length} of {reminders.length} selected
            </span>
          </header>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {reminders.map((r, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: r.skip
                    ? "var(--pw-surface-muted)"
                    : "var(--pw-accent-soft)",
                  color: r.skip
                    ? "var(--pw-text-muted)"
                    : "var(--pw-accent-fg-on-soft)",
                  opacity: r.skip ? 0.7 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={!r.skip}
                  onChange={(e) => toggleReminder(i, !e.target.checked)}
                  style={{ accentColor: "var(--pw-accent)" }}
                />
                <div style={{ flex: 1, minWidth: 0, font: "400 12px var(--font-inter)" }}>
                  <div style={{ font: "500 12.5px var(--font-inter)" }}>{r.title}</div>
                  <div style={{ marginTop: 2, opacity: 0.8 }}>
                    Due {r.due_on} · {r.entity_type}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Lab values panel ────────────────────────────────────── */}
      {labs.length > 0 && (
        <section
          className="pw-card"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="activity" size={13} style={{ color: "var(--pw-text-muted)" }} />
            <h3
              style={{
                margin: 0,
                font: "600 13.5px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Lab values
            </h3>
            <span
              style={{
                marginLeft: "auto",
                font: "400 11.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              {labs.filter((l) => !l.skip).length} of {labs.length} selected — feeds the lab-trends view
            </span>
          </header>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                font: "400 11.5px var(--font-inter)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--pw-surface-muted)" }}>
                  <th style={th}></th>
                  <th style={th}>Analyte</th>
                  <th style={th}>Value</th>
                  <th style={th}>Range</th>
                  <th style={th}>Flag</th>
                  <th style={th}>Collected</th>
                  <th style={th}>Lab</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((l, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: "1px solid var(--pw-border)",
                      opacity: l.skip ? 0.5 : 1,
                    }}
                  >
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={!l.skip}
                        onChange={(e) => toggleLab(i, !e.target.checked)}
                        style={{ accentColor: "var(--pw-accent)" }}
                      />
                    </td>
                    <td style={{ ...td, fontWeight: 500, color: "var(--pw-text)" }}>
                      {l.analyte}
                      {labDupes?.[i]?.length ? (
                        <span
                          title={
                            labDupes[i].some(
                              (m) => m.match_strength === "exact",
                            )
                              ? "This analyte + date + value is already in your records — skipped by default."
                              : "Same analyte + date already on file with a different value — could be a corrected result. Review before including."
                          }
                          style={{
                            marginLeft: 6,
                            padding: "1px 6px",
                            borderRadius: 999,
                            background: "var(--pw-status-due-bg)",
                            color: "var(--pw-status-due-fg)",
                            font: "600 9.5px var(--font-inter)",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          on file
                        </span>
                      ) : null}
                    </td>
                    <td style={{ ...td, color: "var(--pw-text)" }} className="tnum">
                      {l.value !== null ? `${l.value}${l.units ? ` ${l.units}` : ""}` : "—"}
                    </td>
                    <td style={{ ...td, color: "var(--pw-text-muted)" }} className="tnum">
                      {l.reference_low !== null && l.reference_high !== null
                        ? `${l.reference_low}–${l.reference_high}`
                        : "—"}
                    </td>
                    <td
                      style={{
                        ...td,
                        color:
                          l.flag === "H" || l.flag === "L" ? "#b54a4a" : "var(--pw-text-muted)",
                        fontWeight: l.flag === "H" || l.flag === "L" ? 600 : 400,
                      }}
                    >
                      {l.flag ?? "—"}
                    </td>
                    <td style={{ ...td, color: "var(--pw-text-secondary)" }} className="tnum">
                      {l.collected_on}
                    </td>
                    <td style={{ ...td, color: "var(--pw-text-muted)" }}>{l.lab ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Excluded boilerplate disclosure ─────────────────────── */}
      {excludedBoilerplate.length > 0 && (
        <details
          className="pw-card"
          style={{ padding: "10px 14px" }}
        >
          <summary
            style={{
              cursor: "pointer",
              font: "500 11.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {excludedBoilerplate.length} education boilerplate block
            {excludedBoilerplate.length === 1 ? "" : "s"} filtered
          </summary>
          <ul
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            {excludedBoilerplate.map((b, i) => (
              <li key={i}>
                <strong>{b.topic}</strong>
                <span style={{ color: "var(--pw-text-muted)" }}> — {b.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Reference: extracted pet_attributes shown for transparency even when there are no diffs */}
      {petAttributes && petAttributeDiffs.length === 0 && (
        <div
          className="pw-card"
          style={{
            padding: 12,
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="check" size={12} style={{ color: "var(--pw-accent)" }} />
          Pet details in this document match your current record. No reconciliation needed.
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  font: "600 10.5px var(--font-inter)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--pw-text-muted)",
};
const td: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "middle",
};

function pillButton(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 26,
    padding: "0 10px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--pw-accent)" : "var(--pw-border-strong)"}`,
    background: active ? "var(--pw-accent)" : "var(--pw-surface)",
    color: active ? "var(--pw-accent-fg)" : "var(--pw-text)",
    font: "500 11px var(--font-inter)",
    cursor: "pointer",
  };
}
