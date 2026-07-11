import Link from "next/link";
import { format, differenceInCalendarDays, subDays } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { isMedicationActive } from "@/lib/utils";

import { PrintButton } from "../packet/print-button";

export const metadata = { title: "Pre-visit briefing · Pawdex" };
export const dynamic = "force-dynamic";

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  date_of_birth: string | null;
  current_weight_kg: number | null;
  microchip_number: string | null;
};

type EventRow = {
  id: string;
  event_type: string;
  occurred_on: string;
  title: string;
  diagnosis: string | null;
  summary: string | null;
  treatment: string | null;
};

type MedicationRow = {
  id: string;
  name: string;
  generic_name: string | null;
  dose: string;
  route: string | null;
  frequency: string | null;
  duration_days: number | null;
  started_on: string;
  ended_on: string | null;
  medication_context: string;
  indication: string | null;
};

type WeightRow = {
  id: string;
  recorded_on: string;
  weight_kg: number;
};

export default async function PreVisitBriefingPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const [petRes, eventsRes, medsRes, weightsRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, name, species, breed, date_of_birth, current_weight_kg, microchip_number",
      )
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
    supabase
      .from("medical_events")
      .select("id, event_type, occurred_on, title, diagnosis, summary, treatment")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .gte("occurred_on", ninetyDaysAgo)
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("medications")
      .select(
        "id, name, generic_name, dose, route, frequency, duration_days, started_on, ended_on, medication_context, indication",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("started_on", { ascending: false }),
    supabase
      .from("weight_log")
      .select("id, recorded_on, weight_kg")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("recorded_on", { ascending: false })
      .limit(8),
  ]);

  const pet = petRes.data as PetRow | null;
  if (!pet) {
    return (
      <div style={{ padding: 32, color: "var(--pw-text-muted)" }}>
        Pet not found in your household.
      </div>
    );
  }

  const allEvents = (eventsRes.data ?? []) as EventRow[];
  const labs = allEvents.filter((e) => e.event_type === "lab_result");
  const symptoms = allEvents.filter(
    (e) => e.event_type === "illness" || e.event_type === "injury",
  );
  const activeMeds = ((medsRes.data ?? []) as MedicationRow[])
    .filter(
      (m) =>
        m.medication_context === "prescribed_takehome" &&
        isMedicationActive(m.ended_on),
    );
  const otcRecommended = ((medsRes.data ?? []) as MedicationRow[]).filter(
    (m) => m.medication_context === "otc_recommended",
  );

  const weights = (weightsRes.data ?? []) as WeightRow[];
  const latestWeight = weights[0] ?? null;
  const earlierWeight = weights[weights.length - 1] ?? null;
  const weightDelta =
    latestWeight && earlierWeight && latestWeight.id !== earlierWeight.id
      ? latestWeight.weight_kg - earlierWeight.weight_kg
      : null;
  const weightSpanDays =
    latestWeight && earlierWeight
      ? differenceInCalendarDays(
          new Date(latestWeight.recorded_on),
          new Date(earlierWeight.recorded_on),
        )
      : null;

  const ageYears = pet.date_of_birth
    ? Math.floor(
        differenceInCalendarDays(new Date(), new Date(pet.date_of_birth)) / 365.25,
      )
    : null;

  return (
    <>
      <PrintStyles />
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "32px 32px 56px",
          background: "var(--pw-surface)",
        }}
      >
        {/* Toolbar — hidden on print */}
        <div
          className="pw-print-hide"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Link
            href={`/pets/${petId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              textDecoration: "none",
            }}
          >
            <Icon name="arrowLeft" size={12} />
            Back to {pet.name}
          </Link>
          <PrintButton />
        </div>

        {/* Letterhead */}
        <header
          style={{
            paddingBottom: 18,
            borderBottom: "2px solid var(--pw-text)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              font: "500 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Pawdex · Pre-visit briefing
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              marginTop: 6,
            }}
          >
            <div>
              <h1
                className="serif"
                style={{
                  margin: 0,
                  font: "500 28px var(--font-source-serif)",
                  letterSpacing: "-0.02em",
                  color: "var(--pw-text)",
                }}
              >
                {pet.name}
              </h1>
              <div
                style={{
                  font: "400 12.5px var(--font-inter)",
                  color: "var(--pw-text-secondary)",
                }}
              >
                {pet.breed ?? pet.species}
                {ageYears !== null && `, ${ageYears} years old`}
                {latestWeight && ` · ${latestWeight.weight_kg} kg`}
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                font: "400 11px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              <div>{format(new Date(), "EEEE, MMMM d, yyyy")}</div>
              {pet.microchip_number && (
                <div className="mono">Chip {pet.microchip_number}</div>
              )}
            </div>
          </div>
        </header>

        {/* Weight trend */}
        <Section title="Weight trend (last 8 measurements)">
          {weights.length === 0 ? (
            <Muted>No weights logged.</Muted>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                font: "400 12.5px var(--font-inter)",
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {weights
                  .slice()
                  .reverse()
                  .map((w) => (
                    <div
                      key={w.id}
                      style={{
                        font: "400 11.5px var(--font-jetbrains-mono)",
                        color: "var(--pw-text-secondary)",
                      }}
                    >
                      {format(new Date(w.recorded_on), "MMM d")}:{" "}
                      <span className="tnum" style={{ color: "var(--pw-text)" }}>
                        {w.weight_kg}
                      </span>{" "}
                      kg
                    </div>
                  ))}
              </div>
              {weightDelta !== null && weightSpanDays !== null && (
                <div
                  style={{
                    font: "500 12px var(--font-inter)",
                    color:
                      Math.abs(weightDelta) > 0.5
                        ? "#b54a4a"
                        : "var(--pw-text-secondary)",
                  }}
                >
                  Net change over {weightSpanDays} days:{" "}
                  {weightDelta >= 0 ? "+" : ""}
                  {weightDelta.toFixed(1)} kg
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Active medications */}
        <Section title="Currently taking">
          {activeMeds.length === 0 ? (
            <Muted>No active prescriptions.</Muted>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                font: "400 12px var(--font-inter)",
              }}
            >
              <thead>
                <tr>
                  <Th>Drug</Th>
                  <Th>Dose</Th>
                  <Th>Frequency</Th>
                  <Th>Started</Th>
                  <Th>For</Th>
                </tr>
              </thead>
              <tbody>
                {activeMeds.map((m) => (
                  <tr
                    key={m.id}
                    style={{ borderTop: "1px solid var(--pw-border)" }}
                  >
                    <Td style={{ fontWeight: 500 }}>
                      {m.name}
                      {m.generic_name && m.generic_name !== m.name && (
                        <span
                          style={{
                            color: "var(--pw-text-muted)",
                            fontWeight: 400,
                            fontSize: 11,
                            marginLeft: 4,
                          }}
                        >
                          ({m.generic_name})
                        </span>
                      )}
                    </Td>
                    <Td className="mono">
                      {m.dose}
                      {m.route ? ` ${m.route}` : ""}
                    </Td>
                    <Td>{m.frequency ?? "—"}</Td>
                    <Td className="tnum">
                      {format(new Date(m.started_on), "MMM d")}
                    </Td>
                    <Td>{m.indication ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* OTC + supplements */}
        {otcRecommended.length > 0 && (
          <Section title="OTC supplements">
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-secondary)",
              }}
            >
              {otcRecommended.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.dose && ` — ${m.dose}`}
                  {m.frequency && ` ${m.frequency}`}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Recent symptoms / illness */}
        <Section title="Recent illness or injury (last 90 days)">
          {symptoms.length === 0 ? (
            <Muted>Nothing logged.</Muted>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {symptoms.map((e) => (
                <li
                  key={e.id}
                  style={{
                    paddingLeft: 12,
                    borderLeft: "3px solid var(--pw-accent-soft)",
                    font: "400 12.5px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {format(new Date(e.occurred_on), "MMM d")} · {e.title}
                  </div>
                  {e.diagnosis && (
                    <div
                      style={{
                        font: "400 11.5px var(--font-inter)",
                        color: "var(--pw-text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      Diagnosis: {e.diagnosis}
                    </div>
                  )}
                  {e.summary && (
                    <div
                      style={{
                        font: "400 11.5px var(--font-inter)",
                        color: "var(--pw-text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {e.summary}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Recent labs */}
        <Section title="Recent labs (last 90 days)">
          {labs.length === 0 ? (
            <Muted>No labs logged.</Muted>
          ) : (
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
              {labs.map((e) => (
                <li
                  key={e.id}
                  style={{
                    font: "400 12.5px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    {format(new Date(e.occurred_on), "MMM d")}:
                  </span>{" "}
                  {e.title}
                  {e.summary && (
                    <span style={{ color: "var(--pw-text-secondary)" }}>
                      {" "}— {e.summary}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Questions for the vet — write-in lines */}
        <Section title="Questions for the vet (write below)">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              paddingTop: 4,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderBottom: "1px solid var(--pw-text-muted)",
                  minHeight: 22,
                }}
              />
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer
          style={{
            marginTop: 28,
            paddingTop: 14,
            borderTop: "1px solid var(--pw-border)",
            font: "400 10.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Generated by Pawdex on{" "}
          {format(new Date(), "MMM d, yyyy 'at' h:mm a")} for {pet.name}.
          This is a summary of records the owner holds in Pawdex — verify
          against the clinic&apos;s authoritative record.
        </footer>
      </div>
    </>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        .pw-print-hide { display: none !important; }
        body { background: white !important; }
      }
    `}</style>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2
        style={{
          margin: "0 0 10px",
          font: "600 11px var(--font-inter)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pw-text-muted)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: "400 12.5px var(--font-inter)",
        color: "var(--pw-text-muted)",
      }}
    >
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 6px",
        font: "600 10.5px var(--font-inter)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--pw-text-muted)",
        borderBottom: "1px solid var(--pw-text)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td
      className={className}
      style={{ padding: "8px 6px", verticalAlign: "top", ...style }}
    >
      {children}
    </td>
  );
}
