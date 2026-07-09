import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { MedicationContext } from "@/lib/supabase/types";

import { MedicationDialog } from "./medication-dialog";
import { TodayPanel } from "./today-panel";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  dose: string;
  frequency: string | null;
  started_on: string;
  ended_on: string | null;
  duration_days: number | null;
  medication_context: MedicationContext;
  prescriber: string | null;
};

const CONTEXT_LABEL: Record<MedicationContext, string> = {
  prescribed_takehome: "Take-home Rx",
  intraoperative: "Intraoperative",
  injection_in_office: "In-office injection",
  otc_recommended: "OTC",
  unknown: "Unknown",
};

export default async function MedicationsPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data }, { data: todaysAdmins }] = await Promise.all([
    supabase
      .from("medications")
      .select(
        "id, name, dose, frequency, started_on, ended_on, duration_days, medication_context, prescriber",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("started_on", { ascending: false }),
    supabase
      .from("medication_administrations")
      .select("id, medication_id, administered_at")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .eq("administered_on", today)
      .order("administered_at", { ascending: false }),
  ]);

  const all = (data ?? []) as Row[];

  // Active = take-home Rx the owner is still administering. Everything else
  // (intraop drugs, completed courses, in-office injections) is history.
  const active = all.filter(
    (r) =>
      r.medication_context === "prescribed_takehome" &&
      (r.ended_on === null || r.ended_on > today),
  );
  const history = all.filter(
    (r) =>
      !(
        r.medication_context === "prescribed_takehome" &&
        (r.ended_on === null || r.ended_on > today)
      ),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, font: "600 16px var(--font-inter)", color: "var(--pw-text)" }}>
            Medications
          </h2>
          <p style={{ margin: "4px 0 0", font: "400 12.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
            {active.length} active · {history.length} historical
          </p>
        </div>
        <MedicationDialog petId={petId} />
      </div>

      <TodayPanel
        petId={petId}
        activeMeds={active.map((m) => ({
          id: m.id,
          name: m.name,
          dose: m.dose,
          frequency: m.frequency,
        }))}
        todaysAdministrations={(todaysAdmins ?? []) as {
          id: string;
          medication_id: string;
          administered_at: string | null;
        }[]}
      />

      <section>
        <h3
          style={{
            margin: "0 0 8px",
            font: "600 13px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Active
        </h3>
        {active.length === 0 ? (
          <div
            className="pw-card"
            style={{
              padding: 20,
              textAlign: "center",
              borderStyle: "dashed",
              background: "transparent",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            No active medications. Take-home prescriptions still in their dose
            window will show here.
          </div>
        ) : (
          <MedTable petId={petId} rows={active} variant="active" />
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h3
            style={{
              margin: "0 0 8px",
              font: "600 13px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            History
          </h3>
          <p
            style={{
              margin: "0 0 10px",
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            Completed courses, intraoperative meds (given during surgery, not
            ongoing), in-office injections, and OTC recommendations.
          </p>
          <MedTable petId={petId} rows={history} variant="history" />
        </section>
      )}
    </div>
  );
}

function MedTable({
  petId,
  rows,
  variant,
}: {
  petId: string;
  rows: Row[];
  variant: "active" | "history";
}) {
  return (
    <div className="pw-card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", font: "400 13px var(--font-inter)" }}>
        <thead>
          <tr style={{ background: "var(--pw-surface-2)" }}>
            <Th>Medication</Th>
            <Th>Dose</Th>
            <Th className="hidden sm:table-cell">Frequency</Th>
            <Th>Started</Th>
            <Th>{variant === "active" ? "Ends" : "Ended / type"}</Th>
            <Th className="hidden md:table-cell">Prescriber</Th>
            {variant === "active" && <Th>Prices</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--pw-border)" }}>
              <Td>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ color: "var(--pw-text)", fontWeight: 500 }}>
                    {r.name}
                  </span>
                  {variant === "history" && (
                    <span
                      style={{
                        font: "500 10.5px var(--font-jetbrains)",
                        color: "var(--pw-text-muted)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {CONTEXT_LABEL[r.medication_context]}
                    </span>
                  )}
                </div>
              </Td>
              <Td>{r.dose}</Td>
              <Td className="hidden sm:table-cell">
                <span style={{ color: "var(--pw-text-muted)" }}>
                  {r.frequency ?? "—"}
                </span>
              </Td>
              <Td>
                <span className="tnum" style={{ color: "var(--pw-text-secondary)" }}>
                  {format(new Date(r.started_on), "MMM d, yyyy")}
                </span>
              </Td>
              <Td>
                {r.ended_on ? (
                  <span className="tnum" style={{ color: "var(--pw-text-secondary)" }}>
                    {format(new Date(r.ended_on), "MMM d, yyyy")}
                  </span>
                ) : variant === "active" ? (
                  <span style={{ color: "var(--pw-text-muted)" }}>Ongoing</span>
                ) : (
                  <span style={{ color: "var(--pw-text-subtle)" }}>—</span>
                )}
              </Td>
              <Td className="hidden md:table-cell">
                <span style={{ color: "var(--pw-text-muted)" }}>
                  {r.prescriber ?? "—"}
                </span>
              </Td>
              {variant === "active" && (
                <Td>
                  <Link
                    href={`/pets/${petId}/medications/${r.id}/prices`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      font: "500 11.5px var(--font-inter)",
                      color: "var(--pw-accent)",
                      textDecoration: "none",
                    }}
                  >
                    <Icon name="receipt" size={11} />
                    Compare
                  </Link>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
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

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
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
