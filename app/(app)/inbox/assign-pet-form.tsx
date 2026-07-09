"use client";

import { useState } from "react";

import { Icon } from "@/components/brand/icon";

import { assignDocumentToPet } from "./actions";

export function AssignPetForm({
  documentId,
  pets,
}: {
  documentId: string;
  pets: { id: string; name: string }[];
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        try {
          await assignDocumentToPet(fd);
        } finally {
          setPending(false);
        }
      }}
      style={{ display: "flex", gap: 8, alignItems: "center" }}
    >
      <input type="hidden" name="document_id" value={documentId} />
      <select
        name="pet_id"
        required
        defaultValue=""
        style={{
          flex: 1,
          height: 32,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "400 13px var(--font-inter)",
        }}
      >
        <option value="" disabled>
          Assign to pet…
        </option>
        {pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 32,
          padding: "0 12px",
          borderRadius: 6,
          border: "1px solid var(--pw-accent)",
          background: "var(--pw-accent)",
          color: "var(--pw-accent-fg)",
          font: "500 12.5px var(--font-inter)",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        <Icon name="arrowRight" size={12} />
        {pending ? "Assigning…" : "Assign"}
      </button>
    </form>
  );
}
