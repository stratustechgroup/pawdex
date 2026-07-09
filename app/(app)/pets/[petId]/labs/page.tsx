import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { LabValue } from "@/lib/supabase/types";

import { addLabValue, deleteLabValue } from "./actions";
import { LabTrendChart } from "./lab-trend-chart";

export const metadata = { title: "Labs — Pawdex" };
export const dynamic = "force-dynamic";

type AnalyteGroup = {
  analyte: string;
  units: string | null;
  reference_low: number | null;
  reference_high: number | null;
  values: LabValue[];
};

function groupByAnalyte(values: LabValue[]): AnalyteGroup[] {
  const map = new Map<string, AnalyteGroup>();
  for (const v of values) {
    const key = v.analyte.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.values.push(v);
      if (!existing.units && v.units) existing.units = v.units;
      if (existing.reference_low === null && v.reference_low !== null) {
        existing.reference_low = v.reference_low;
      }
      if (existing.reference_high === null && v.reference_high !== null) {
        existing.reference_high = v.reference_high;
      }
    } else {
      map.set(key, {
        analyte: v.analyte,
        units: v.units,
        reference_low: v.reference_low,
        reference_high: v.reference_high,
        values: [v],
      });
    }
  }
  for (const group of map.values()) {
    group.values.sort((a, b) =>
      a.collected_on < b.collected_on ? -1 : a.collected_on > b.collected_on ? 1 : 0,
    );
  }
  return Array.from(map.values()).sort((a, b) =>
    a.analyte.toLowerCase() < b.analyte.toLowerCase() ? -1 : 1,
  );
}

export default async function LabsPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [petRes, labRes] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name")
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
    supabase
      .from("lab_values")
      .select("*")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("collected_on", { ascending: false }),
  ]);

  if (!petRes.data) notFound();
  const groups = groupByAnalyte((labRes.data ?? []) as LabValue[]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead
        title="Lab trends"
        sub="Plot individual analytes over time. Pawdex highlights out-of-range values and shows the reference band when available. Discuss any trend with your vet — Pawdex never interprets clinically."
      />

      <section
        className="pw-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Add a lab value
        </h2>
        <form
          action={addLabValue}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          <input type="hidden" name="pet_id" value={petId} />
          <Field label="Analyte" full>
            <input
              type="text"
              name="analyte"
              required
              placeholder="e.g. Creatinine, ALT, BUN, T4, SDMA"
              style={inputStyle}
            />
          </Field>
          <Field label="Collected on">
            <input type="date" name="collected_on" required style={inputStyle} />
          </Field>
          <Field label="Value">
            <input
              type="number"
              step="any"
              name="value"
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Units">
            <input
              type="text"
              name="units"
              placeholder="mg/dL"
              style={inputStyle}
            />
          </Field>
          <Field label="Ref low">
            <input
              type="number"
              step="any"
              name="reference_low"
              style={inputStyle}
            />
          </Field>
          <Field label="Ref high">
            <input
              type="number"
              step="any"
              name="reference_high"
              style={inputStyle}
            />
          </Field>
          <Field label="Lab (optional)">
            <input
              type="text"
              name="lab"
              placeholder="IDEXX / Antech / in-house"
              style={inputStyle}
            />
          </Field>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid var(--pw-accent)",
                background: "var(--pw-accent)",
                color: "var(--pw-accent-fg)",
                font: "500 12px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              <Icon name="plus" size={11} />
              Add value
            </button>
          </div>
        </form>
      </section>

      {groups.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 32,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          No lab values logged yet. Once you add a few measurements for the
          same analyte (e.g. Creatinine at 3+ visits), Pawdex plots the trend.
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.analyte} className="pw-card" style={{ padding: 18 }}>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    font: "600 14px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  {g.analyte}
                  {g.units && (
                    <span
                      style={{
                        marginLeft: 6,
                        font: "400 12px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      ({g.units})
                    </span>
                  )}
                </h3>
                {g.reference_low !== null && g.reference_high !== null && (
                  <div
                    style={{
                      marginTop: 2,
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    Reference range {g.reference_low}–{g.reference_high}
                    {g.units && ` ${g.units}`}
                  </div>
                )}
              </div>
              <span
                style={{
                  font: "500 11px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {g.values.length} reading{g.values.length === 1 ? "" : "s"}
              </span>
            </header>
            <LabTrendChart
              data={g.values.map((v) => ({
                date: v.collected_on,
                value: Number(v.value),
                flag: v.flag,
              }))}
              referenceLow={g.reference_low}
              referenceHigh={g.reference_high}
              units={g.units}
            />
            <details style={{ marginTop: 10 }}>
              <summary
                style={{
                  cursor: "pointer",
                  font: "500 11px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Readings ({g.values.length})
              </summary>
              <ul
                style={{
                  listStyle: "none",
                  margin: "8px 0 0",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  font: "400 12px var(--font-inter)",
                }}
              >
                {g.values
                  .slice()
                  .reverse()
                  .map((v) => (
                    <li
                      key={v.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--pw-text-secondary)",
                          minWidth: 90,
                        }}
                      >
                        {format(new Date(v.collected_on), "MMM d, yyyy")}
                      </span>
                      <span
                        className="tnum"
                        style={{
                          fontWeight: 600,
                          color:
                            v.flag === "H" || v.flag === "L"
                              ? "#b54a4a"
                              : "var(--pw-text)",
                        }}
                      >
                        {v.value}
                        {v.units ? ` ${v.units}` : ""}
                      </span>
                      {v.flag && v.flag !== "normal" && (
                        <span
                          style={{
                            font: "500 10px var(--font-jetbrains-mono)",
                            color: "#b54a4a",
                          }}
                        >
                          [{v.flag}]
                        </span>
                      )}
                      {v.lab && (
                        <span
                          style={{
                            color: "var(--pw-text-muted)",
                          }}
                        >
                          · {v.lab}
                        </span>
                      )}
                      <form
                        action={deleteLabValue}
                        style={{ marginLeft: "auto" }}
                      >
                        <input type="hidden" name="lab_id" value={v.id} />
                        <input type="hidden" name="pet_id" value={petId} />
                        <button
                          type="submit"
                          title="Delete"
                          style={{
                            background: "transparent",
                            border: 0,
                            cursor: "pointer",
                            color: "var(--pw-text-muted)",
                          }}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            </details>
          </section>
        ))
      )}

      <div
        style={{
          padding: 12,
          background: "var(--pw-info-bg)",
          color: "var(--pw-info-fg)",
          borderRadius: 8,
          font: "400 11.5px var(--font-inter)",
          lineHeight: 1.55,
        }}
      >
        Pawdex tracks values you enter — we don&apos;t interpret lab results.
        Out-of-range flags are mechanical (value vs reference range), not
        clinical. Always discuss trends with your veterinarian.
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <span
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};
