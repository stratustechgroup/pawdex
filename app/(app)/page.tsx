import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PawdexPetCard } from "@/components/pawdex/pet-card";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { firstNameFrom } from "@/lib/auth/profile";
import { listPetsForHousehold, type PetWithStatus } from "@/lib/db/pets";
import { listExpiringForHousehold } from "@/lib/db/expiring";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Pawdex" };

type ReminderItemView = {
  id: string;
  petName: string;
  petId: string;
  title: string;
  due: Date;
  daysUntil: number;
};

export default async function DashboardPage() {
  const session = await requireSession();
  const pets = await listPetsForHousehold(session.householdId);

  const supabase = await createClient();

  // Sign URLs for pet photos in one batch
  const photoMap = new Map<string, string>();
  const photoPaths = pets
    .filter((p) => p.photo_storage_path)
    .map((p) => ({ id: p.id, path: p.photo_storage_path! }));
  if (photoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrls(
        photoPaths.map((p) => p.path),
        60 * 60,
      );
    if (data) {
      for (let i = 0; i < data.length; i++) {
        const signed = data[i];
        if (signed.signedUrl) photoMap.set(photoPaths[i].id, signed.signedUrl);
      }
    }
  }

  // Upcoming reminders. Reuse the same aggregation that powers /expiring so
  // the rail can never diverge from the radar. That helper dedups vaccines to
  // the latest dose per family (so a superseded, expired cert never shows as a
  // false "overdue") and includes insurance renewals, both of which the old
  // inline vaccinations-only query got wrong. Keep the "next 60 days" horizon
  // by dropping the "ok" bucket (everything > 60 days out).
  const expiringItems = await listExpiringForHousehold(session.householdId);
  const reminders: ReminderItemView[] = expiringItems
    .filter((item) => item.status !== "ok")
    .slice(0, 8)
    .map((item) => ({
      id: `${item.kind}:${item.entity_id}`,
      petName: item.pet_name ?? "Whole household",
      petId: item.pet_id ?? "",
      title: item.title,
      due: new Date(item.expires_on),
      daysUntil: item.days_until,
    }));

  // Recent documents
  const { data: docRows } = await supabase
    .from("documents")
    .select(
      "id, original_filename, doc_type, processing_status, uploaded_at, pet_id",
    )
    .eq("household_id", session.householdId)
    .order("uploaded_at", { ascending: false })
    .limit(3);
  const recentDocs = docRows ?? [];

  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "32px 24px 56px",
      }}
    >
      <Greeting session={session} pets={pets} reminders={reminders} />

      <div className="dashboard-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <SectionHead
              title="Your pets"
              sub={
                pets.length === 0
                  ? "Add your first pet to get started."
                  : `${pets.length} ${pets.length === 1 ? "pet" : "pets"} in ${session.householdName}.`
              }
              right={
                <Link
                  href="/pets/new"
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
                    font: "500 12.5px var(--font-inter)",
                    textDecoration: "none",
                  }}
                >
                  <Icon name="plus" size={13} />
                  Add pet
                </Link>
              }
            />
            {pets.length === 0 ? (
              <EmptyState />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {pets.map((pet) => (
                  <PawdexPetCard
                    key={pet.id}
                    pet={pet}
                    photoUrl={photoMap.get(pet.id) ?? null}
                  />
                ))}
                <AddPetCard />
              </div>
            )}
          </section>

          <section>
            <SectionHead
              title="Recent activity"
              sub="Documents ingested this week"
              right={
                <Link
                  href="/documents"
                  style={{
                    font: "500 12.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    textDecoration: "none",
                  }}
                >
                  View all →
                </Link>
              }
            />
            <div className="pw-card" style={{ padding: "4px 0" }}>
              {recentDocs.length === 0 ? (
                <div
                  style={{
                    padding: "20px 16px",
                    font: "400 13px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  Documents you upload or forward will appear here.
                </div>
              ) : (
                recentDocs.map((d, i) => {
                  const petName = pets.find((p) => p.id === d.pet_id)?.name;
                  return (
                    <div
                      key={d.id}
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                      }}
                    >
                      <DocThumb />
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
                          {petName ? `${petName} · ` : ""}
                          {d.original_filename ?? "Untitled document"}
                        </div>
                        <div
                          style={{
                            font: "400 12px var(--font-inter)",
                            color: "var(--pw-text-muted)",
                            marginTop: 3,
                          }}
                        >
                          {prettyDocType(d.doc_type)} ·{" "}
                          {prettyStatus(d.processing_status)}
                        </div>
                      </div>
                      <div
                        style={{
                          font: "400 12px var(--font-inter)",
                          color: "var(--pw-text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {format(new Date(d.uploaded_at), "MMM d")}
                      </div>
                      {d.processing_status === "extracted" && d.pet_id && (
                        <Link
                          href={`/pets/${d.pet_id}/documents/${d.id}/review`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 26,
                            padding: "0 10px",
                            borderRadius: 6,
                            background: "var(--pw-status-due-bg)",
                            color: "var(--pw-status-due-fg)",
                            border: "1px solid var(--pw-status-due-dot)",
                            font: "500 11.5px var(--font-inter)",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Review
                        </Link>
                      )}
                      {d.processing_status === "confirmed" && d.pet_id && (
                        <Link
                          href={`/pets/${d.pet_id}/documents/${d.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 26,
                            padding: "0 10px",
                            borderRadius: 6,
                            background: "var(--pw-surface-2)",
                            color: "var(--pw-text-secondary)",
                            border: "1px solid var(--pw-border-strong)",
                            font: "500 11.5px var(--font-inter)",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <SectionHead
              title="Reminders"
              sub="Next 60 days"
              right={
                reminders.length > 0 ? (
                  <span
                    style={{
                      font: "500 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {reminders.length}
                  </span>
                ) : undefined
              }
            />
            <div className="pw-card" style={{ padding: 4 }}>
              {reminders.length === 0 ? (
                <div
                  style={{
                    padding: "16px 12px",
                    font: "400 13px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  No upcoming reminders. We&apos;ll surface vaccines as expiration
                  approaches.
                </div>
              ) : (
                reminders.map((r, i) => (
                  <ReminderRow
                    key={r.id}
                    item={r}
                    petTintName={r.petName}
                    isFirst={i === 0}
                  />
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Greeting({
  session,
  pets,
  reminders,
}: {
  session: { email: string | null; displayName: string | null; householdName: string };
  pets: PetWithStatus[];
  reminders: ReminderItemView[];
}) {
  const overdue = reminders.filter((r) => r.daysUntil < 0).length;
  const dueSoon = reminders.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 30).length;
  const name = firstNameFrom(session.displayName, session.email);
  const greeting = pickGreeting();

  let sub = `${pets.length} ${pets.length === 1 ? "pet" : "pets"} in ${session.householdName}.`;
  if (overdue > 0) {
    sub = `${pets.length} ${pets.length === 1 ? "pet" : "pets"} · ${overdue} overdue ${overdue === 1 ? "reminder" : "reminders"} this week.`;
  } else if (dueSoon > 0) {
    sub = `${pets.length} ${pets.length === 1 ? "pet" : "pets"} · ${dueSoon} ${dueSoon === 1 ? "reminder" : "reminders"} due in the next 30 days.`;
  } else if (pets.length === 0) {
    sub = "Let's add your first pet to get started.";
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h1
        className="serif"
        style={{
          fontSize: 32,
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: "-0.015em",
          margin: 0,
          color: "var(--pw-text)",
        }}
      >
        {greeting}, {cap(name)}.
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          font: "400 14px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function pickGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Hi";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ReminderRow({
  item,
  petTintName,
  isFirst,
}: {
  item: ReminderItemView;
  petTintName: string;
  isFirst: boolean;
}) {
  const overdue = item.daysUntil < 0;
  const dueSoon = !overdue && item.daysUntil <= 30;
  const urgency: "overdue" | "due" | "soft" = overdue
    ? "overdue"
    : dueSoon
      ? "due"
      : "soft";

  const colors = (() => {
    if (urgency === "overdue")
      return {
        fg: "var(--pw-status-overdue-fg)",
        dot: "var(--pw-status-overdue-dot)",
      };
    if (urgency === "due")
      return {
        fg: "var(--pw-status-due-fg)",
        dot: "var(--pw-status-due-dot)",
      };
    return {
      fg: "var(--pw-text-muted)",
      dot: "var(--pw-text-subtle)",
    };
  })();

  const dueLabel = overdue
    ? `Overdue by ${Math.abs(item.daysUntil)} d`
    : item.daysUntil === 0
      ? "Due today"
      : `Due in ${item.daysUntil} d`;

  const monthLabel = format(item.due, "MMM").toUpperCase();
  const dayLabel = format(item.due, "d");

  return (
    <div
      style={{
        padding: "12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 10,
        borderTop: isFirst ? "none" : "1px solid var(--pw-border)",
      }}
    >
      <div style={{ width: 32, textAlign: "center", flexShrink: 0 }}>
        <div
          style={{
            font: "500 10.5px var(--font-inter)",
            color: colors.fg,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {monthLabel}
        </div>
        <div style={{ font: "600 15px var(--font-inter)", color: "var(--pw-text)" }}>
          {dayLabel}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PetPhoto name={petTintName} size={16} ring={false} />
          <span style={{ font: "500 12.5px var(--font-inter)", color: "var(--pw-text)" }}>
            {item.petName}
          </span>
          <span
            style={{
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            · {item.title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
          {urgency === "overdue" && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: colors.dot,
                animation: "pw-pulse 2.2s ease-in-out infinite",
              }}
            />
          )}
          <span style={{ font: "500 11.5px var(--font-inter)", color: colors.fg }}>
            {dueLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function DocThumb() {
  return (
    <div
      style={{
        width: 32,
        height: 40,
        borderRadius: 4,
        background: "var(--pw-surface)",
        border: "1px solid var(--pw-border-strong)",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      aria-hidden
    >
      {[14, 28, 42].map((top) => (
        <div
          key={top}
          style={{
            position: "absolute",
            inset: `${top}% 16% auto 16%`,
            height: 1.5,
            background: top === 14 ? "var(--pw-border-strong)" : "var(--pw-border)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 3,
          left: 3,
          padding: "1px 4px",
          borderRadius: 2,
          background: "#B23A3A",
          color: "#fff",
          font: "700 7px var(--font-jetbrains)",
          letterSpacing: 0.5,
        }}
      >
        PDF
      </div>
    </div>
  );
}

function AddPetCard() {
  return (
    <Link
      href="/pets/new"
      className="pw-card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 8,
        border: "1px dashed var(--pw-border-strong)",
        background: "transparent",
        textDecoration: "none",
        color: "var(--pw-text-secondary)",
        minHeight: 130,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--pw-surface-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--pw-text)",
        }}
      >
        <Icon name="plus" size={16} />
      </span>
      <span style={{ font: "500 13px var(--font-inter)", color: "var(--pw-text)" }}>
        Add another pet
      </span>
      <span style={{ font: "400 12px var(--font-inter)", color: "var(--pw-text-muted)" }}>
        Or forward records to your household inbox
      </span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      className="pw-card"
      style={{
        padding: 40,
        textAlign: "center",
        borderStyle: "dashed",
        background: "transparent",
      }}
    >
      <h2 style={{ font: "500 16px var(--font-inter)", margin: 0, color: "var(--pw-text)" }}>
        No pets yet
      </h2>
      <p
        style={{
          margin: "8px 0 16px",
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        Add your first pet to start tracking vaccines, medications, and visits.
      </p>
      <Link
        href="/pets/new"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 36,
          padding: "0 14px",
          borderRadius: 6,
          background: "var(--pw-accent)",
          color: "#fff",
          font: "500 13px var(--font-inter)",
          textDecoration: "none",
        }}
      >
        <Icon name="plus" size={13} />
        Add your first pet
      </Link>
    </div>
  );
}

function prettyDocType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyStatus(s: string) {
  switch (s) {
    case "pending":
      return "Awaiting processing";
    case "extracting":
      return "Extracting";
    case "extracted":
      return "Needs review";
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    default:
      return s;
  }
}
