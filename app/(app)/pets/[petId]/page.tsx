import Link from "next/link";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVaccinations } from "@/lib/db/vaccinations";

export const dynamic = "force-dynamic";

type IconName = Parameters<typeof Icon>[0]["name"];

const EVENT_TYPE_LABEL: Record<string, string> = {
  exam: "Wellness",
  wellness: "Wellness",
  illness: "Illness",
  injury: "Injury",
  surgery: "Surgery",
  dental: "Dental",
  lab_result: "Lab",
  imaging: "Imaging",
  parasite_prevention: "Parasite",
  behavioral: "Behavioral",
  vaccination: "Vaccine",
  other: "Visit",
};

export default async function PetOverviewPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fan out every Overview query in parallel. Each is small (≤8 rows) and
  // keyed by household_id + pet_id so RLS handles cross-household isolation.
  const [
    eventsRes,
    medsRes,
    activeMedsRes,
    labRes,
    remindersRes,
    docCountRes,
    currentVacs,
  ] = await Promise.all([
    supabase
      .from("medical_events")
      .select(
        "id, event_type, title, occurred_on, summary, diagnosis, vet_clinic_id, document_id",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("occurred_on", { ascending: false })
      .limit(6),
    supabase
      .from("medications")
      .select("id, name, ended_on, medication_context")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("started_on", { ascending: false }),
    supabase
      .from("medications")
      .select("id, name, generic_name, dose, frequency, ended_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .eq("medication_context", "prescribed_takehome")
      .or(`ended_on.is.null,ended_on.gt.${today}`)
      .order("started_on", { ascending: false })
      .limit(3),
    supabase
      .from("lab_values")
      .select(
        "id, analyte, value, units, reference_low, reference_high, flag, collected_on",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("collected_on", { ascending: false })
      .limit(60),
    supabase
      .from("reminders")
      .select("id, entity_type, entity_id, due_on, scheduled_for, status")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .eq("status", "scheduled")
      .order("scheduled_for", { ascending: true })
      .limit(4),
    supabase
      .from("documents")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    getCurrentVaccinations(session.householdId, petId),
  ]);

  const events = eventsRes.data ?? [];

  // Vaccine summary card: how many vaccines are "current" (not overdue)
  // vs how many we have on file, plus the soonest expiry.
  const vacStat = (() => {
    if (currentVacs.length === 0) {
      return {
        kind: "empty" as const,
        current: 0,
        total: 0,
        nextLabel: null as string | null,
        nextDate: null as string | null,
        anyOverdue: false,
      };
    }
    let current = 0;
    let overdue = 0;
    let next: { vac: (typeof currentVacs)[number]; days: number } | null = null;
    for (const v of currentVacs) {
      if (!v.expires_on) continue;
      const d = differenceInCalendarDays(parseISO(v.expires_on), new Date());
      if (d < 0) overdue++;
      else current++;
      if (d >= 0 && (!next || d < next.days))
        next = { vac: v, days: d };
    }
    return {
      kind: "ok" as const,
      current,
      total: currentVacs.length,
      nextLabel: next ? next.vac.vaccine_type : null,
      nextDate: next?.vac.expires_on ?? null,
      anyOverdue: overdue > 0,
    };
  })();

  // Medications summary card: count active prescriptions + list the first
  // two names so the card has real content even when the menu is short.
  const allMeds = medsRes.data ?? [];
  const activeMeds = activeMedsRes.data ?? [];
  const medsStat = {
    activeCount: activeMeds.length,
    totalEver: allMeds.length,
    sample: activeMeds
      .slice(0, 3)
      .map((m) => m.name)
      .join(", "),
  };

  // Labs summary card: aggregate flags across the latest readings, picking
  // out anything still flagged abnormal. Same dataset feeds the right rail.
  const labs = (labRes.data ?? []) as Array<{
    id: string;
    analyte: string;
    value: number;
    units: string | null;
    reference_low: number | null;
    reference_high: number | null;
    flag: string | null;
    collected_on: string;
  }>;

  // Most-recent reading per analyte for the "Key labs" sidebar.
  const latestByAnalyte = new Map<string, (typeof labs)[number][]>();
  for (const l of labs) {
    const arr = latestByAnalyte.get(l.analyte) ?? [];
    arr.push(l);
    latestByAnalyte.set(l.analyte, arr);
  }
  const keyLabs = Array.from(latestByAnalyte.entries())
    .slice(0, 4)
    .map(([analyte, readings]) => ({
      analyte,
      latest: readings[0],
      // Sparkline points — chronological oldest → newest.
      series: [...readings].reverse().map((r) => r.value),
    }));

  const abnormalLatest = keyLabs.filter(
    (k) => k.latest?.flag === "H" || k.latest?.flag === "L",
  );
  const labsCard = (() => {
    if (labs.length === 0)
      return {
        kind: "empty" as const,
        headline: "No panels logged",
        sub: "Upload a lab report or add values manually",
      };
    if (abnormalLatest.length === 0)
      return {
        kind: "ok" as const,
        headline: "All within range",
        sub: `Last panel ${format(parseISO(labs[0].collected_on), "MMM d, yyyy")}`,
      };
    return {
      kind: "warn" as const,
      headline: `${abnormalLatest.length} flagged`,
      sub: abnormalLatest
        .slice(0, 2)
        .map((k) => `${k.analyte} ${k.latest?.flag}`)
        .join(", "),
    };
  })();

  // Pull document filenames for any timeline events that have one — single
  // round trip rather than per-event lookups.
  const docIds = events
    .map((e) => e.document_id)
    .filter((x): x is string => !!x);
  const docByIdRes =
    docIds.length > 0
      ? await supabase
          .from("documents")
          .select("id, original_filename, doc_type")
          .in("id", docIds)
      : { data: [] };
  const docById = new Map<
    string,
    { id: string; original_filename: string | null; doc_type: string | null }
  >();
  for (const d of (docByIdRes.data ?? []) as {
    id: string;
    original_filename: string | null;
    doc_type: string | null;
  }[]) {
    docById.set(d.id, d);
  }

  // Resolve clinic names for any events that have one. Same round-trip
  // strategy — types.gen.ts can't fan out the embedded join.
  const clinicIds = [
    ...new Set(
      events
        .map((e) => e.vet_clinic_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const clinicNamesRes =
    clinicIds.length > 0
      ? await supabase
          .from("vet_clinics")
          .select("id, name")
          .in("id", clinicIds)
      : { data: [] };
  const clinicById = new Map<string, string>();
  for (const c of (clinicNamesRes.data ?? []) as {
    id: string;
    name: string;
  }[]) {
    clinicById.set(c.id, c.name);
  }

  // Reminders sidebar — resolve vaccine names so each row reads "Bailey ·
  // Rabies booster" not "Bailey · <uuid>".
  const reminders = remindersRes.data ?? [];
  const vacIds = reminders
    .filter((r) => r.entity_type === "vaccination")
    .map((r) => r.entity_id);
  const vacForRemRes =
    vacIds.length > 0
      ? await supabase
          .from("vaccinations")
          .select("id, vaccine_type, vaccine_family")
          .in("id", vacIds)
      : { data: [] };
  const vacForRem = new Map<
    string,
    { vaccine_type: string; vaccine_family: string | null }
  >();
  for (const v of (vacForRemRes.data ?? []) as {
    id: string;
    vaccine_type: string;
    vaccine_family: string | null;
  }[]) {
    vacForRem.set(v.id, v);
  }

  const documentCount = docCountRes.count ?? 0;

  return (
    <div className="pet-overview-grid">
      {/* ─── Left column (main) ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <KpiCard
            href={`/pets/${petId}/vaccines`}
            icon="shield"
            label="Vaccines"
            headline={
              vacStat.kind === "empty"
                ? "No vaccines yet"
                : vacStat.total === vacStat.current
                  ? `${vacStat.current} current`
                  : `${vacStat.current} of ${vacStat.total} current`
            }
            sub={
              vacStat.kind === "empty"
                ? "Add or upload a vaccine cert"
                : vacStat.nextLabel && vacStat.nextDate
                  ? `${prettyVaccineName(vacStat.nextLabel)} expires ${format(parseISO(vacStat.nextDate), "MMM d")}`
                  : "No upcoming expirations on file"
            }
            tone={
              vacStat.anyOverdue
                ? "warn"
                : vacStat.kind === "empty"
                  ? "muted"
                  : "ok"
            }
          />
          <KpiCard
            href={`/pets/${petId}/medications`}
            icon="pill"
            label="Medications"
            headline={
              medsStat.activeCount === 0
                ? medsStat.totalEver === 0
                  ? "None on file"
                  : "None active"
                : `${medsStat.activeCount} active`
            }
            sub={
              medsStat.sample ||
              (medsStat.totalEver === 0
                ? "Add a prescription"
                : "All prescriptions ended")
            }
            tone={medsStat.activeCount > 0 ? "ok" : "muted"}
          />
          <KpiCard
            href={`/pets/${petId}/labs`}
            icon="activity"
            label="Labs"
            headline={labsCard.headline}
            sub={labsCard.sub}
            tone={
              labsCard.kind === "warn"
                ? "warn"
                : labsCard.kind === "empty"
                  ? "muted"
                  : "ok"
            }
          />
        </div>

        {/* Recent medical events — timeline */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  font: "600 14px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                Recent medical events
              </h2>
              <p
                style={{
                  margin: "3px 0 0",
                  font: "400 12.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                {documentCount === 0
                  ? "Visits, illnesses, surgeries, labs — populated from uploaded docs"
                  : `Pulled from ${documentCount} ${documentCount === 1 ? "document" : "documents"}`}
              </p>
            </div>
            <Link
              href={`/pets/${petId}/medical`}
              style={{
                font: "500 12.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              View full history →
            </Link>
          </div>

          {events.length === 0 ? (
            <div
              className="pw-card"
              style={{
                padding: 28,
                borderStyle: "dashed",
                background: "transparent",
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-muted)",
                textAlign: "center",
              }}
            >
              Nothing logged yet. Upload a SOAP note or vet record and Pawdex
              will fill this timeline in.
            </div>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                position: "relative",
              }}
            >
              {/* Continuous timeline rail. Sits behind the accent-coloured
                  dots so the list reads as one connected story instead of a
                  stack of cards. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 5,
                  top: 8,
                  bottom: 8,
                  width: 1,
                  background: "var(--pw-border)",
                }}
              />
              {events.map((e, i) => {
                const typeLabel =
                  EVENT_TYPE_LABEL[e.event_type] ??
                  e.event_type.replace(/_/g, " ");
                const doc = e.document_id
                  ? docById.get(e.document_id)
                  : null;
                const clinicName = e.vet_clinic_id
                  ? clinicById.get(e.vet_clinic_id)
                  : null;
                const summary =
                  e.summary?.trim() || e.diagnosis?.trim() || null;
                return (
                  <li
                    key={e.id}
                    style={{
                      position: "relative",
                      paddingLeft: 24,
                      paddingTop: i === 0 ? 0 : 14,
                      paddingBottom: i === events.length - 1 ? 0 : 14,
                      borderBottom:
                        i === events.length - 1
                          ? "none"
                          : "1px solid var(--pw-border)",
                    }}
                  >
                    {/* Accent-green hollow dot on the timeline rail */}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: i === 0 ? 4 : 18,
                        width: 11,
                        height: 11,
                        borderRadius: 999,
                        background: "var(--pw-bg)",
                        border: "2px solid var(--pw-accent)",
                        boxShadow: "0 0 0 3px var(--pw-bg)",
                      }}
                    />
                    {/* Date + type pill — one line, tabular nums on the date */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        font: "400 11.5px var(--font-jetbrains)",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      <span className="tnum">
                        {format(parseISO(e.occurred_on), "MMM d, yyyy")}
                      </span>
                      <span
                        style={{
                          font: "600 9.5px var(--font-jetbrains)",
                          letterSpacing: "0.06em",
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: "var(--pw-surface-2)",
                          color: "var(--pw-text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        {typeLabel}
                      </span>
                    </div>
                    {/* Event title + optional clinic separated by middle-dot */}
                    <div
                      style={{
                        marginTop: 4,
                        font: "500 14px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {e.title}
                      {clinicName && (
                        <span
                          style={{
                            color: "var(--pw-text-secondary)",
                            fontWeight: 400,
                          }}
                        >
                          {" · "}
                          {clinicName}
                        </span>
                      )}
                    </div>
                    {/* Single-line summary, ellipsised so timeline density
                        stays consistent regardless of how chatty the AI
                        extraction was */}
                    {summary && (
                      <div
                        style={{
                          marginTop: 3,
                          font: "400 12.5px var(--font-inter)",
                          color: "var(--pw-text-muted)",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {summary}
                      </div>
                    )}
                    {/* Source-document citation — styled like a quiet
                        accent-coloured link so it doesn't compete with the
                        event title */}
                    {doc && (
                      <Link
                        href={`/pets/${petId}/documents/${doc.id}`}
                        style={{
                          marginTop: 7,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: "var(--pw-accent)",
                          font: "500 12px var(--font-inter)",
                          textDecoration: "none",
                          maxWidth: "100%",
                        }}
                      >
                        <Icon name="file" size={12} />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {doc.original_filename ?? "Source document"}
                        </span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* ─── Right rail ─── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Next up — scheduled reminders */}
        <section>
          <header style={{ marginBottom: 10 }}>
            <h2
              style={{
                margin: 0,
                font: "600 14px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Next up
            </h2>
            <p
              style={{
                margin: "2px 0 0",
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              Scheduled reminders
            </p>
          </header>
          <div
            className="pw-card"
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {reminders.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "8px 4px",
                  font: "400 12.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  textAlign: "center",
                }}
              >
                No upcoming reminders.
              </p>
            ) : (
              reminders.map((r) => {
                const due = parseISO(r.due_on);
                const days = differenceInCalendarDays(due, new Date());
                const vacInfo =
                  r.entity_type === "vaccination"
                    ? vacForRem.get(r.entity_id)
                    : undefined;
                const title = vacInfo
                  ? `${prettyVaccineName(vacInfo.vaccine_type)} booster`
                  : r.entity_type === "medical_event"
                    ? "Follow-up"
                    : "Reminder";
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 4px",
                    }}
                  >
                    <DateChip date={due} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          font: "500 13px var(--font-inter)",
                          color: "var(--pw-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {title}
                      </div>
                      <div
                        style={{
                          font: "400 11.5px var(--font-inter)",
                          color:
                            days < 0
                              ? "var(--pw-status-overdue-fg)"
                              : days <= 14
                                ? "var(--pw-status-due-fg)"
                                : "var(--pw-text-muted)",
                        }}
                      >
                        {days < 0
                          ? `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`
                          : days === 0
                            ? "Today"
                            : days === 1
                              ? "Tomorrow"
                              : `In ${days} days`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Key labs */}
        <section>
          <header
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  font: "600 14px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                Key labs
              </h2>
              <p
                style={{
                  margin: "2px 0 0",
                  font: "400 12px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                Latest reading per analyte
              </p>
            </div>
            <Link
              href={`/pets/${petId}/labs`}
              style={{
                font: "500 12px var(--font-inter)",
                color: "var(--pw-text-muted)",
                textDecoration: "none",
              }}
            >
              All labs →
            </Link>
          </header>
          <div
            className="pw-card"
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {keyLabs.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "8px 4px",
                  font: "400 12.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  textAlign: "center",
                }}
              >
                No lab values logged yet.
              </p>
            ) : (
              keyLabs.map((k) => (
                <LabRow
                  key={k.analyte}
                  analyte={k.analyte}
                  latest={k.latest}
                  series={k.series}
                />
              ))
            )}
          </div>
        </section>
      </aside>

      <style>{`
        .pet-overview-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 980px) {
          .pet-overview-grid {
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 28px;
            align-items: start;
          }
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────── Sub-components ──────────────────────── */

function KpiCard({
  href,
  icon,
  label,
  headline,
  sub,
  tone,
}: {
  href: string;
  icon: IconName;
  label: string;
  headline: string;
  sub: string;
  tone: "ok" | "warn" | "muted";
}) {
  const headlineColor =
    tone === "warn"
      ? "var(--pw-status-due-fg)"
      : tone === "muted"
        ? "var(--pw-text-secondary)"
        : "var(--pw-text)";
  return (
    <Link
      href={href}
      className="pw-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 14,
        textDecoration: "none",
        background: "var(--pw-surface)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "500 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: 4,
            background: "var(--pw-surface-2)",
            color: "var(--pw-text-muted)",
          }}
        >
          <Icon name={icon} size={11} />
        </span>
        {label}
      </div>
      <div
        style={{
          font: "600 18px var(--font-inter)",
          color: headlineColor,
          letterSpacing: "-0.005em",
        }}
      >
        {headline}
      </div>
      <div
        style={{
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sub}
      </div>
    </Link>
  );
}

function DateChip({ date }: { date: Date }) {
  return (
    <div
      style={{
        width: 36,
        textAlign: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          font: "600 9.5px var(--font-jetbrains)",
          letterSpacing: "0.06em",
          color: "var(--pw-text-muted)",
          textTransform: "uppercase",
        }}
      >
        {format(date, "MMM")}
      </div>
      <div
        className="tnum"
        style={{
          font: "600 16px var(--font-inter)",
          color: "var(--pw-text)",
          lineHeight: 1.1,
        }}
      >
        {format(date, "d")}
      </div>
    </div>
  );
}

function LabRow({
  analyte,
  latest,
  series,
}: {
  analyte: string;
  latest: {
    value: number;
    units: string | null;
    reference_low: number | null;
    reference_high: number | null;
    flag: string | null;
  } | null;
  series: number[];
}) {
  if (!latest) return null;
  const range =
    latest.reference_low !== null && latest.reference_high !== null
      ? `${latest.reference_low}–${latest.reference_high}${latest.units ? ` ${latest.units}` : ""}`
      : latest.units ?? "";
  const abnormal = latest.flag === "H" || latest.flag === "L";
  const valueColor = abnormal
    ? "var(--pw-status-overdue-fg)"
    : "var(--pw-text)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 4px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 12.5px var(--font-inter)",
            color: "var(--pw-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {analyte}
        </div>
        {range && (
          <div
            className="tnum"
            style={{
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {range}
          </div>
        )}
      </div>
      <Sparkline values={series} abnormal={abnormal} />
      <div
        className="tnum"
        style={{
          minWidth: 36,
          textAlign: "right",
          font: "600 13px var(--font-inter)",
          color: valueColor,
        }}
      >
        {latest.value}
      </div>
    </div>
  );
}

/**
 * Tiny inline SVG sparkline — no recharts, no responsive container, no
 * client island. Renders one polyline through min/max-normalised points.
 * Falls back to a flat hairline when we only have 1 reading.
 */
function Sparkline({
  values,
  abnormal,
}: {
  values: number[];
  abnormal: boolean;
}) {
  const w = 60;
  const h = 20;
  const pad = 2;
  const stroke = abnormal
    ? "var(--pw-status-overdue-dot)"
    : "var(--pw-accent)";
  if (values.length < 2) {
    return (
      <svg width={w} height={h} aria-hidden>
        <line
          x1={pad}
          y1={h / 2}
          x2={w - pad}
          y2={h / 2}
          stroke="var(--pw-border)"
          strokeWidth={1}
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (values.length - 1);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function prettyVaccineName(vaccineType: string): string {
  // Strip parentheticals like "(1 year)" / "(intranasal)" so the booster
  // copy reads cleanly in the right rail and stat strip.
  return vaccineType.replace(/\s*\([^)]*\)\s*/g, "").trim();
}
