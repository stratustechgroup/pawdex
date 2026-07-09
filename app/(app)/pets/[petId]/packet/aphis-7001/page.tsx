import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

import { PrintButton } from "../print-button";

export const metadata = { title: "APHIS 7001 worksheet — Pawdex" };
export const dynamic = "force-dynamic";

type PetRow = {
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
  vaccine_type: string;
  vaccine_family: string | null;
  administered_on: string;
  expires_on: string | null;
  lot_number: string | null;
  manufacturer: string | null;
  administering_vet: string | null;
  is_rabies: boolean | null;
};

export default async function Aphis7001Page({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [petRes, vaccRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "name, species, breed, sex, altered, date_of_birth, color, markings, microchip_number, microchip_registry, current_weight_kg",
      )
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
    supabase
      .from("vaccinations")
      .select(
        "vaccine_type, vaccine_family, administered_on, expires_on, lot_number, manufacturer, administering_vet, is_rabies",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("administered_on", { ascending: false }),
  ]);

  const pet = petRes.data as PetRow | null;
  if (!pet) notFound();

  const vaccines = (vaccRes.data ?? []) as VaccinationRow[];
  const rabies = vaccines.find((v) => v.is_rabies === true) ?? null;
  const today = new Date().toISOString().slice(0, 10);

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
            href={`/pets/${petId}/packet`}
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
            Back to packet
          </Link>
          <PrintButton />
        </div>

        <header
          style={{
            paddingBottom: 16,
            borderBottom: "2px solid var(--pw-text)",
          }}
        >
          <div
            style={{
              font: "500 11px var(--font-inter)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--pw-text-muted)",
            }}
          >
            Pawdex · APHIS 7001 worksheet
          </div>
          <h1
            className="serif"
            style={{
              margin: "8px 0 4px",
              font: "500 26px var(--font-source-serif)",
              letterSpacing: "-0.02em",
            }}
          >
            United States International Health Certificate
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.55,
            }}
          >
            Bring this worksheet to your USDA-accredited vet at the certificate
            appointment. The vet completes the actual APHIS 7001 form via
            USDA APHIS Veterinary Services; this prefilled summary speeds the
            visit. Issued certificate is valid for the destination&apos;s
            entry window from issue date (typically 10 days).
          </p>
        </header>

        <FormSection label="Section I — Consignor / Origin">
          <Pair label="Owner / household" value={session.householdName} />
          <Pair label="Owner email" value={session.email ?? "—"} />
          <Pair label="Date prepared" value={format(new Date(today), "MMM d, yyyy")} />
        </FormSection>

        <FormSection label="Section II — Animal description">
          <Pair label="Name" value={pet.name} />
          <Pair label="Species" value={pet.species} />
          <Pair label="Breed" value={pet.breed ?? "—"} />
          <Pair
            label="Sex"
            value={`${pet.sex}${pet.altered ? " (altered)" : ""}`}
          />
          <Pair
            label="Date of birth"
            value={
              pet.date_of_birth
                ? format(new Date(pet.date_of_birth), "MMM d, yyyy")
                : "—"
            }
          />
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
          <Pair
            label="Microchip number"
            value={
              pet.microchip_number ? (
                <span className="mono">{pet.microchip_number}</span>
              ) : (
                "—"
              )
            }
          />
          <Pair label="Microchip registry" value={pet.microchip_registry ?? "—"} />
        </FormSection>

        <FormSection label="Section III — Rabies vaccination (REQUIRED)">
          {rabies ? (
            <>
              <Pair label="Vaccine product" value={rabies.vaccine_type} />
              <Pair
                label="Administered on"
                value={format(new Date(rabies.administered_on), "MMM d, yyyy")}
              />
              <Pair
                label="Expiration"
                value={
                  rabies.expires_on
                    ? format(new Date(rabies.expires_on), "MMM d, yyyy")
                    : "—"
                }
              />
              <Pair
                label="Lot number"
                value={
                  rabies.lot_number ? (
                    <span className="mono">{rabies.lot_number}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Pair label="Manufacturer" value={rabies.manufacturer ?? "—"} />
              <Pair
                label="Administering vet"
                value={rabies.administering_vet ?? "—"}
              />
            </>
          ) : (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: 10,
                borderRadius: 6,
                background: "#fce8e8",
                color: "#7a2424",
                font: "500 12px var(--font-inter)",
              }}
            >
              No rabies vaccine on file. APHIS 7001 cannot be issued without a
              current rabies vaccination administered at least 30 days before
              travel (most destinations).
            </div>
          )}
        </FormSection>

        <FormSection label="Section IV — Other current vaccinations">
          {vaccines.filter((v) => !v.is_rabies).length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              None on file.
            </div>
          ) : (
            <table
              style={{
                gridColumn: "1 / -1",
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
                </tr>
              </thead>
              <tbody>
                {vaccines
                  .filter((v) => !v.is_rabies)
                  .map((v, i) => (
                    <tr
                      key={i}
                      style={{ borderTop: "1px solid var(--pw-border)" }}
                    >
                      <Td>{v.vaccine_type}</Td>
                      <Td className="tnum">
                        {format(new Date(v.administered_on), "yyyy-MM-dd")}
                      </Td>
                      <Td className="tnum">
                        {v.expires_on ? format(new Date(v.expires_on), "yyyy-MM-dd") : "—"}
                      </Td>
                      <Td className="mono">{v.lot_number ?? "—"}</Td>
                      <Td>{v.manufacturer ?? "—"}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </FormSection>

        <FormSection label="Section V — Veterinarian certification (vet completes)">
          <SignatureLine label="Examining vet signature" />
          <SignatureLine label="USDA accreditation #" />
          <SignatureLine label="Date of examination" />
          <SignatureLine label="USDA APHIS endorsement date + stamp" />
        </FormSection>

        <footer
          style={{
            marginTop: 24,
            paddingTop: 14,
            borderTop: "1px solid var(--pw-border)",
            font: "400 10.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          This worksheet summarizes Pawdex records to speed the certificate
          appointment. It is NOT a legal substitute for the issued APHIS 7001
          form. The vet must complete and the USDA APHIS office must endorse
          the official form within 10 days of travel (some destinations vary).
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
      @page { margin: 14mm; }
    `}</style>
  );
}

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 20 }}>
      <div
        style={{
          font: "600 10.5px var(--font-inter)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pw-text-muted)",
          paddingBottom: 4,
          borderBottom: "1px solid var(--pw-text-muted)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gap: "6px 24px",
          gridTemplateColumns: "repeat(2, 1fr)",
          font: "400 12px var(--font-inter)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Pair({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span
        style={{
          minWidth: 130,
          font: "500 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--pw-text)" }}>{value}</span>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        gap: 10,
        alignItems: "flex-end",
        paddingTop: 16,
      }}
    >
      <span
        style={{
          font: "500 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          minWidth: 220,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: "var(--pw-text)",
        }}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 6px",
        font: "600 10px var(--font-inter)",
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
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={className}
      style={{ padding: "6px", verticalAlign: "top" }}
    >
      {children}
    </td>
  );
}
