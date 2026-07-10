"use client";

import { useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { BreedCombobox } from "@/components/pawdex/breed-combobox";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { createClient } from "@/lib/supabase/browser";
import { createOnboardingPet } from "@/app/onboarding/actions";
import { setPetPhoto } from "@/app/(app)/pets/[petId]/edit/actions";
import { petFormToPayload, type PetFormValues } from "@/lib/schemas/pet";
import type { PlanSpecies } from "@/lib/clinical/first-year";

import {
  GhostButton,
  PrimaryButton,
  StepHeader,
  TextField,
  fieldLabelStyle,
  inputStyle,
} from "./ui";

export type CreatedPet = {
  id: string;
  name: string;
  species: PlanSpecies;
  birthDate: string | null;
  dobEstimated: boolean;
};

export function PetStep({
  householdId,
  onDone,
  onBack,
}: {
  householdId: string;
  onDone: (pet: CreatedPet) => void;
  onBack: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<PlanSpecies>("dog");
  const [breed, setBreed] = useState("");
  const [dob, setDob] = useState("");
  const [dobEstimated, setDobEstimated] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const canContinue = name.trim().length > 0 && !compressing;

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image.");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 512,
        useWebWorker: true,
        initialQuality: 0.85,
        fileType: "image/jpeg",
      });
      setPhotoFile(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error("Couldn't process that image.");
    } finally {
      setCompressing(false);
    }
  }

  function submit() {
    if (!canContinue) return;
    const values: PetFormValues = {
      name: name.trim(),
      species,
      breed: breed.trim(),
      sex: "unknown",
      altered: "",
      date_of_birth: dob,
      dob_is_estimated: dobEstimated,
      acquired_on: "",
      color: "",
      markings: "",
      microchip_number: "",
      microchip_registry: "",
      microchip_implanted_on: "",
      weight_value: "",
      weight_unit: "lbs",
      allergies: "",
      notes: "",
    };
    const payload = petFormToPayload(values);

    startTransition(async () => {
      const result = await createOnboardingPet(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const petId = result.petId;

      // Optional photo, best effort. A failed photo never blocks the flow.
      if (photoFile) {
        try {
          const uuid =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const path = `${householdId}/${petId}/${uuid}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("pet-photos")
            .upload(path, photoFile, {
              contentType: "image/jpeg",
              cacheControl: "3600",
              upsert: false,
            });
          if (!upErr) {
            await setPetPhoto(petId, path);
          }
        } catch {
          // ignore, photo is optional
        }
      }

      onDone({
        id: petId,
        name: name.trim(),
        species,
        birthDate: payload.date_of_birth,
        dobEstimated,
      });
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <StepHeader
        eyebrow="Your first pet"
        title="Who are we caring for?"
        sub="Just a name to start. Everything else fills in from documents later, so keep it quick."
      />

      {/* Photo + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Add a photo"
          style={{
            position: "relative",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            padding: 0,
            background: "transparent",
            cursor: compressing ? "wait" : "pointer",
            flexShrink: 0,
          }}
        >
          <PetPhoto name={name || "?"} src={photoPreview} size={64} />
          <span
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--pw-accent)",
              color: "var(--pw-accent-fg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--pw-bg)",
            }}
          >
            <Icon name="camera" size={12} />
          </span>
        </button>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bailey"
            style={inputStyle}
            autoFocus
            enterKeyHint="next"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPickPhoto}
          style={{ display: "none" }}
        />
      </div>

      <TextField label="Species">
        <div style={{ display: "flex", gap: 8 }}>
          {(["dog", "cat", "other"] as const).map((s) => {
            const active = species === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSpecies(s)}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--pw-accent)" : "var(--pw-border-strong)"}`,
                  background: active ? "var(--pw-accent-soft)" : "var(--pw-surface)",
                  color: active ? "var(--pw-accent-fg-on-soft)" : "var(--pw-text)",
                  font: "500 14px var(--font-inter)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </TextField>

      <TextField label="Breed (optional)">
        <BreedCombobox
          name="breed"
          defaultValue={breed}
          onChange={(v) => setBreed(v)}
          species={species}
          placeholder={
            species === "cat"
              ? "Domestic Shorthair…"
              : species === "dog"
                ? "Golden Retriever…"
                : "Free text"
          }
          key={species}
        />
      </TextField>

      <TextField
        label="Birthday (optional)"
        hint="Even a rough date unlocks the first-year plan and age-aware reminders."
      >
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          style={inputStyle}
        />
        {dob ? (
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={dobEstimated}
              onChange={(e) => setDobEstimated(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--pw-accent)" }}
            />
            This date is an estimate
          </label>
        ) : null}
      </TextField>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <GhostButton onClick={onBack} icon="arrowLeft">
          Back
        </GhostButton>
        <div style={{ flex: 1 }}>
          <PrimaryButton type="submit" disabled={!canContinue} busy={pending}>
            {compressing ? "Processing photo…" : "Add pet"}
            {!compressing ? <Icon name="arrowRight" size={16} /> : null}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
