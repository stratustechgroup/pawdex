import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getVetClinic } from "@/lib/db/vet-clinics";

import { VetClinicEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function VetClinicDetail({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const session = await requireSession();
  const clinic = await getVetClinic(session.householdId, clinicId);
  if (!clinic) notFound();

  const supabase = await createClient();
  const [vaccRes, eventsRes, medsRes] = await Promise.all([
    supabase
      .from("vaccinations")
      .select("id, vaccine_type, administered_on, expires_on, pet_id, pets(name)")
      .eq("household_id", session.householdId)
      .eq("vet_clinic_id", clinicId)
      .order("administered_on", { ascending: false })
      .limit(50),
    supabase
      .from("medical_events")
      .select("id, event_type, title, occurred_on, pet_id, pets(name)")
      .eq("household_id", session.householdId)
      .eq("vet_clinic_id", clinicId)
      .order("occurred_on", { ascending: false })
      .limit(50),
    supabase
      .from("medications")
      .select("id, name, dose, started_on, ended_on, pet_id, pets(name)")
      .eq("household_id", session.householdId)
      .eq("vet_clinic_id", clinicId)
      .order("started_on", { ascending: false })
      .limit(50),
  ]);

  const vaccines = (vaccRes.data ?? []) as unknown as Array<{
    id: string;
    vaccine_type: string;
    administered_on: string;
    expires_on: string | null;
    pet_id: string;
    pets: { name: string } | null;
  }>;
  const events = (eventsRes.data ?? []) as unknown as Array<{
    id: string;
    event_type: string;
    title: string;
    occurred_on: string;
    pet_id: string;
    pets: { name: string } | null;
  }>;
  const meds = (medsRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    dose: string;
    started_on: string;
    ended_on: string | null;
    pet_id: string;
    pets: { name: string } | null;
  }>;

  const addressFull = [
    clinic.address_line1,
    clinic.address_line2,
    [clinic.city, clinic.region].filter(Boolean).join(", "),
    clinic.postal_code,
    clinic.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 56px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          marginBottom: 8,
        }}
      >
        <Link href="/vets" style={{ color: "inherit", textDecoration: "none" }}>
          Vets &amp; clinics
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>{clinic.name}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="stethoscope" size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            className="serif"
            style={{
              margin: 0,
              font: "500 26px var(--font-source-serif)",
              letterSpacing: "-0.02em",
              color: "var(--pw-text)",
            }}
          >
            {clinic.name}
          </h1>
          {clinic.last_seen_at && (
            <p
              style={{
                margin: "4px 0 0",
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              Last seen{" "}
              {format(new Date(clinic.last_seen_at), "MMM d, yyyy")}
              {clinic.verified_at && (
                <>
                  {" "}· verified {clinic.verified_source ?? ""}{" "}
                  {format(new Date(clinic.verified_at), "MMM d, yyyy")}
                </>
              )}
            </p>
          )}
        </div>
        <VetClinicEditForm
          initial={{
            id: clinic.id,
            name: clinic.name,
            phone: clinic.phone,
            email: clinic.email,
            address_line1: clinic.address_line1,
            website: clinic.website,
            notes: clinic.notes,
          }}
          canDelete={session.role === "owner"}
          searchUrl={`https://www.google.com/search?q=${encodeURIComponent(
            [clinic.name, clinic.city, clinic.region].filter(Boolean).join(" "),
          )}+veterinarian`}
        />
      </div>

      {(clinic.phone || clinic.email || addressFull || clinic.website) && (
        <div
          className="pw-card"
          style={{
            marginTop: 18,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {clinic.phone && <Field label="Phone" value={clinic.phone} mono />}
          {clinic.email && <Field label="Email" value={clinic.email} />}
          {addressFull && <Field label="Address" value={addressFull} />}
          {clinic.website && <Field label="Website" value={clinic.website} />}
        </div>
      )}

      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        <ListCard
          title="Vaccinations"
          empty="No vaccines linked to this clinic."
          items={vaccines.map((v) => ({
            id: v.id,
            primary: v.vaccine_type,
            secondary: v.pets?.name ?? "Unknown pet",
            date: v.administered_on,
            href: v.pet_id
              ? `/pets/${v.pet_id}/vaccines`
              : undefined,
          }))}
        />
        <ListCard
          title="Visits & events"
          empty="No medical events linked to this clinic."
          items={events.map((e) => ({
            id: e.id,
            primary: e.title,
            secondary: `${e.event_type.replace(/_/g, " ")} · ${e.pets?.name ?? "Unknown pet"}`,
            date: e.occurred_on,
            href: e.pet_id ? `/pets/${e.pet_id}/medical` : undefined,
          }))}
        />
        <ListCard
          title="Medications prescribed"
          empty="No medications linked to this clinic."
          items={meds.map((m) => ({
            id: m.id,
            primary: `${m.name} · ${m.dose}`,
            secondary: m.pets?.name ?? "Unknown pet",
            date: m.started_on,
            href: m.pet_id ? `/pets/${m.pet_id}/medications` : undefined,
          }))}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "mono" : undefined}
        style={{
          font: mono
            ? "500 13px var(--font-jetbrains)"
            : "400 13px var(--font-inter)",
          color: "var(--pw-text)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ListCard({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    date: string;
    href?: string;
  }>;
}) {
  return (
    <section className="pw-card" style={{ padding: 14 }}>
      <h2
        style={{
          margin: "0 0 10px",
          font: "600 13px var(--font-inter)",
          color: "var(--pw-text)",
        }}
      >
        {title}{" "}
        <span style={{ color: "var(--pw-text-muted)", fontWeight: 400 }}>
          · {items.length}
        </span>
      </h2>
      {items.length === 0 ? (
        <p
          style={{
            margin: 0,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {empty}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {items.slice(0, 8).map((it) => {
            const inner = (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--pw-surface-2)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "500 13px var(--font-inter)",
                      color: "var(--pw-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.primary}
                  </div>
                  <div
                    style={{
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {it.secondary}
                  </div>
                </div>
                <span
                  className="tnum"
                  style={{
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {format(new Date(it.date), "MMM d, yyyy")}
                </span>
              </div>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link
                    href={it.href}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 8 && (
        <p
          style={{
            margin: "8px 0 0",
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Showing 8 of {items.length}. Visit the pet&apos;s page for the full list.
        </p>
      )}
    </section>
  );
}
