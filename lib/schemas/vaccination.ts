import { z } from "zod";

export const vaccinationFormSchema = z.object({
  pet_id: z.string().uuid(),
  vaccine_type: z.string().trim().min(1, "Vaccine type is required").max(80),
  administered_on: z
    .string()
    .min(1, "Administered date is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date"),
  expires_on: z.string(),
  lot_number: z.string().trim().max(64),
  manufacturer: z.string().trim().max(120),
  administering_vet: z.string().trim().max(120),
  vet_clinic_name: z.string().trim().max(160),
  notes: z.string().trim().max(2000),
});

export type VaccinationFormValues = z.infer<typeof vaccinationFormSchema>;

export type VaccinationActionPayload = {
  pet_id: string;
  vaccine_type: string;
  administered_on: string;
  expires_on: string | null;
  lot_number: string | null;
  manufacturer: string | null;
  administering_vet: string | null;
  vet_clinic_name: string | null;
  notes: string | null;
};

export function vaccinationFormToPayload(
  v: VaccinationFormValues,
): VaccinationActionPayload {
  const expires = v.expires_on.trim();
  return {
    pet_id: v.pet_id,
    vaccine_type: v.vaccine_type.trim(),
    administered_on: v.administered_on,
    expires_on:
      expires && !Number.isNaN(new Date(expires).getTime()) ? expires : null,
    lot_number: v.lot_number.trim() || null,
    manufacturer: v.manufacturer.trim() || null,
    administering_vet: v.administering_vet.trim() || null,
    vet_clinic_name: v.vet_clinic_name.trim() || null,
    notes: v.notes.trim() || null,
  };
}

// Common dog & cat vaccine type suggestions
export const COMMON_VACCINES = {
  dog: [
    "Rabies (1 year)",
    "Rabies (3 year)",
    "DHPP",
    "DA2PP",
    "Leptospirosis",
    "Bordetella (Kennel Cough)",
    "Canine Influenza",
    "Lyme",
    "Rattlesnake",
  ],
  cat: [
    "Rabies (1 year)",
    "Rabies (3 year)",
    "FVRCP",
    "FeLV",
    "FIV",
  ],
  other: [] as string[],
} as const;
