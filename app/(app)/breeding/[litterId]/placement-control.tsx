"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Database } from "@/lib/supabase/types";

import { setPuppyPlacementAction } from "../actions";

type PlacementStatus = Database["public"]["Enums"]["animal_placement_status"];

const OPTIONS: { value: PlacementStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "placed", label: "Placed" },
  { value: "none", label: "Not listed" },
];

export function PlacementControl({
  litterId,
  animalId,
  status,
  disabled,
}: {
  litterId: string;
  animalId: string;
  status: PlacementStatus;
  disabled: boolean;
}) {
  const [value, setValue] = useState<PlacementStatus>(status);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: PlacementStatus) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const r = await setPuppyPlacementAction({ litterId, animalId, status: next });
      if (!r.ok) {
        setValue(prev);
        toast.error(r.error);
      }
    });
  }

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="sr-only">Placement status</span>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value as PlacementStatus)}
        disabled={disabled || isPending}
        aria-label="Placement status"
        style={{
          height: 32,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: value === "placed" ? "var(--pw-accent-soft)" : "var(--pw-surface)",
          color: value === "placed" ? "var(--pw-accent-fg-on-soft)" : "var(--pw-text)",
          font: "500 12px var(--font-inter)",
          cursor: disabled ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
