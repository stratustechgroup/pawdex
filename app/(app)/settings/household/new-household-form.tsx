"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import type { HouseholdKind } from "@/lib/auth/active-household";

import { createHouseholdAction } from "./actions";

/**
 * Creates an additional household. On success the server action switches the
 * active household and redirects to the dashboard, so this form never sees a
 * success return: only errors come back to surface as a toast.
 */
export function NewHouseholdForm({
  defaultKind = "personal",
}: {
  defaultKind?: HouseholdKind;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HouseholdKind>(defaultKind);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        startTransition(async () => {
          const r = await createHouseholdAction(name.trim(), kind);
          // Success redirects; a returned value only ever carries an error.
          if (r && !r.ok) toast.error(r.error);
        });
      }}
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "1fr auto auto",
        alignItems: "end",
        marginTop: 16,
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Household name
        </span>
        <input
          type="text"
          required
          maxLength={60}
          placeholder="Weekend Kennel"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            height: 36,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
            outline: "none",
          }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Type
        </span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as HouseholdKind)}
          style={{
            height: 36,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
          }}
        >
          <option value="personal">Personal</option>
          <option value="breeder">Breeder</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 36,
          padding: "0 16px",
          borderRadius: 6,
          background: "var(--pw-accent)",
          border: "1px solid var(--pw-accent)",
          color: "#fff",
          font: "500 13px var(--font-inter)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending || !name.trim() ? 0.6 : 1,
        }}
      >
        <Icon name="plus" size={13} />
        {isPending ? "Creating…" : "Create household"}
      </button>
    </form>
  );
}
