"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { createLitterAction } from "./actions";

type AnimalOption = { id: string; name: string };

const fieldLabel: React.CSSProperties = {
  font: "500 12px var(--font-inter)",
  color: "var(--pw-text-muted)",
  marginBottom: 5,
  display: "block",
};

const fieldBox: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 11px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13.5px var(--font-inter)",
  outline: "none",
};

export function CreateLitterForm({ animals }: { animals: AnimalOption[] }) {
  const [name, setName] = useState("");
  const [damId, setDamId] = useState("");
  const [sireId, setSireId] = useState("");
  const [whelpedOn, setWhelpedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const noAnimals = animals.length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Litter name is required.");
      return;
    }
    if (!damId) {
      toast.error("Pick a dam for the litter.");
      return;
    }
    startTransition(async () => {
      const r = await createLitterAction({
        name: name.trim(),
        damAnimalId: damId,
        sireAnimalId: sireId || null,
        whelpedOn: whelpedOn || null,
        notes: notes.trim() || null,
      });
      // Redirects on success; a returned value means an error.
      if (r && !r.ok) toast.error(r.error);
    });
  }

  if (noAnimals) {
    return (
      <p
        style={{
          margin: 0,
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        Add at least one animal to your household first — you&apos;ll pick the dam
        from your animals when creating a litter.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label htmlFor="litter-name" style={fieldLabel}>
          Litter name
        </label>
        <input
          id="litter-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Spring 2026 litter"
          required
          disabled={isPending}
          style={fieldBox}
        />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="litter-dam" style={fieldLabel}>
            Dam
          </label>
          <select
            id="litter-dam"
            value={damId}
            onChange={(e) => setDamId(e.target.value)}
            required
            disabled={isPending}
            style={fieldBox}
          >
            <option value="">Select dam…</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="litter-sire" style={fieldLabel}>
            Sire (optional)
          </label>
          <select
            id="litter-sire"
            value={sireId}
            onChange={(e) => setSireId(e.target.value)}
            disabled={isPending}
            style={fieldBox}
          >
            <option value="">None / external</option>
            {animals
              .filter((a) => a.id !== damId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 220 }}>
        <label htmlFor="litter-whelped" style={fieldLabel}>
          Whelped on (optional)
        </label>
        <input
          id="litter-whelped"
          type="date"
          value={whelpedOn}
          onChange={(e) => setWhelpedOn(e.target.value)}
          disabled={isPending}
          style={fieldBox}
        />
      </div>

      <div>
        <label htmlFor="litter-notes" style={fieldLabel}>
          Notes (optional)
        </label>
        <textarea
          id="litter-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          rows={2}
          style={{ ...fieldBox, height: "auto", padding: "8px 11px", resize: "vertical" }}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 38,
            padding: "0 18px",
            borderRadius: 6,
            background: "var(--pw-accent)",
            border: "1px solid var(--pw-accent)",
            color: "#fff",
            font: "500 13px var(--font-inter)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Creating…" : "Create litter"}
          <Icon name="plus" size={14} />
        </button>
      </div>
    </form>
  );
}
