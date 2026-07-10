"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import type { Database } from "@/lib/supabase/types";

import { addPuppyAction } from "../actions";

type PetSpecies = Database["public"]["Enums"]["pet_species"];
type PetSex = Database["public"]["Enums"]["pet_sex"];

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

export function AddPuppyForm({
  litterId,
  defaultSpecies,
  defaultBreed,
}: {
  litterId: string;
  defaultSpecies: PetSpecies;
  defaultBreed: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<PetSpecies>(defaultSpecies);
  const [sex, setSex] = useState<PetSex>("unknown");
  const [breed, setBreed] = useState(defaultBreed ?? "");
  const [dob, setDob] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Puppy name is required.");
      return;
    }
    startTransition(async () => {
      const r = await addPuppyAction({
        litterId,
        name: name.trim(),
        species,
        sex,
        breed: breed.trim() || null,
        dateOfBirth: dob || null,
      });
      if (r.ok) {
        toast.success(`Added ${name.trim()}`);
        setName("");
        setSex("unknown");
        setDob("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 220px" }}>
          <label htmlFor="puppy-name" style={fieldLabel}>
            Name
          </label>
          <input
            id="puppy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Green collar"
            required
            disabled={isPending}
            style={fieldBox}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label htmlFor="puppy-sex" style={fieldLabel}>
            Sex
          </label>
          <select
            id="puppy-sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as PetSex)}
            disabled={isPending}
            style={fieldBox}
          >
            <option value="unknown">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 120px" }}>
          <label htmlFor="puppy-species" style={fieldLabel}>
            Species
          </label>
          <select
            id="puppy-species"
            value={species}
            onChange={(e) => setSpecies(e.target.value as PetSpecies)}
            disabled={isPending}
            style={fieldBox}
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ flex: "2 1 200px" }}>
          <label htmlFor="puppy-breed" style={fieldLabel}>
            Breed (optional)
          </label>
          <input
            id="puppy-breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            disabled={isPending}
            style={fieldBox}
          />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label htmlFor="puppy-dob" style={fieldLabel}>
            Date of birth (optional)
          </label>
          <input
            id="puppy-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            disabled={isPending}
            style={fieldBox}
          />
        </div>
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
          {isPending ? "Adding…" : "Add puppy"}
          <Icon name="plus" size={14} />
        </button>
      </div>
    </form>
  );
}
