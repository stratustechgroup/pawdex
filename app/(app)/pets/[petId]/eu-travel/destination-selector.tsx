"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Icon } from "@/components/brand/icon";
import type { Destination } from "@/lib/compliance/eu-passport";

export function DestinationSelector({
  petId,
  destinations,
  currentTo,
  currentDate,
}: {
  petId: string;
  destinations: Destination[];
  currentTo: string;
  currentDate: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [to, setTo] = useState(currentTo);
  const [date, setDate] = useState(currentDate ?? "");

  function apply(nextTo: string, nextDate: string) {
    const qs = new URLSearchParams();
    qs.set("to", nextTo);
    if (nextDate) qs.set("date", nextDate);
    startTransition(() => {
      router.push(`/pets/${petId}/eu-travel?${qs.toString()}`);
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "1fr 1fr auto",
        alignItems: "end",
        padding: 14,
        borderRadius: 10,
        background: "var(--pw-surface-muted)",
        border: "1px solid var(--pw-border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label>Destination</Label>
        <select
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            apply(e.target.value, date);
          }}
          style={inputStyle}
        >
          {destinations.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
              {d.requires_tapeworm ? " · 🪱 tapeworm" : ""}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label>Travel date (optional)</Label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            apply(to, e.target.value);
          }}
          style={inputStyle}
        />
      </div>
      <div style={{ paddingBottom: 1 }}>
        {pending ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: "500 11.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            <Icon name="refresh" size={11} />
            Recomputing…
          </span>
        ) : (
          <span
            style={{
              font: "400 10.5px var(--font-inter)",
              color: "var(--pw-text-subtle)",
              maxWidth: 180,
              display: "inline-block",
              lineHeight: 1.4,
            }}
          >
            Re-runs compliance against the destination you pick.
          </span>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};
