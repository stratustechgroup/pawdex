import { z } from "zod";

// Form schema — strings only, no transforms. Used by react-hook-form.
export const petFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  species: z.enum(["dog", "cat", "other"]),
  breed: z.string().trim().max(120),
  sex: z.enum(["male", "female", "unknown"]),
  altered: z.enum(["", "yes", "no"]),
  date_of_birth: z.string().trim(),
  dob_is_estimated: z.boolean(),
  acquired_on: z.string().trim(),
  color: z.string().trim().max(120),
  markings: z.string().trim().max(500),
  microchip_number: z.string().trim().max(32),
  microchip_registry: z.string().trim().max(120),
  microchip_implanted_on: z.string().trim(),
  weight_value: z.string().trim(),
  weight_unit: z.enum(["kg", "lbs"]),
  allergies: z.string().trim().max(500),
  notes: z.string().trim().max(2000),
});

export type PetFormValues = z.infer<typeof petFormSchema>;

// Normalized payload for the Server Action.
export type PetActionPayload = {
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  sex: "male" | "female" | "unknown";
  altered: boolean | null;
  date_of_birth: string | null;
  dob_is_estimated: boolean;
  acquired_on: string | null;
  color: string | null;
  markings: string | null;
  microchip_number: string | null;
  microchip_registry: string | null;
  microchip_implanted_on: string | null;
  current_weight_kg: number | null;
  allergies: string | null;
  notes: string | null;
};

function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 1000) / 1000;
}

function asDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return Number.isNaN(new Date(trimmed).getTime()) ? null : trimmed;
}

export function petFormToPayload(values: PetFormValues): PetActionPayload {
  const weightRaw = values.weight_value.trim();
  let weightKg: number | null = null;
  if (weightRaw) {
    const n = Number(weightRaw);
    if (!Number.isNaN(n) && n > 0) {
      weightKg = values.weight_unit === "lbs" ? lbsToKg(n) : n;
    }
  }

  return {
    name: values.name.trim(),
    species: values.species,
    breed: values.breed.trim() || null,
    sex: values.sex,
    altered: values.altered === "yes" ? true : values.altered === "no" ? false : null,
    date_of_birth: asDate(values.date_of_birth),
    dob_is_estimated: values.dob_is_estimated,
    acquired_on: asDate(values.acquired_on),
    color: values.color.trim() || null,
    markings: values.markings.trim() || null,
    microchip_number: values.microchip_number.trim() || null,
    microchip_registry: values.microchip_registry.trim() || null,
    microchip_implanted_on: asDate(values.microchip_implanted_on),
    current_weight_kg: weightKg,
    allergies: values.allergies.trim() || null,
    notes: values.notes.trim() || null,
  };
}
