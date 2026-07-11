import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { SectionHead } from "@/components/pawdex/chips";
import { ActionStrip } from "@/components/pawdex/cockpit/action-strip";
import { ActivityFeed } from "@/components/pawdex/cockpit/activity-feed";
import { InsightCards } from "@/components/pawdex/cockpit/insight-card";
import { PetTile } from "@/components/pawdex/cockpit/pet-tile";
import { QuickAdd } from "@/components/pawdex/cockpit/quick-add";
import { requireSession } from "@/lib/auth/household";
import { firstNameFrom } from "@/lib/auth/profile";
import {
  cleanTitle,
  listActionItems,
  listPetLitterLabels,
  listPetVitals,
  type NavPet,
  type PetVitals,
} from "@/lib/db/cockpit";
import { listRecentActivity } from "@/lib/db/activity";
import { listInsightsForHousehold } from "@/lib/db/insights";
import { listExpiringForHousehold } from "@/lib/db/expiring";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Pawdex" };

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
  const isBreeder = session.householdKind === "breeder";

  const [vitals, actionItems, activity, insights, expiringItems, litterLabels] =
    await Promise.all([
      listPetVitals(session.householdId),
      listActionItems(session.householdId),
      listRecentActivity(session.householdId),
      listInsightsForHousehold(session.householdId),
      listExpiringForHousehold(session.householdId),
      isBreeder
        ? listPetLitterLabels(session.householdId)
        : Promise.resolve(new Map<string, string>()),
    ]);

  const supabase = await createClient();

  // Sign URLs for pet photos in one batch.
  const photoMap = new Map<string, string>();
  const photoPaths = vitals
    .filter((v) => v.pet.photo_storage_path)
    .map((v) => ({ id: v.pet.id, path: v.pet.photo_storage_path! }));
  if (photoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrls(
        photoPaths.map((p) => p.path),
        60 * 60,
      );
    if (data) {
      for (let i = 0; i < data.length; i++) {
        const signed = data[i].signedUrl;
        if (signed) photoMap.set(photoPaths[i].id, signed);
      }
    }
  }

  const reminders: ReminderItemView[] = expiringItems
    .filter((item) => item.status !== "ok")
    .slice(0, 8)
    .map((item) => ({
      id: `${item.kind}:${item.entity_id}`,
      petName: item.pet_name ?? "Whole household",
      petId: item.pet_id ?? "",
      title: cleanTitle(item.title),
      due: new Date(item.expires_on),
      daysUntil: item.days_until,
    }));

  const navPets: NavPet[] = vitals.map((v) => ({
    id: v.pet.id,
    name: v.pet.name,
    species: v.pet.species,
  }));

  const overdueCount = actionItems.filter((a) => a.severity === "overdue").length;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 24px 56px" }}>
      <Greeting
        session={session}
        petCount={vitals.length}
        overdueCount={overdueCount}
        actionCount={actionItems.length}
        navPets={navPets}
      />

      <ActionStrip items={actionItems} />

      <section style={{ marginBottom: 28 }}>
        <SectionHead
          title="Your pets"
          sub={
            vitals.length === 0
              ? "Add your first pet to get started."
              : `${vitals.length} ${vitals.length === 1 ? "pet" : "pets"} in ${session.householdName}.`
          }
          right={
            <Link href="/pets/new" className="pw-ghost-btn">
              <Icon name="plus" size={13} />
              Add pet
            </Link>
          }
        />
        {vitals.length === 0 ? (
          <EmptyState />
        ) : (
          <PetTileGrid
            vitals={vitals}
            photoMap={photoMap}
            litterLabels={litterLabels}
          />
        )}
      </section>

      <div className="dashboard-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {insights.length > 0 && (
            <section>
              <SectionHead
                title="Worth a look"
                sub="Derived from your records, cited to the source."
              />
              <InsightCards insights={insights} />
            </section>
          )}

          <section>
            <SectionHead
              title="Recent activity"
              sub="Everything happening across the household"
              right={
                <Link href="/documents" className="pw-viewall">
                  View all
                  <Icon name="arrowRight" size={12} />
                </Link>
              }
            />
            <ActivityFeed items={activity} />
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <SectionHead
              title="Upcoming"
              sub="Next 60 days"
              right={
                reminders.length > 0 ? (
                  <Link href="/expiring" className="pw-viewall">
                    Radar
                    <Icon name="arrowRight" size={12} />
                  </Link>
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
                  Nothing on the horizon. We&apos;ll surface vaccines and renewals
                  as they approach.
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

function PetTileGrid({
  vitals,
  photoMap,
  litterLabels,
}: {
  vitals: PetVitals[];
  photoMap: Map<string, string>;
  litterLabels: Map<string, string>;
}) {
  const grouped = litterLabels.size > 0;

  if (!grouped) {
    return (
      <div className="pw-tile-grid">
        {vitals.map((v) => (
          <PetTile key={v.pet.id} vitals={v} photoUrl={photoMap.get(v.pet.id) ?? null} />
        ))}
      </div>
    );
  }

  // Breeder view: group tiles under their litter, ungrouped pets last.
  const byLitter = new Map<string, PetVitals[]>();
  const ungrouped: PetVitals[] = [];
  for (const v of vitals) {
    const litter = litterLabels.get(v.pet.id);
    if (litter) {
      const arr = byLitter.get(litter) ?? [];
      arr.push(v);
      byLitter.set(litter, arr);
    } else {
      ungrouped.push(v);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {Array.from(byLitter.entries()).map(([litter, members]) => (
        <div key={litter}>
          <div className="pw-litter-head">
            <Icon name="paw" size={13} style={{ color: "var(--pw-accent)" }} />
            {litter}
            <span style={{ color: "var(--pw-text-subtle)" }}>
              · {members.length}
            </span>
          </div>
          <div className="pw-tile-grid">
            {members.map((v) => (
              <PetTile key={v.pet.id} vitals={v} photoUrl={photoMap.get(v.pet.id) ?? null} />
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div>
          <div className="pw-litter-head">
            <Icon name="paw" size={13} style={{ color: "var(--pw-text-muted)" }} />
            Other pets
          </div>
          <div className="pw-tile-grid">
            {ungrouped.map((v) => (
              <PetTile key={v.pet.id} vitals={v} photoUrl={photoMap.get(v.pet.id) ?? null} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Greeting({
  session,
  petCount,
  overdueCount,
  actionCount,
  navPets,
}: {
  session: { email: string | null; displayName: string | null; householdName: string };
  petCount: number;
  overdueCount: number;
  actionCount: number;
  navPets: NavPet[];
}) {
  const name = firstNameFrom(session.displayName, session.email);
  const greeting = pickGreeting();

  let sub = `${petCount} ${petCount === 1 ? "pet" : "pets"} in ${session.householdName}.`;
  if (overdueCount > 0) {
    sub = `${overdueCount} overdue ${overdueCount === 1 ? "item needs" : "items need"} your attention.`;
  } else if (actionCount > 0) {
    sub = `${actionCount} ${actionCount === 1 ? "thing" : "things"} to look at across ${petCount} ${petCount === 1 ? "pet" : "pets"}.`;
  } else if (petCount === 0) {
    sub = "Let's add your first pet to get started.";
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 28,
      }}
    >
      <div>
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
      <QuickAdd pets={navPets} />
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
      return { fg: "var(--pw-status-due-fg)", dot: "var(--pw-status-due-dot)" };
    return { fg: "var(--pw-text-muted)", dot: "var(--pw-text-subtle)" };
  })();

  const dueLabel = overdue
    ? `Overdue by ${Math.abs(item.daysUntil)} d`
    : item.daysUntil === 0
      ? "Due today"
      : `Due in ${item.daysUntil} d`;

  const monthLabel = format(item.due, "MMM").toUpperCase();
  const dayLabel = format(item.due, "d");

  const row = (
    <>
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
    </>
  );

  const commonStyle: React.CSSProperties = {
    padding: "12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderTop: isFirst ? "none" : "1px solid var(--pw-border)",
    textDecoration: "none",
  };

  return item.petId ? (
    <Link href={`/pets/${item.petId}`} style={commonStyle} className="pw-reminder-row">
      {row}
    </Link>
  ) : (
    <Link href="/expiring" style={commonStyle} className="pw-reminder-row">
      {row}
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
        className="pw-accent-fill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 36,
          padding: "0 14px",
          borderRadius: 6,
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
