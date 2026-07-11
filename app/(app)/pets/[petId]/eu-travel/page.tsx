import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import {
  computeEuComplianceReport,
  EU_DESTINATIONS,
  type Destination,
  type RequirementStatus,
} from "@/lib/compliance/eu-passport";
import { createClient } from "@/lib/supabase/server";

import { PrintButton } from "../packet/print-button";
import { DestinationSelector } from "./destination-selector";

export const metadata = { title: "EU travel readiness · Pawdex" };
export const dynamic = "force-dynamic";

const DEFAULT_DESTINATION: Destination =
  EU_DESTINATIONS.find((d) => d.code === "FR") ?? EU_DESTINATIONS[0];

export default async function EuTravelPage({
  params,
  searchParams,
}: {
  params: Promise<{ petId: string }>;
  searchParams: Promise<{ to?: string; date?: string }>;
}) {
  const { petId } = await params;
  const sp = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();

  const destination =
    EU_DESTINATIONS.find((d) => d.code === sp.to) ?? DEFAULT_DESTINATION;
  const travelDate =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : null;

  const [petRes, vaccRes, medsRes, eventsRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "name, species, date_of_birth, microchip_number, microchip_registry",
      )
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
    supabase
      .from("vaccinations")
      .select(
        "vaccine_type, vaccine_family, administered_on, expires_on, is_rabies",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    supabase
      .from("medications")
      .select("name, generic_name, indication, started_on, ended_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    supabase
      .from("medical_events")
      .select("event_type, occurred_on, title, summary, diagnosis")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
  ]);

  const pet = petRes.data;
  if (!pet) notFound();

  const report = computeEuComplianceReport({
    pet,
    vaccinations: vaccRes.data ?? [],
    medications: medsRes.data ?? [],
    events: eventsRes.data ?? [],
    destination,
    travel_date: travelDate,
  });

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
        {/* Toolbar — print-hidden */}
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
            marginBottom: 24,
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
            Pawdex · EU travel readiness
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
                {pet.name} → {destination.name}
              </h1>
              <div
                style={{
                  font: "400 12.5px var(--font-inter)",
                  color: "var(--pw-text-secondary)",
                  marginTop: 4,
                }}
              >
                Compliance against EU post-2026-04-22 rules
                {travelDate && ` · travel ${format(new Date(travelDate), "MMM d, yyyy")}`}
              </div>
            </div>
            <OverallBadge status={report.overall_status} />
          </div>
        </header>

        {/* Selector — hidden on print */}
        <div className="pw-print-hide" style={{ marginBottom: 24 }}>
          <DestinationSelector
            petId={petId}
            destinations={EU_DESTINATIONS}
            currentTo={destination.code}
            currentDate={travelDate}
          />
        </div>

        {/* Requirements */}
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
          {report.requirements.map((r) => (
            <li
              key={r.id}
              className="pw-card"
              style={{
                padding: 16,
                borderLeft: `3px solid ${borderColorFor(r.status)}`,
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <StatusIcon status={r.status} />
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
                      font: "600 14px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    {r.label}
                  </span>
                  <StatusPill status={r.status} />
                </div>
                <p
                  style={{
                    margin: "6px 0 0",
                    font: "400 12.5px var(--font-inter)",
                    color: "var(--pw-text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  {r.detail}
                </p>
                {r.action_required && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      padding: "8px 10px",
                      background: "var(--pw-surface-muted)",
                      borderRadius: 6,
                      font: "500 12px var(--font-inter)",
                      color: "var(--pw-text)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        font: "600 10.5px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Action ·{" "}
                    </span>
                    {r.action_required}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Disclaimer */}
        <footer
          style={{
            marginTop: 28,
            paddingTop: 14,
            borderTop: "1px solid var(--pw-border)",
            font: "400 10.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Generated by Pawdex {format(new Date(), "MMM d, yyyy 'at' h:mm a")}.
          This is a checklist derived from the records you have on file. Pawdex
          does not verify against the issuing veterinarian and is not a
          substitute for a USDA-accredited vet&apos;s sign-off on the EU Animal
          Health Certificate. The rules above reflect post-2026-04-22 EU entry
          requirements as Pawdex understands them — verify with your vet and
          the destination country&apos;s competent authority before travel.
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

function borderColorFor(status: RequirementStatus): string {
  switch (status) {
    case "ok":
      return "var(--pw-accent)";
    case "warning":
      return "#f0c674";
    case "blocker":
      return "#b54a4a";
    case "todo":
      return "var(--pw-text-muted)";
    case "na":
      return "var(--pw-border)";
  }
}

function StatusIcon({ status }: { status: RequirementStatus }) {
  const map: Record<
    RequirementStatus,
    { icon: string; bg: string; fg: string }
  > = {
    ok: {
      icon: "checkCircle",
      bg: "var(--pw-accent-soft)",
      fg: "var(--pw-accent-fg-on-soft)",
    },
    warning: { icon: "alert", bg: "#fff6e8", fg: "#6a4a10" },
    blocker: { icon: "x", bg: "#fce8e8", fg: "#7a2424" },
    todo: { icon: "clock", bg: "var(--pw-surface-muted)", fg: "var(--pw-text-muted)" },
    na: { icon: "minus", bg: "var(--pw-surface-muted)", fg: "var(--pw-text-subtle)" },
  };
  const m = map[status];
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: m.bg,
        color: m.fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name={m.icon} size={14} />
    </span>
  );
}

function StatusPill({ status }: { status: RequirementStatus }) {
  const label: Record<RequirementStatus, string> = {
    ok: "Ready",
    warning: "Verify",
    blocker: "Blocker",
    todo: "To do",
    na: "n/a",
  };
  const colorBg: Record<RequirementStatus, string> = {
    ok: "var(--pw-accent-soft)",
    warning: "#fff6e8",
    blocker: "#fce8e8",
    todo: "var(--pw-surface-muted)",
    na: "var(--pw-surface-muted)",
  };
  const colorFg: Record<RequirementStatus, string> = {
    ok: "var(--pw-accent-fg-on-soft)",
    warning: "#6a4a10",
    blocker: "#7a2424",
    todo: "var(--pw-text-muted)",
    na: "var(--pw-text-subtle)",
  };
  return (
    <span
      style={{
        font: "500 10.5px var(--font-inter)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: colorBg[status],
        color: colorFg[status],
        padding: "2px 8px",
        borderRadius: 999,
      }}
    >
      {label[status]}
    </span>
  );
}

function OverallBadge({
  status,
}: {
  status: "ready" | "partial" | "blocked";
}) {
  const map = {
    ready: {
      label: "Ready to travel",
      bg: "var(--pw-accent-soft)",
      fg: "var(--pw-accent-fg-on-soft)",
      icon: "checkCircle",
    },
    partial: {
      label: "Action items remaining",
      bg: "#fff6e8",
      fg: "#6a4a10",
      icon: "alert",
    },
    blocked: {
      label: "Not yet eligible",
      bg: "#fce8e8",
      fg: "#7a2424",
      icon: "x",
    },
  } as const;
  const m = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: m.bg,
        color: m.fg,
        font: "600 11.5px var(--font-inter)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}
