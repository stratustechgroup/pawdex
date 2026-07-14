"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SectionHead } from "@/components/pawdex/chips";
import { Button } from "@/components/ui/button";
import type { DeletedHousehold, DeletedPet } from "@/lib/deletion/recently-deleted";
import { restorePetAction } from "@/app/(app)/pets/[petId]/delete-actions";
import { restoreHouseholdAction } from "@/app/(app)/settings/household/actions";

/**
 * "Recently deleted" restore list. Shows soft-deleted pets (active household)
 * and/or households (owned) with days remaining before permanent purge, each
 * with a Restore button. Renders nothing when both lists are empty so it stays
 * out of the way until there is something to restore.
 */
export function RecentlyDeleted({
  pets = [],
  households = [],
}: {
  pets?: DeletedPet[];
  households?: DeletedHousehold[];
}) {
  if (pets.length === 0 && households.length === 0) return null;

  return (
    <section className="pw-card" style={{ padding: 20 }}>
      <SectionHead
        title="Recently deleted"
        sub="Restore within 30 days of deletion. After that, items are permanently purged."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {households.map((h) => (
          <RestoreRow
            key={`hh-${h.id}`}
            name={h.name}
            kind="Household"
            daysRemaining={h.daysRemaining}
            onRestore={() => restoreHouseholdAction(h.id)}
          />
        ))}
        {pets.map((p) => (
          <RestoreRow
            key={`pet-${p.id}`}
            name={p.name}
            kind="Pet"
            daysRemaining={p.daysRemaining}
            onRestore={() => restorePetAction(p.id)}
          />
        ))}
      </div>
    </section>
  );
}

function RestoreRow({
  name,
  kind,
  daysRemaining,
  onRestore,
}: {
  name: string;
  kind: string;
  daysRemaining: number;
  onRestore: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function restore() {
    startTransition(async () => {
      const r = await onRestore();
      if (r.ok) {
        toast.success(`${name} restored.`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        border: "1px solid var(--pw-border)",
        borderRadius: 8,
        background: "var(--pw-surface)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "500 13px var(--font-inter)", color: "var(--pw-text)" }}>
          {name}
        </div>
        <div style={{ font: "400 11.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
          {kind} · {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left to restore
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={restore}
        disabled={isPending}
        style={{ flexShrink: 0 }}
      >
        {isPending ? "Restoring…" : "Restore"}
      </Button>
    </div>
  );
}
