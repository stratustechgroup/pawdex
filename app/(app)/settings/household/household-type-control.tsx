"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import type { HouseholdKind } from "@/lib/auth/active-household";

import { setHouseholdKindAction } from "./actions";

const COPY: Record<
  HouseholdKind,
  { label: string; blurb: string; other: HouseholdKind; cta: string }
> = {
  personal: {
    label: "Personal",
    blurb:
      "A personal household for your own pets, records, and reminders.",
    other: "breeder",
    cta: "Switch to Breeder",
  },
  breeder: {
    label: "Breeder",
    blurb:
      "A breeding operation. Unlocks litters, placement, and transfer tools in the nav. Switching back to Personal only hides those tools; it never deletes breeder data.",
    other: "personal",
    cta: "Switch to Personal",
  },
};

/**
 * Owner-only control to flip the active household between personal and breeder.
 * On success it refreshes so the nav's breeder-only surfaces appear or hide.
 */
export function HouseholdTypeControl({ kind }: { kind: HouseholdKind }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const copy = COPY[kind];

  function flip() {
    startTransition(async () => {
      const r = await setHouseholdKindAction(copy.other);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Household is now ${COPY[copy.other].label}.`);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginTop: 16,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flex: "1 1 240px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent-fg-on-soft)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={kind === "breeder" ? "paw" : "home"} size={16} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              font: "600 13.5px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            {copy.label}
          </span>
          <span
            style={{
              display: "block",
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {copy.blurb}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={flip}
        disabled={isPending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 34,
          padding: "0 14px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "500 12.5px var(--font-inter)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <Icon name="refresh" size={13} />
        {isPending ? "Switching…" : copy.cta}
      </button>
    </div>
  );
}
