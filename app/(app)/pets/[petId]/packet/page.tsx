import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

import { listShareLinksForPet } from "@/lib/db/share-links";

import { PrintButton } from "./print-button";
import { SharePanel } from "./share-panel";

export const metadata = { title: "Compliance packet — Pawdex" };
export const dynamic = "force-dynamic";

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  altered: boolean | null;
  date_of_birth: string | null;
  dob_is_estimated: boolean;
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

export default async function CompliancePacketPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [petRes, vaccRes, householdRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, name, species, breed, sex, altered, date_of_birth, dob_is_estimated, color, markings, microchip_number, microchip_registry, current_weight_kg",
      )
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
    supabase
      .from("vaccinations")
      .select(
        "id, vaccine_type, vaccine_family, administered_on, expires_on, lot_number, manufacturer, administering_vet, is_rabies, vet_clinic_id",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("administered_on", { ascending: false }),
    supabase
      .from("households")
      .select("id, name")
      .eq("id", session.householdId)
      .maybeSingle(),
  ]);

  const pet = petRes.data as PetRow | null;
  if (!pet) {
    return (
      <div style={{ padding: 32, color: "var(--pw-text-muted)" }}>
        Pet not found in your household.
      </div>
    );
  }
  const shareLinks = await listShareLinksForPet(session.householdId, petId);
  const allVaccines = (vaccRes.data ?? []) as VaccinationRow[];

  // Latest per family.
  const latestPerFamily = new Map<string, VaccinationRow>();
  for (const v of allVaccines) {
    const key = vaccineFamily(v);
    const prev = latestPerFamily.get(key);
    if (!prev || v.administered_on > prev.administered_on) {
      latestPerFamily.set(key, v);
    }
  }
  const currentVaccines = Array.from(latestPerFamily.values()).sort((a, b) => {
    // Rabies first, then by expiry ascending.
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

  // Pick the most recently visited clinic as the primary contact.
  const { data: primaryClinicRow } = await supabase
    .from("vet_clinics")
    .select("id, name, phone, email, address_line1, city, region, postal_code")
    .eq("household_id", session.householdId)
    .not("last_seen_at", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const primaryClinic = primaryClinicRow as ClinicRow | null;

  const householdName = householdRes.data?.name ?? session.householdName;

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
        {/* Top toolbar — hidden on print */}
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            paddingBottom: 18,
            borderBottom: "2px solid var(--pw-text)",
          }}
        >
          <div>
            <div
              style={{
                font: "500 11px var(--font-inter)",
                color: "var(--pw-text-muted)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Pawdex · Compliance packet
            </div>
            <h1
              className="serif"
              style={{
                margin: "8px 0 4px",
                font: "500 30px var(--font-source-serif)",
                letterSpacing: "-0.02em",
                color: "var(--pw-text)",
              }}
            >
              {pet.name}
            </h1>
            <div
              style={{
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-secondary)",
              }}
            >
              {pet.breed ?? pet.species}
              {pet.date_of_birth &&
                ` · DOB ${format(new Date(pet.date_of_birth), "MMM d, yyyy")}${pet.dob_is_estimated ? " (estimated)" : ""}`}
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            <div>Generated {format(new Date(), "MMM d, yyyy 'at' h:mm a")}</div>
            <div>Household: {householdName}</div>
            <div>Owner contact: {session.email ?? "—"}</div>
          </div>
        </header>

        {/* Pet identity grid */}
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
            <Pair label="Sex" value={`${pet.sex}${pet.altered ? ", altered" : ""}`} />
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

        {/* Vaccination summary */}
        <section style={{ marginBottom: 22 }}>
          <SectionTitle>Current vaccinations (latest per family)</SectionTitle>
          {currentVaccines.length === 0 ? (
            <p
              style={{
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              No vaccinations recorded. Most boarding facilities, airlines, and
              international travel programs require current vaccinations before
              accepting your pet.
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
                    <tr
                      key={v.id}
                      style={{
                        borderTop: "1px solid var(--pw-border)",
                      }}
                    >
                      <Td
                        style={{
                          fontWeight: v.is_rabies ? 600 : 400,
                          color: v.is_rabies
                            ? "var(--pw-text)"
                            : "var(--pw-text)",
                        }}
                      >
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

        {/* Primary vet */}
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
              {primaryClinic.address_line1 && <div>{primaryClinic.address_line1}</div>}
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

        {/* Specialty packet variants — hidden on print */}
        <div
          className="pw-print-hide"
          style={{
            marginTop: 24,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <Link
            href={`/pets/${pet.id}/packet/aphis-7001`}
            className="pw-card"
            style={{
              padding: 14,
              display: "flex",
              gap: 10,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--pw-accent-soft)",
                color: "var(--pw-accent-fg-on-soft)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="fileCheck" size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  font: "600 13px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                APHIS 7001 worksheet
              </div>
              <div
                style={{
                  font: "400 11.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                USDA international health certificate prefill for your vet.
              </div>
            </div>
            <Icon name="chevronRight" size={13} style={{ color: "var(--pw-text-muted)" }} />
          </Link>
          <Link
            href={`/pets/${pet.id}/eu-travel`}
            className="pw-card"
            style={{
              padding: 14,
              display: "flex",
              gap: 10,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--pw-accent-soft)",
                color: "var(--pw-accent-fg-on-soft)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="paw" size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  font: "600 13px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                EU travel readiness
              </div>
              <div
                style={{
                  font: "400 11.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                Destination-aware checklist for EU pet passport compliance.
              </div>
            </div>
            <Icon name="chevronRight" size={13} style={{ color: "var(--pw-text-muted)" }} />
          </Link>
        </div>

        {/* Share panel — hidden on print */}
        <div className="pw-print-hide" style={{ marginTop: 24 }}>
          <SharePanel
            petId={pet.id}
            existing={shareLinks.map((s) => ({
              id: s.id,
              recipient_label: s.recipient_label,
              expires_at: s.expires_at,
              revoked_at: s.revoked_at,
              access_count: s.access_count,
              last_accessed_at: s.last_accessed_at,
              created_at: s.created_at,
            }))}
          />
        </div>

        {/* Authenticity footer */}
        <footer
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "1px solid var(--pw-border)",
            font: "400 10.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0 }}>
            This compliance packet was generated from records held in Pawdex on
            behalf of {householdName}. Vaccinations marked &ldquo;Legal&rdquo;
            are rabies-tier records; please request the original certificate
            from the issuing clinic if a notarized copy is required (USDA APHIS
            7001, EU pet passport, etc.).
          </p>
          <p style={{ margin: "8px 0 0" }}>
            Pawdex does not verify the authenticity of records against the
            issuing veterinarian and is not a substitute for the original
            certificate. The owner is responsible for ensuring the data is
            current and accurate before submitting to a recipient.
          </p>
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
