import Link from "next/link";
import { notFound } from "next/navigation";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { StatusBadge, type StatusKind } from "@/components/pawdex/status-badge";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getPet, listPetsForHousehold } from "@/lib/db/pets";
import { ageFromDob, kgToLbs } from "@/lib/utils";

import { MicrochipCopy } from "./microchip-copy";
import { PetActionsMenu } from "./pet-actions-menu";
import { PetTabs } from "./pet-tabs";

export default async function PetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // One parallel phase for everything keyed by (household_id, petId): the pet
  // row itself, the household roster (for the status badge), and all tab/stat
  // counts. None depends on another, so they resolve in a single round trip
  // rather than the old getPet -> listPets -> counts chain. RLS covers the
  // cross-household isolation for free. The count queries use petId directly
  // (identical to pet.id) so they don't have to wait on getPet.
  const [
    pet,
    all,
    vacCount,
    eventCount,
    medCount,
    docCount,
    nextVacRes,
    lastVisitRes,
    weightHistRes,
  ] = await Promise.all([
    getPet(session.householdId, petId),
    listPetsForHousehold(session.householdId),
    supabase
      .from("vaccinations")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    supabase
      .from("medical_events")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    supabase
      .from("medications")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    supabase
      .from("documents")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    // Next due vaccine — soonest expiry that isn't already overdue.
    supabase
      .from("vaccinations")
      .select("id, vaccine_type, vaccine_family, expires_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .not("expires_on", "is", null)
      .gte("expires_on", today)
      .order("expires_on", { ascending: true })
      .limit(1),
    // Last visit — most recent medical event, joined to vet_clinics for the
    // "primary vet" line in the meta. We don't store a primary_vet_id on
    // pets, so "where they were seen most recently" is the cheapest signal.
    supabase
      .from("medical_events")
      .select("id, occurred_on, vet_clinic_id")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("occurred_on", { ascending: false })
      .limit(1),
    // Weight delta — last two readings drive "↗ +0.8 lb" in the stat strip.
    supabase
      .from("weight_log")
      .select("weight_kg, recorded_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("recorded_on", { ascending: false })
      .limit(2),
  ]);

  if (!pet) notFound();

  const withStatus = all.find((p) => p.id === petId);
  const status = (withStatus?.status as StatusKind) ?? "incomplete";

  // Second parallel phase: the two lookups that depend on phase-one results.
  // The clinic name needs the latest visit's clinic id; the signed photo URL
  // needs the pet's storage path. They're independent of each other, so resolve
  // them together instead of back to back.
  const lastVisit = lastVisitRes.data?.[0] ?? null;
  const [lastVisitClinic, photoUrl] = await Promise.all([
    lastVisit?.vet_clinic_id
      ? supabase
          .from("vet_clinics")
          .select("name")
          .eq("household_id", session.householdId)
          .eq("id", lastVisit.vet_clinic_id)
          .maybeSingle()
          .then((r) => r.data?.name ?? null)
      : Promise.resolve<string | null>(null),
    pet.photo_storage_path
      ? supabase.storage
          .from("pet-photos")
          .createSignedUrl(pet.photo_storage_path, 60 * 60)
          .then((r) => r.data?.signedUrl ?? null)
      : Promise.resolve<string | null>(null),
  ]);

  // ---- Stat-strip derivations ----
  const age = ageFromDob(pet.date_of_birth);
  const meta = [
    capitalize(pet.species),
    pet.sex !== "unknown" ? capitalize(pet.sex) : null,
    pet.date_of_birth
      ? `${format(parseISO(pet.date_of_birth), "MMM d, yyyy")}${age ? ` (${age})` : ""}`
      : null,
    lastVisitClinic,
  ]
    .filter(Boolean)
    .join(" · ");

  const breedLine = pet.breed ?? null;

  // Weight strip — current value + delta vs prior reading when ≥2 entries.
  const weights = (weightHistRes.data ?? []) as {
    weight_kg: number;
    recorded_on: string;
  }[];
  const currentLb = pet.current_weight_kg
    ? kgToLbs(Number(pet.current_weight_kg))
    : weights[0]
      ? kgToLbs(Number(weights[0].weight_kg))
      : null;
  const deltaLb =
    weights.length >= 2
      ? kgToLbs(Number(weights[0].weight_kg)) -
        kgToLbs(Number(weights[1].weight_kg))
      : null;

  // Last visit — date + "n days ago" relative chip.
  const lastVisitDate = lastVisit?.occurred_on ?? null;
  const lastVisitDaysAgo = lastVisitDate
    ? Math.max(0, differenceInCalendarDays(new Date(), parseISO(lastVisitDate)))
    : null;

  // Next due — vaccine type + "in n days" chip. Coloured by urgency.
  const nextVac = nextVacRes.data?.[0] ?? null;
  const nextDays = nextVac?.expires_on
    ? differenceInCalendarDays(parseISO(nextVac.expires_on), new Date())
    : null;
  const nextDueLabel = nextVac
    ? prettyVaccineLabel(nextVac.vaccine_type, nextVac.vaccine_family)
    : null;

  return (
    <div style={{ background: "var(--pw-bg)" }}>
      {/* Breadcrumbs */}
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "16px 24px 0",
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          {session.householdName}
        </Link>
        <Icon name="chevronRight" size={12} />
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Pets
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>{pet.name}</span>
      </div>

      {/* Pet header */}
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "20px 24px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: 18,
        }}
      >
        <PetPhoto name={pet.name} src={photoUrl} size={88} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h1
              className="serif"
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "var(--pw-text)",
              }}
            >
              {pet.name}
            </h1>
            <StatusBadge kind={status} />
          </div>
          <div
            style={{
              marginTop: 6,
              font: "400 13.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {breedLine && (
              <>
                <span style={{ color: "var(--pw-text-secondary)" }}>
                  {breedLine}
                </span>
                {meta && " · "}
              </>
            )}
            {meta}
          </div>

          {/* Stat strip — 4 columns. Each cell self-suppresses if data isn't
              available so the strip degrades to whatever signal we have. */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: 28,
            }}
          >
            {currentLb !== null && (
              <StatCell label="Weight">
                <span
                  className="tnum"
                  style={{
                    font: "600 17px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  {currentLb} lb
                </span>
                {deltaLb !== null && (
                  <span
                    style={{
                      marginLeft: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                      font: "500 12.5px var(--font-inter)",
                      color:
                        deltaLb > 0
                          ? "var(--pw-text-secondary)"
                          : deltaLb < 0
                            ? "var(--pw-status-due-fg)"
                            : "var(--pw-text-muted)",
                    }}
                  >
                    <Icon
                      name={deltaLb >= 0 ? "trendUp" : "trendDown"}
                      size={11}
                    />
                    {deltaLb > 0 ? "+" : ""}
                    {deltaLb.toFixed(1)} lb
                  </span>
                )}
              </StatCell>
            )}

            {lastVisitDate && (
              <StatCell label="Last visit">
                <span
                  className="tnum"
                  style={{
                    font: "600 17px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  {format(parseISO(lastVisitDate), "MMM d")}
                </span>
                {lastVisitDaysAgo !== null && (
                  <span
                    style={{
                      marginLeft: 8,
                      font: "500 12.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {lastVisitDaysAgo} {lastVisitDaysAgo === 1 ? "day" : "days"}{" "}
                    ago
                  </span>
                )}
              </StatCell>
            )}

            {nextVac && nextDueLabel && nextDays !== null && (
              <StatCell label="Next due">
                <span
                  style={{
                    font: "600 17px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  {nextDueLabel}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    font: "500 12.5px var(--font-inter)",
                    color:
                      nextDays <= 14
                        ? "var(--pw-status-due-fg)"
                        : nextDays <= 30
                          ? "var(--pw-status-due-fg)"
                          : "var(--pw-text-muted)",
                  }}
                >
                  {nextDays === 0
                    ? "Today"
                    : nextDays === 1
                      ? "Tomorrow"
                      : `In ${nextDays} days`}
                </span>
              </StatCell>
            )}

            {pet.microchip_number && (
              <StatCell label="Microchip">
                <MicrochipCopy
                  number={pet.microchip_number}
                  registry={pet.microchip_registry}
                />
              </StatCell>
            )}
          </div>
        </div>

        {/* Action cluster — Upload + Export record + overflow. The overflow
            holds Briefing / EU travel / Emergency / Edit so the header isn't
            a 6-button traffic jam. */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Link
            href={`/pets/${pet.id}/upload`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 12px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 12.5px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            <Icon name="upload" size={13} />
            Upload
          </Link>
          <Link
            href={`/pets/${pet.id}/packet`}
            title="Compliance packet — vaccines, microchip, rabies cert, ready to share with boarding, airlines, or another vet"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 12px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 12.5px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            <Icon name="download" size={13} />
            Export record
          </Link>
          <PetActionsMenu petId={pet.id} petName={pet.name} />
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 24px" }}>
        <PetTabs
          petId={pet.id}
          counts={{
            Vaccines: vacCount.count ?? 0,
            Medical: eventCount.count ?? 0,
            Medications: medCount.count ?? 0,
            Documents: docCount.count ?? 0,
          }}
        />
      </div>

      {/* Body */}
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "24px 24px 56px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StatCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          font: "500 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline" }}>{children}</div>
    </div>
  );
}

/**
 * Friendly short label for the "Next due" stat — falls back to capitalised
 * family when the verbatim vaccine_type is a long brand string.
 */
function prettyVaccineLabel(
  vaccineType: string,
  family: string | null,
): string {
  if (family) {
    switch (family) {
      case "rabies":
        return "Rabies";
      case "dhpp":
        return "DHPP";
      case "leptospirosis":
        return "Lepto";
      case "bordetella":
        return "Bordetella";
      case "civ":
        return "CIV";
      case "lyme":
        return "Lyme";
      case "rattlesnake":
        return "Rattlesnake";
      case "fvrcp":
        return "FVRCP";
      case "felv":
        return "FeLV";
      case "fiv":
        return "FIV";
    }
  }
  // Type fallback — trim to two words to fit the stat slot.
  const words = vaccineType.split(/\s+/);
  return words.slice(0, 2).join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
