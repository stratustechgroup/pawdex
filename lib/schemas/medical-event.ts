import { z } from "zod";

export const MEDICAL_EVENT_TYPES = [
  "exam",
  "illness",
  "injury",
  "surgery",
  "dental",
  "lab_result",
  "imaging",
  "parasite_prevention",
  "behavioral",
  "other",
] as const;

export type MedicalEventType = (typeof MEDICAL_EVENT_TYPES)[number];

export const MEDICAL_EVENT_TYPE_LABEL: Record<MedicalEventType, string> = {
  exam: "Exam",
  illness: "Illness",
  injury: "Injury",
  surgery: "Surgery",
  dental: "Dental",
  lab_result: "Lab result",
  imaging: "Imaging",
  parasite_prevention: "Parasite prevention",
  behavioral: "Behavioral",
  other: "Other",
};

export const medicalEventFormSchema = z.object({
  pet_id: z.string().uuid(),
  event_type: z.enum(MEDICAL_EVENT_TYPES),
  occurred_on: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date"),
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().max(2000),
  diagnosis: z.string().trim().max(500),
  treatment: z.string().trim().max(2000),
  attending_vet: z.string().trim().max(120),
  vet_clinic_name: z.string().trim().max(160),
  notes: z.string().trim().max(2000),
});

export type MedicalEventFormValues = z.infer<typeof medicalEventFormSchema>;

export type MedicalEventActionPayload = {
  pet_id: string;
  event_type: MedicalEventType;
  occurred_on: string;
  title: string;
  summary: string | null;
  diagnosis: string | null;
  treatment: string | null;
  attending_vet: string | null;
  vet_clinic_name: string | null;
  notes: string | null;
};

export function medicalEventFormToPayload(
  v: MedicalEventFormValues,
): MedicalEventActionPayload {
  return {
    pet_id: v.pet_id,
    event_type: v.event_type,
    occurred_on: v.occurred_on,
    title: v.title.trim(),
    summary: v.summary.trim() || null,
    diagnosis: v.diagnosis.trim() || null,
    treatment: v.treatment.trim() || null,
    attending_vet: v.attending_vet.trim() || null,
    vet_clinic_name: v.vet_clinic_name.trim() || null,
    notes: v.notes.trim() || null,
  };
}
