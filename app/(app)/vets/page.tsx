import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listVetClinics } from "@/lib/db/vet-clinics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vets — Pawdex" };

export default async function VetsPage() {
  const session = await requireSession();
  const clinics = await listVetClinics(session.householdId);

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 24px 56px",
      }}
    >
      <SectionHead
        title="Vets & clinics"
        sub={
          clinics.length === 0
            ? "Clinics get added automatically as Pawdex extracts them from your documents."
            : `${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"} on file — sorted by most recent activity.`
        }
        right={
          clinics.length >= 2 ? (
            <Link
              href="/vets/merge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 30,
                padding: "0 10px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "500 12px var(--font-inter)",
                textDecoration: "none",
              }}
            >
              <Icon name="copy" size={12} />
              Merge duplicates
            </Link>
          ) : undefined
        }
      />

      {clinics.length === 0 ? (
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
          No vet clinics on file yet. Upload a document and Pawdex will capture
          the clinic&apos;s contact info from the letterhead.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {clinics.map((c) => (
            <Link
              key={c.id}
              href={`/vets/${c.id}`}
              className="pw-card"
              style={{
                padding: 18,
                textDecoration: "none",
                color: "inherit",
                display: "block",
                transition: "border-color 0.12s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "var(--pw-accent-soft)",
                    color: "var(--pw-accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="stethoscope" size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 14px var(--font-inter)",
                      color: "var(--pw-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </div>
                  {c.last_seen_at && (
                    <div
                      style={{
                        font: "400 11.5px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      Last seen {format(new Date(c.last_seen_at), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </div>

              {(c.phone || c.email || c.address_line1) && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--pw-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    font: "400 12.5px var(--font-inter)",
                    color: "var(--pw-text-secondary)",
                  }}
                >
                  {c.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name="bell" size={11} style={{ color: "var(--pw-text-muted)" }} />
                      <span className="mono">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name="mail" size={11} style={{ color: "var(--pw-text-muted)" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                        {c.email}
                      </span>
                    </div>
                  )}
                  {c.address_line1 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <Icon
                        name="home"
                        size={11}
                        style={{ color: "var(--pw-text-muted)", marginTop: 2 }}
                      />
                      <span>{c.address_line1}</span>
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--pw-border)",
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                  font: "500 11px var(--font-inter)",
                }}
              >
                <Stat label="Docs" value={c.document_count} />
                <Stat label="Pets" value={c.pet_count} />
                <Stat label="Vaccines" value={c.vaccination_count} />
                <Stat label="Visits" value={c.medical_event_count} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="tnum" style={{ font: "600 15px var(--font-inter)", color: "var(--pw-text)" }}>
        {value}
      </span>
      <span style={{ font: "500 10.5px var(--font-inter)", color: "var(--pw-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}
