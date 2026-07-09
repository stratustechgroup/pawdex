import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { isMedicationActive } from "@/lib/utils";

import { PrintButton } from "../packet/print-button";

export const metadata = { title: "Emergency card — Pawdex" };
export const dynamic = "force-dynamic";

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  color: string | null;
  markings: string | null;
  microchip_number: string | null;
  microchip_registry: string | null;
  photo_storage_path: string | null;
  notes: string | null;
};

type EventRow = {
  diagnosis: string | null;
  title: string;
  occurred_on: string;
};

type MedRow = {
  name: string;
  generic_name: string | null;
  dose: string;
  frequency: string | null;
  indication: string | null;
  medication_context: string;
  ended_on: string | null;
};

type ClinicRow = {
  name: string;
  phone: string | null;
  email: string | null;
};

const ALLERGY_KEYWORDS = ["allerg", "anaphyl", "hypersensitiv"];

export default async function EmergencyCardPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [petRes, eventsRes, medsRes, primaryClinicRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, name, species, breed, color, markings, microchip_number, microchip_registry, photo_storage_path, notes",
      )
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
    supabase
      .from("medical_events")
      .select("diagnosis, title, occurred_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId),
    supabase
      .from("medications")
      .select(
        "name, generic_name, dose, frequency, indication, medication_context, ended_on",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("started_on", { ascending: false }),
    supabase
      .from("vet_clinics")
      .select("name, phone, email")
      .eq("household_id", session.householdId)
      .not("last_seen_at", "is", null)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const pet = petRes.data as PetRow | null;
  if (!pet) notFound();

  const allergies = ((eventsRes.data ?? []) as EventRow[])
    .filter((e) => {
      const text = `${e.title} ${e.diagnosis ?? ""}`.toLowerCase();
      return ALLERGY_KEYWORDS.some((k) => text.includes(k));
    })
    .slice(0, 5);

  const activeMeds = ((medsRes.data ?? []) as MedRow[]).filter(
    (m) =>
      m.medication_context === "prescribed_takehome" &&
      isMedicationActive(m.ended_on),
  );

  const primaryClinic = primaryClinicRes.data as ClinicRow | null;

  // Signed URL for the photo if present.
  let photoUrl: string | null = null;
  if (pet.photo_storage_path) {
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrl(pet.photo_storage_path, 60 * 60);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <CardPrintStyles />
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "32px 24px 56px",
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
            marginBottom: 18,
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

        <div
          className="pw-print-hide"
          style={{
            marginBottom: 24,
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Print at 100% (no scaling). Cut along the dotted border and laminate
          for a wallet-sized card. Many owners also snap a photo and save it to
          their phone&apos;s lock-screen for first-responder access.
        </div>

        {/* Front + back cards */}
        <div
          className="pw-card-grid"
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 360px))",
            justifyContent: "center",
          }}
        >
          <CardFront
            pet={pet}
            photoUrl={photoUrl}
            owner={{
              name: session.householdName,
              email: session.email ?? null,
            }}
          />
          <CardBack
            primaryClinic={primaryClinic}
            allergies={allergies.map((a) => a.diagnosis ?? a.title)}
            meds={activeMeds}
            notes={pet.notes}
          />
        </div>
      </div>
    </>
  );
}

function CardPrintStyles() {
  return (
    <style>{`
      @media print {
        .pw-print-hide { display: none !important; }
        body { background: white !important; padding: 0 !important; }
        .pw-card-grid { gap: 12px !important; }
        .pw-id-card { box-shadow: none !important; page-break-inside: avoid; }
      }
      @page { margin: 12mm; }
    `}</style>
  );
}

function CardFront({
  pet,
  photoUrl,
  owner,
}: {
  pet: PetRow;
  photoUrl: string | null;
  owner: { name: string; email: string | null };
}) {
  return (
    <article
      className="pw-id-card"
      style={{
        width: 360,
        minHeight: 220,
        padding: 16,
        borderRadius: 12,
        background: "var(--pw-surface)",
        border: "1px dashed var(--pw-text-muted)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            font: "500 9.5px var(--font-inter)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--pw-text-muted)",
          }}
        >
          <PawdexMark size={12} color="var(--pw-accent)" />
          Pet ID
        </div>
        <span
          style={{
            font: "500 9.5px var(--font-inter)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--pw-text-muted)",
          }}
        >
          Front
        </span>
      </header>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            background: "var(--pw-photo-tint-1)",
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--pw-text-muted)",
          }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={pet.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Icon name="paw" size={28} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="serif"
            style={{
              font: "500 22px var(--font-source-serif)",
              letterSpacing: "-0.02em",
              color: "var(--pw-text)",
              lineHeight: 1.1,
            }}
          >
            {pet.name}
          </div>
          <div
            style={{
              marginTop: 3,
              font: "400 11.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            {pet.breed ?? pet.species}
          </div>
        </div>
      </div>

      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 4,
          columnGap: 10,
          font: "400 11px var(--font-inter)",
        }}
      >
        {pet.color && <Pair label="Color" value={pet.color} />}
        {pet.markings && <Pair label="Markings" value={pet.markings} />}
        {pet.microchip_number && (
          <Pair
            label="Microchip"
            value={
              <span className="mono">
                {pet.microchip_number}
                {pet.microchip_registry ? ` · ${pet.microchip_registry}` : ""}
              </span>
            }
          />
        )}
      </dl>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 8,
          borderTop: "1px solid var(--pw-border)",
          font: "400 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>
            Owner:{" "}
            <strong style={{ color: "var(--pw-text)", fontWeight: 600 }}>
              {owner.name}
            </strong>
          </span>
          {owner.email && (
            <span className="mono" style={{ color: "var(--pw-text)" }}>
              {owner.email}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function CardBack({
  primaryClinic,
  allergies,
  meds,
  notes,
}: {
  primaryClinic: ClinicRow | null;
  allergies: string[];
  meds: MedRow[];
  notes: string | null;
}) {
  return (
    <article
      className="pw-id-card"
      style={{
        width: 360,
        minHeight: 220,
        padding: 16,
        borderRadius: 12,
        background: "var(--pw-surface)",
        border: "1px dashed var(--pw-text-muted)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            font: "500 9.5px var(--font-inter)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--pw-text-muted)",
          }}
        >
          Emergency info
        </span>
        <span
          style={{
            font: "500 9.5px var(--font-inter)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--pw-text-muted)",
          }}
        >
          Back
        </span>
      </header>

      <div>
        <MicroLabel>Emergency vet</MicroLabel>
        {primaryClinic ? (
          <div
            style={{
              font: "500 12px var(--font-inter)",
              color: "var(--pw-text)",
              lineHeight: 1.45,
            }}
          >
            <div>{primaryClinic.name}</div>
            {primaryClinic.phone && (
              <div className="mono" style={{ color: "var(--pw-text-secondary)" }}>
                {primaryClinic.phone}
              </div>
            )}
          </div>
        ) : (
          <div style={{ font: "400 11.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
            No primary vet on file
          </div>
        )}
      </div>

      <div>
        <MicroLabel>Allergies</MicroLabel>
        {allergies.length === 0 ? (
          <span
            style={{
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            None known
          </span>
        ) : (
          <div
            style={{
              font: "500 11.5px var(--font-inter)",
              color: "var(--pw-text)",
              lineHeight: 1.4,
            }}
          >
            {allergies.join(" · ")}
          </div>
        )}
      </div>

      <div>
        <MicroLabel>Active medications</MicroLabel>
        {meds.length === 0 ? (
          <span
            style={{
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            None
          </span>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            {meds.slice(0, 5).map((m, i) => (
              <li key={i}>
                <strong style={{ fontWeight: 600 }}>{m.name}</strong>{" "}
                <span className="mono" style={{ color: "var(--pw-text-secondary)" }}>
                  {m.dose}
                  {m.frequency ? ` ${m.frequency}` : ""}
                </span>
              </li>
            ))}
            {meds.length > 5 && (
              <li style={{ color: "var(--pw-text-muted)" }}>+ {meds.length - 5} more</li>
            )}
          </ul>
        )}
      </div>

      {notes && (
        <div>
          <MicroLabel>Special handling</MicroLabel>
          <p
            style={{
              margin: 0,
              font: "400 10.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              lineHeight: 1.45,
            }}
          >
            {notes.length > 200 ? `${notes.slice(0, 197)}…` : notes}
          </p>
        </div>
      )}
    </article>
  );
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: "600 8.5px var(--font-inter)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--pw-text-muted)",
        marginBottom: 2,
      }}
    >
      {children}
    </div>
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
    <>
      <dt
        style={{
          font: "600 9.5px var(--font-inter)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--pw-text-muted)",
          paddingTop: 1,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          font: "400 11.5px var(--font-inter)",
          color: "var(--pw-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </dd>
    </>
  );
}
