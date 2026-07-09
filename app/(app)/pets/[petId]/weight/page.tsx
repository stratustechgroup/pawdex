import { format } from "date-fns";

import { WeightTrendChart } from "@/components/pawdex/weight-trend-chart";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { kgToLbs } from "@/lib/utils";

import { LogWeightDialog } from "./log-weight-dialog";

export const dynamic = "force-dynamic";

type WeightSource = Database["public"]["Enums"]["weight_source"];

type Row = {
  id: string;
  recorded_on: string;
  weight_kg: number;
  source: WeightSource;
  notes: string | null;
};

const SOURCE_LABEL: Record<WeightSource, string> = {
  manual: "Manual",
  extracted: "Extracted",
  vet_visit: "Vet visit",
};

function sourceChipColor(source: WeightSource): {
  bg: string;
  fg: string;
  border: string;
} {
  if (source === "extracted") {
    return {
      bg: "var(--pw-accent-soft)",
      fg: "var(--pw-accent-fg-on-soft)",
      border: "var(--pw-accent-soft-2)",
    };
  }
  if (source === "vet_visit") {
    return {
      bg: "var(--pw-surface-2)",
      fg: "var(--pw-text-secondary)",
      border: "var(--pw-border-strong)",
    };
  }
  return {
    bg: "var(--pw-surface-2)",
    fg: "var(--pw-text-muted)",
    border: "var(--pw-border)",
  };
}

export default async function WeightPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("weight_log")
    .select("id, recorded_on, weight_kg, source, notes")
    .eq("household_id", session.householdId)
    .eq("pet_id", petId)
    .order("recorded_on", { ascending: false });

  const rows = ((data ?? []) as Row[]).map((r) => ({
    ...r,
    weight_kg: Number(r.weight_kg),
  }));

  // Newest is index 0, oldest is the last element.
  const newest = rows[0];
  const oldest = rows[rows.length - 1];
  const currentLbs = newest ? kgToLbs(newest.weight_kg) : null;
  const delta =
    newest && oldest && rows.length >= 2
      ? Math.round((kgToLbs(newest.weight_kg) - kgToLbs(oldest.weight_kg)) * 10) /
        10
      : null;

  const subParts: string[] = [];
  subParts.push(`${rows.length} ${rows.length === 1 ? "entry" : "entries"}`);
  if (currentLbs !== null) subParts.push(`current ${currentLbs} lbs`);
  if (delta !== null) {
    const sign = delta > 0 ? "+" : delta < 0 ? "" : "±";
    subParts.push(`${sign}${delta} lbs since first`);
  }

  const chartData = [...rows].map((r) => ({
    recorded_on: r.recorded_on,
    weight_kg: r.weight_kg,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              font: "600 16px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            Weight
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {rows.length === 0
              ? "No weight entries on record yet."
              : subParts.join(" · ")}
          </p>
        </div>
        <LogWeightDialog petId={petId} />
      </div>

      {rows.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 40,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            No weight entries yet. Log a weigh-in to start tracking the trend
            line — vet visit docs you upload will fill this in automatically too.
          </div>
          <LogWeightDialog petId={petId} triggerLabel="Log first weight" />
        </div>
      ) : (
        <>
          {rows.length >= 2 && <WeightTrendChart data={chartData} />}

          <div className="pw-card" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                font: "400 13px var(--font-inter)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--pw-surface-2)" }}>
                  <Th>Date</Th>
                  <Th>Weight</Th>
                  <Th>Source</Th>
                  <Th className="hidden md:table-cell">Notes</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lbs = kgToLbs(r.weight_kg);
                  const chip = sourceChipColor(r.source);
                  return (
                    <tr
                      key={r.id}
                      style={{ borderTop: "1px solid var(--pw-border)" }}
                    >
                      <Td>
                        <span
                          className="tnum"
                          style={{ color: "var(--pw-text-secondary)" }}
                        >
                          {format(new Date(r.recorded_on), "MMM d, yyyy")}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className="tnum"
                          style={{
                            color: "var(--pw-text)",
                            fontWeight: 500,
                          }}
                        >
                          {lbs} lbs
                        </span>
                        <span
                          className="tnum"
                          style={{
                            marginLeft: 6,
                            color: "var(--pw-text-muted)",
                            font: "400 11.5px var(--font-jetbrains)",
                          }}
                        >
                          ({r.weight_kg} kg)
                        </span>
                      </Td>
                      <Td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: chip.bg,
                            color: chip.fg,
                            border: `1px solid ${chip.border}`,
                            font: "500 11px var(--font-inter)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {SOURCE_LABEL[r.source]}
                        </span>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <span style={{ color: "var(--pw-text-muted)" }}>
                          {r.notes ?? "—"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={className}
      style={{
        textAlign: "left",
        padding: "10px 16px",
        font: "500 11.5px var(--font-inter)",
        color: "var(--pw-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: "1px solid var(--pw-border)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={className}
      style={{
        padding: "12px 16px",
        verticalAlign: "middle",
        font: "400 13px var(--font-inter)",
        color: "var(--pw-text)",
      }}
    >
      {children}
    </td>
  );
}
