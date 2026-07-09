import { z } from "zod";

export const MEDICATION_CONTEXTS = [
  "prescribed_takehome",
  "intraoperative",
  "injection_in_office",
  "otc_recommended",
  "unknown",
] as const;

export type MedicationContextValue = (typeof MEDICATION_CONTEXTS)[number];

export const MEDICATION_CONTEXT_LABEL: Record<MedicationContextValue, string> = {
  prescribed_takehome: "Take-home prescription",
  intraoperative: "Given during surgery",
  injection_in_office: "In-office injection",
  otc_recommended: "OTC recommendation",
  unknown: "Unknown",
};

export const medicationFormSchema = z.object({
  pet_id: z.string().uuid(),
  name: z.string().trim().min(1, "Medication name is required").max(200),
  dose: z.string().trim().min(1, "Dose is required").max(120),
  frequency: z.string().trim().max(120),
  started_on: z
    .string()
    .min(1, "Start date is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date"),
  ended_on: z.string(),
  duration_days: z.string().trim(),
  medication_context: z.enum(MEDICATION_CONTEXTS),
  prescriber: z.string().trim().max(120),
  indication: z.string().trim().max(500),
  vet_clinic_name: z.string().trim().max(160),
  notes: z.string().trim().max(2000),
});

export type MedicationFormValues = z.infer<typeof medicationFormSchema>;

export type MedicationActionPayload = {
  pet_id: string;
  name: string;
  dose: string;
  frequency: string | null;
  started_on: string;
  ended_on: string | null;
  duration_days: number | null;
  medication_context: MedicationContextValue;
  prescriber: string | null;
  indication: string | null;
  vet_clinic_name: string | null;
  notes: string | null;
};

export function medicationFormToPayload(
  v: MedicationFormValues,
): MedicationActionPayload {
  const ended = v.ended_on.trim();
  const durationRaw = v.duration_days.trim();
  let duration: number | null = null;
  if (durationRaw) {
    const n = Number(durationRaw);
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
      duration = n;
    }
  }
  return {
    pet_id: v.pet_id,
    name: v.name.trim(),
    dose: v.dose.trim(),
    frequency: v.frequency.trim() || null,
    started_on: v.started_on,
    ended_on:
      ended && !Number.isNaN(new Date(ended).getTime()) ? ended : null,
    duration_days: duration,
    medication_context: v.medication_context,
    prescriber: v.prescriber.trim() || null,
    indication: v.indication.trim() || null,
    vet_clinic_name: v.vet_clinic_name.trim() || null,
    notes: v.notes.trim() || null,
  };
}
