import { format } from "date-fns";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import {
  MEDICAL_EVENT_TYPE_LABEL,
  type MedicalEventType,
} from "@/lib/schemas/medical-event";

import { MedicalEventDialog } from "./medical-event-dialog";
import { RequestRecordsButton } from "./request-records-button";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  event_type: MedicalEventType;
  occurred_on: string;
  title: string;
  diagnosis: string | null;
  vet_clinic_id: string | null;
  vet_clinics: { name: string; email: string | null } | null;
};

export default async function MedicalPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data }, { data: costData }] = await Promise.all([
    supabase
      .from("medical_events")
      .select(
        "id, event_type, occurred_on, title, diagnosis, vet_clinic_id, vet_clinics(name, email)",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("invoice_items")
      .select("amount_cents, incurred_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
  ]);

  const rows = (data ?? []) as unknown as Row[];

  // Costs: an all-time total, a year-to-date total, and a per-day rollup so we
  // can show "· $X this visit" next to the event on that date. Modest by design
  // — the full spending dashboard is future work.
  const costs = (costData ?? []) as { amount_cents: number; incurred_on: string | null }[];
  const currentYear = new Date().getFullYear();
  let costTotalCents = 0;
  let costYtdCents = 0;
  const costByDate = new Map<string, number>();
  for (const c of costs) {
    costTotalCents += c.amount_cents;
    if (c.incurred_on) {
      if (Number(c.incurred_on.slice(0, 4)) === currentYear)
        costYtdCents += c.amount_cents;
      costByDate.set(
        c.incurred_on,
        (costByDate.get(c.incurred_on) ?? 0) + c.amount_cents,
      );
    }
  }
  const hasCosts = costs.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
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
            Medical history
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {rows.length === 0
              ? "Nothing logged yet."
              : `${rows.length} ${rows.length === 1 ? "event" : "events"} on file — visits, illnesses, surgeries, lab results.`}
          </p>
        </div>
        <MedicalEventDialog petId={petId} />
      </div>

      {hasCosts && (
        <div
          className="pw-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "12px 16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                font: "500 10.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Spent in {currentYear}
            </div>
            <div
              className="tnum"
              style={{ font: "600 18px var(--font-inter)", color: "var(--pw-text)" }}
            >
              {formatUsd(costYtdCents)}
            </div>
          </div>
          <div>
            <div
              style={{
                font: "500 10.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              All time
            </div>
            <div
              className="tnum"
              style={{ font: "600 18px var(--font-inter)", color: "var(--pw-text-secondary)" }}
            >
              {formatUsd(costTotalCents)}
            </div>
          </div>
          <span
            style={{
              font: "400 11.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              maxWidth: 320,
            }}
          >
            Captured from invoices you&apos;ve uploaded. Per-visit costs show
            beside the event on that date.
          </span>
        </div>
      )}

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
          }}
        >
          Add your first event manually, or upload a SOAP note to auto-create
          one.
        </div>
      ) : (
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
                <Th>Type</Th>
                <Th>Title</Th>
                <Th className="hidden sm:table-cell">Diagnosis</Th>
                <Th className="hidden md:table-cell">Clinic</Th>
                <Th>Records</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid var(--pw-border)" }}
                >
                  <Td>
                    <span
                      className="tnum"
                      style={{ color: "var(--pw-text-secondary)" }}
                    >
                      {format(new Date(r.occurred_on), "MMM d, yyyy")}
                    </span>
                  </Td>
                  <Td>
                    <span
                      style={{
                        font: "500 10.5px var(--font-jetbrains)",
                        color: "var(--pw-text-muted)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {MEDICAL_EVENT_TYPE_LABEL[r.event_type] ?? r.event_type}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: "var(--pw-text)", fontWeight: 500 }}>
                      {r.title}
                    </span>
                    {costByDate.has(r.occurred_on) && (
                      <span
                        className="tnum"
                        style={{
                          marginLeft: 8,
                          font: "500 11.5px var(--font-inter)",
                          color: "var(--pw-text-muted)",
                        }}
                        title="Total invoiced on this date"
                      >
                        · {formatUsd(costByDate.get(r.occurred_on)!)}
                      </span>
                    )}
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <span style={{ color: "var(--pw-text-muted)" }}>
                      {r.diagnosis ?? "—"}
                    </span>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <span style={{ color: "var(--pw-text-muted)" }}>
                      {r.vet_clinics?.name ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    {r.vet_clinic_id ? (
                      <RequestRecordsButton
                        petId={petId}
                        medicalEventId={r.id}
                        clinicHasEmail={!!r.vet_clinics?.email}
                      />
                    ) : (
                      <span
                        style={{
                          font: "400 11px var(--font-inter)",
                          color: "var(--pw-text-subtle)",
                        }}
                      >
                        No clinic
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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
