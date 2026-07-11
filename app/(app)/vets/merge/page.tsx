import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { findDuplicateGroups } from "@/lib/db/vet-clinic-duplicates";

import { MergeGroup } from "./merge-group";

export const metadata = { title: "Merge clinics · Pawdex" };
export const dynamic = "force-dynamic";

export default async function MergeClinicsPage() {
  const session = await requireSession();
  const groups = await findDuplicateGroups(session.householdId);

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        <Link href="/vets" style={{ color: "inherit", textDecoration: "none" }}>
          Vets &amp; clinics
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>Merge duplicates</span>
      </div>

      <SectionHead
        title="Merge duplicate clinics"
        sub={
          groups.length === 0
            ? "No duplicates detected — your vets directory is clean."
            : `Found ${groups.length} ${groups.length === 1 ? "group" : "groups"} of likely duplicates. Pick the keeper, merge into it.`
        }
      />

      {groups.length === 0 ? (
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
          Pawdex looks for shared phone numbers and fuzzy name matches across
          your clinics. When two clinics look like the same place, they show up
          here so you can collapse them into one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((g) => (
            <MergeGroup
              key={g.key}
              groupKey={g.key}
              reason={g.reason}
              clinics={g.clinics}
            />
          ))}
        </div>
      )}

      {session.role !== "owner" && (
        <div
          style={{
            padding: 12,
            background: "var(--pw-info-bg)",
            color: "var(--pw-info-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
          }}
        >
          Only the household owner can merge clinics.
        </div>
      )}
    </div>
  );
}
