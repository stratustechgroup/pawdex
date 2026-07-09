import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";
import { resolveShareToken } from "@/lib/db/share-links";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Shared pet records — Pawdex" };
export const dynamic = "force-dynamic";

type PetRow = {
  id: string;
  household_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  altered: boolean | null;
  date_of_birth: string | null;
  color: string | null;
  markings: string | null;
  microchip_number: string | null;
  microchip_registry: string | null;
  current_weight_kg: number | null;
};

type VaccinationRow = {
  id: string;
  vaccine_type: string;
  vaccine_family: string | null;
  administered_on: string;
  expires_on: string | null;
  lot_number: string | null;
  manufacturer: string | null;
  administering_vet: string | null;
  is_rabies: boolean | null;
  vet_clinic_id: string | null;
};

type ClinicRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
};

function vaccineFamily(v: VaccinationRow): string {
  return v.vaccine_family ?? v.vaccine_type.toLowerCase();
}

export default async function SharedPacketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await resolveShareToken(token);
  if (!link) {
    return (
      <ExpiredOrInvalid />
    );
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [petRes, vaccRes, householdRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, household_id, name, species, breed, sex, altered, date_of_birth, color, markings, microchip_number, microchip_registry, current_weight_kg",
      )
      .eq("id", link.pet_id)
      .maybeSingle(),
    supabase
      .from("vaccinations")
      .select(
        "id, vaccine_type, vaccine_family, administered_on, expires_on, lot_number, manufacturer, administering_vet, is_rabies, vet_clinic_id",
      )
      .eq("household_id", link.household_id)
      .eq("pet_id", link.pet_id)
      .order("administered_on", { ascending: false }),
    supabase
      .from("households")
      .select("id, name")
      .eq("id", link.household_id)
      .maybeSingle(),
  ]);

  const pet = petRes.data as PetRow | null;
  if (!pet) notFound();

  const allVaccines = (vaccRes.data ?? []) as VaccinationRow[];

  // Latest per family — same logic as the owner-facing packet.
  const latestPerFamily = new Map<string, VaccinationRow>();
  for (const v of allVaccines) {
    const key = vaccineFamily(v);
    const prev = latestPerFamily.get(key);
    if (!prev || v.administered_on > prev.administered_on) {
      latestPerFamily.set(key, v);
    }
  }
  const currentVaccines = Array.from(latestPerFamily.values()).sort((a, b) => {
    const aR = a.is_rabies ? 0 : 1;
    const bR = b.is_rabies ? 0 : 1;
    if (aR !== bR) return aR - bR;
    return (a.expires_on ?? "9999-12-31").localeCompare(
      b.expires_on ?? "9999-12-31",
    );
  });

  const clinicIds = Array.from(
    new Set(
      currentVaccines
        .map((v) => v.vet_clinic_id)
        .filter((id): id is string => !!id),
    ),
  );
  const clinicById = new Map<string, ClinicRow>();
  if (clinicIds.length > 0) {
    const { data: clinics } = await supabase
      .from("vet_clinics")
      .select("id, name, phone, email, address_line1, city, region, postal_code")
      .in("id", clinicIds);
    for (const c of (clinics ?? []) as ClinicRow[]) clinicById.set(c.id, c);
  }

  const { data: primaryClinicRow } = await supabase
    .from("vet_clinics")
    .select("id, name, phone, email, address_line1, city, region, postal_code")
    .eq("household_id", link.household_id)
    .not("last_seen_at", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const primaryClinic = primaryClinicRow as ClinicRow | null;

  const householdName = householdRes.data?.name ?? "the owner";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pw-surface-muted)",
        padding: "32px 16px 56px",
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: "var(--pw-surface)",
          borderRadius: 14,
          padding: 32,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.05)",
        }}
      >
        {/* Pawdex brand strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "500 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <PawdexMark size={16} color="var(--pw-accent)" />
            Pawdex · Shared packet
          </div>
          <div
            style={{
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            Expires {format(new Date(link.expires_at), "MMM d, yyyy")}
          </div>
        </div>

        {/* Letterhead */}
        <header
          style={{
            paddingBottom: 18,
            borderBottom: "2px solid var(--pw-text)",
          }}
        >
          <h1
            className="serif"
            style={{
              margin: 0,
              font: "500 30px var(--font-source-serif)",
              letterSpacing: "-0.02em",
              color: "var(--pw-text)",
            }}
          >
            {pet.name}
          </h1>
          <div
            style={{
              marginTop: 4,
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            {pet.breed ?? pet.species}
            {pet.date_of_birth &&
              ` · DOB ${format(new Date(pet.date_of_birth), "MMM d, yyyy")}`}
          </div>
        </header>

        <section style={{ marginTop: 22, marginBottom: 22 }}>
          <SectionTitle>Patient information</SectionTitle>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              rowGap: 8,
              columnGap: 24,
              font: "400 12.5px var(--font-inter)",
            }}
          >
            <Pair label="Species" value={pet.species} />
            <Pair
              label="Sex"
              value={`${pet.sex}${pet.altered ? ", altered" : ""}`}
            />
            <Pair label="Breed" value={pet.breed ?? "—"} />
            <Pair
              label="Weight"
              value={
                pet.current_weight_kg
                  ? `${pet.current_weight_kg} kg (${(pet.current_weight_kg * 2.20462).toFixed(1)} lb)`
                  : "—"
              }
            />
            <Pair label="Color" value={pet.color ?? "—"} />
            <Pair label="Markings" value={pet.markings ?? "—"} />
            <Pair label="Microchip #" value={pet.microchip_number ?? "—"} />
            <Pair label="Registry" value={pet.microchip_registry ?? "—"} />
          </dl>
        </section>

        <section style={{ marginBottom: 22 }}>
          <SectionTitle>Current vaccinations (latest per family)</SectionTitle>
          {currentVaccines.length === 0 ? (
            <p
              style={{
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              No vaccinations on file.
            </p>
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
                  <Th>Vaccine</Th>
                  <Th>Administered</Th>
                  <Th>Expires</Th>
                  <Th>Lot</Th>
                  <Th>Manufacturer</Th>
                  <Th>Clinic</Th>
                </tr>
              </thead>
              <tbody>
                {currentVaccines.map((v) => {
                  const expired = v.expires_on ? v.expires_on < today : false;
                  const clinic = v.vet_clinic_id
                    ? clinicById.get(v.vet_clinic_id)
                    : null;
                  return (
                    <tr key={v.id} style={{ borderTop: "1px solid var(--pw-border)" }}>
                      <Td style={{ fontWeight: v.is_rabies ? 600 : 400 }}>
                        {v.vaccine_type}
                        {v.is_rabies && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "var(--pw-accent-soft)",
                              color: "var(--pw-accent-fg-on-soft)",
                              font: "500 9px var(--font-jetbrains-mono)",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}
                          >
                            Legal
                          </span>
                        )}
                      </Td>
                      <Td className="tnum">
                        {format(new Date(v.administered_on), "yyyy-MM-dd")}
                      </Td>
                      <Td
                        className="tnum"
                        style={{
                          color: expired ? "#b54a4a" : "var(--pw-text)",
                          fontWeight: expired ? 600 : 400,
                        }}
                      >
                        {v.expires_on ? format(new Date(v.expires_on), "yyyy-MM-dd") : "—"}
                        {expired && " (expired)"}
                      </Td>
                      <Td className="mono">{v.lot_number ?? "—"}</Td>
                      <Td>{v.manufacturer ?? "—"}</Td>
                      <Td>{clinic?.name ?? v.administering_vet ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {primaryClinic && (
          <section style={{ marginBottom: 22 }}>
            <SectionTitle>Primary veterinarian</SectionTitle>
            <div
              style={{
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text)",
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600 }}>{primaryClinic.name}</div>
              {primaryClinic.address_line1 && (
                <div>{primaryClinic.address_line1}</div>
              )}
              {(primaryClinic.city ||
                primaryClinic.region ||
                primaryClinic.postal_code) && (
                <div>
                  {[
                    primaryClinic.city,
                    primaryClinic.region,
                    primaryClinic.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              {primaryClinic.phone && (
                <div className="mono">{primaryClinic.phone}</div>
              )}
              {primaryClinic.email && <div>{primaryClinic.email}</div>}
            </div>
          </section>
        )}

        <footer
          style={{
            marginTop: 32,
            paddingTop: 14,
            borderTop: "1px solid var(--pw-border)",
            font: "400 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: 0 }}>
            Read-only packet generated by Pawdex on behalf of {householdName}.
            {link.recipient_label && (
              <> Shared with <strong>{link.recipient_label}</strong>.</>
            )}{" "}
            This URL expires {format(new Date(link.expires_at), "MMM d, yyyy")}
            {" "}and may be revoked at any time. Pawdex does not verify these
            records against the issuing veterinarian — request the original
            certificate if a notarized copy is required.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ExpiredOrInvalid() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "var(--pw-surface-muted)",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          padding: 32,
          background: "var(--pw-surface)",
          borderRadius: 14,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.05)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Icon name="alert" size={28} style={{ color: "var(--pw-text-muted)" }} />
        <div>
          <div
            style={{
              font: "600 18px var(--font-inter)",
              color: "var(--pw-text)",
              marginBottom: 6,
            }}
          >
            This share link is no longer valid
          </div>
          <p
            style={{
              margin: 0,
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.55,
            }}
          >
            The link has expired or been revoked by the owner. Reach out to the
            person who sent it to you for a fresh URL.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 10px",
        font: "600 11px var(--font-inter)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--pw-text-muted)",
      }}
    >
      {children}
    </h2>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <dt
        style={{
          minWidth: 80,
          font: "500 11.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 6px",
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
      style={{
        padding: "8px 6px",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
