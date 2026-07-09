import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { inferFamilyFromType } from "@/lib/clinical/vaccine-catalog";
import {
  matchVaccines,
  matchMedicalEvents,
  matchMedications,
  matchWeights,
  matchLabValues,
  type VaccineCandidate,
  type VaccineMatch,
  type ExistingVaccine,
  type MedicalEventCandidate,
  type MedicalEventMatch,
  type ExistingMedicalEvent,
  type MedicationCandidate,
  type MedicationMatch,
  type ExistingMedication,
  type WeightCandidate,
  type WeightMatch,
  type ExistingWeight,
  type LabValueCandidate,
  type LabValueMatch,
  type ExistingLabValue,
} from "@/lib/db/extraction-dedup-match";

/**
 * Commit-time dedup helpers. Each function takes candidate entities that are
 * about to be inserted from an extraction, fetches the pet's existing rows,
 * and delegates the actual matching to the pure matchers in
 * extraction-dedup-match.ts. The review UI surfaces matches as conflict pills;
 * high-confidence matches default the skip-toggle ON so the user doesn't
 * re-ingest records they already have — but the row stays visible and
 * overridable. Pawdex never auto-deletes.
 */

// Re-export candidate + match types so existing consumers keep their imports.
export type {
  VaccineCandidate,
  VaccineMatch,
  MedicalEventCandidate,
  MedicalEventMatch,
  MedicationCandidate,
  MedicationMatch,
  WeightCandidate,
  WeightMatch,
  LabValueCandidate,
  LabValueMatch,
} from "@/lib/db/extraction-dedup-match";

// ── shared: clinic-name attachment ──────────────────────────────────

async function clinicNameMap(
  clinicIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(clinicIds.filter(Boolean)));
  if (ids.length === 0) return map;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("vet_clinics")
    .select("id, name")
    .in("id", ids);
  for (const c of data ?? []) map.set(c.id, c.name);
  return map;
}

// ── vaccine dedup ───────────────────────────────────────────────────

export async function findCandidateDuplicateVaccines(
  householdId: string,
  petId: string,
  candidates: VaccineCandidate[],
): Promise<Map<number, VaccineMatch[]>> {
  if (candidates.length === 0) return new Map();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("vaccinations")
    .select(
      "id, vaccine_type, vaccine_family, administered_on, expires_on, vet_clinic_id, document_id",
    )
    .eq("household_id", householdId)
    .eq("pet_id", petId);

  type Row = {
    id: string;
    vaccine_type: string;
    vaccine_family: string | null;
    administered_on: string;
    expires_on: string | null;
    vet_clinic_id: string | null;
    document_id: string | null;
  };
  const rows = (data ?? []) as Row[];
  const names = await clinicNameMap(
    rows.map((r) => r.vet_clinic_id).filter((v): v is string => !!v),
  );

  const existing: ExistingVaccine[] = rows.map((r) => ({
    ...r,
    // Infer family on the EXISTING side too. The candidate already gets
    // inferFamilyFromType in the review page, but DB rows store vaccine_family
    // only when it was set at commit time — legacy + extraction-committed rows
    // are null. Without this, a cross-clinic re-wording like "Canine Rabies
    // Annual Vaccine" (on file) vs "Rabies sq right hip" (new) never matches:
    // neither string contains the other, so only family-match can link them,
    // and family-match needs BOTH sides resolved. Symmetric inference is what
    // makes the motivating cross-clinic dedup actually fire.
    vaccine_family: r.vaccine_family ?? inferFamilyFromType(r.vaccine_type),
    vet_clinic_name: r.vet_clinic_id
      ? (names.get(r.vet_clinic_id) ?? null)
      : null,
  }));

  return matchVaccines(candidates, existing);
}

// ── medical event dedup ─────────────────────────────────────────────

export async function findCandidateDuplicateMedicalEvents(
  householdId: string,
  petId: string,
  candidates: MedicalEventCandidate[],
): Promise<Map<number, MedicalEventMatch[]>> {
  if (candidates.length === 0) return new Map();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("medical_events")
    .select("id, event_type, title, occurred_on, vet_clinic_id, document_id")
    .eq("household_id", householdId)
    .eq("pet_id", petId);

  type Row = {
    id: string;
    event_type: string;
    title: string;
    occurred_on: string;
    vet_clinic_id: string | null;
    document_id: string | null;
  };
  const rows = (data ?? []) as Row[];
  const names = await clinicNameMap(
    rows.map((r) => r.vet_clinic_id).filter((v): v is string => !!v),
  );

  const existing: ExistingMedicalEvent[] = rows.map((r) => ({
    ...r,
    vet_clinic_name: r.vet_clinic_id
      ? (names.get(r.vet_clinic_id) ?? null)
      : null,
  }));

  return matchMedicalEvents(candidates, existing);
}

// ── medication dedup ────────────────────────────────────────────────

export async function findCandidateDuplicateMedications(
  householdId: string,
  petId: string,
  candidates: MedicationCandidate[],
): Promise<Map<number, MedicationMatch[]>> {
  if (candidates.length === 0) return new Map();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("medications")
    .select(
      "id, name, generic_name, dose, frequency, started_on, ended_on, medication_context",
    )
    .eq("household_id", householdId)
    .eq("pet_id", petId);

  const existing = (data ?? []) as ExistingMedication[];
  return matchMedications(candidates, existing);
}

// ── weight dedup ────────────────────────────────────────────────────

export async function findCandidateDuplicateWeights(
  householdId: string,
  petId: string,
  candidates: WeightCandidate[],
): Promise<Map<number, WeightMatch[]>> {
  if (candidates.length === 0) return new Map();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("weight_log")
    .select("id, recorded_on, weight_kg, document_id")
    .eq("household_id", householdId)
    .eq("pet_id", petId);

  const existing = (data ?? []).map((r) => ({
    ...r,
    // numeric columns can arrive as strings through PostgREST — coerce.
    weight_kg: Number(r.weight_kg),
  })) as ExistingWeight[];
  return matchWeights(candidates, existing);
}

// ── lab value dedup ─────────────────────────────────────────────────

export async function findCandidateDuplicateLabValues(
  householdId: string,
  petId: string,
  candidates: LabValueCandidate[],
): Promise<Map<number, LabValueMatch[]>> {
  if (candidates.length === 0) return new Map();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("lab_values")
    .select("id, analyte, value, units, collected_on, document_id")
    .eq("household_id", householdId)
    .eq("pet_id", petId);

  const existing = (data ?? []).map((r) => ({
    ...r,
    value: r.value === null ? null : Number(r.value),
  })) as ExistingLabValue[];
  return matchLabValues(candidates, existing);
}

// ── pet attribute reconciliation ────────────────────────────────────

export type PetAttributesCandidate = {
  breed: string | null;
  sex: "male" | "female" | "unknown" | null;
  altered: boolean | null;
  date_of_birth: string | null;
  microchip_number: string | null;
  microchip_registry: string | null;
  microchip_implanted_on: string | null;
  color: string | null;
};

export type PetAttributeDiff = {
  field: keyof PetAttributesCandidate;
  current: unknown;
  extracted: unknown;
};

/**
 * Compare the extracted pet attributes against the canonical pets row and
 * return per-field diffs the review UI can offer the user as accept/reject.
 *
 * Only flags fields where the extracted value is non-null AND differs from
 * the current value. If the current value is empty/null, the extracted value
 * is treated as a "fill in the blank" — also surfaced.
 */
export async function reconcilePetAttributes(
  householdId: string,
  petId: string,
  extracted: PetAttributesCandidate | null,
): Promise<PetAttributeDiff[]> {
  if (!extracted) return [];

  const supabase = createServiceClient();
  const { data: pet } = await supabase
    .from("pets")
    .select(
      "breed, sex, altered, date_of_birth, microchip_number, microchip_registry, microchip_implanted_on, color",
    )
    .eq("household_id", householdId)
    .eq("id", petId)
    .maybeSingle();
  if (!pet) return [];

  const diffs: PetAttributeDiff[] = [];
  const fields: (keyof PetAttributesCandidate)[] = [
    "breed",
    "sex",
    "altered",
    "date_of_birth",
    "microchip_number",
    "microchip_registry",
    "microchip_implanted_on",
    "color",
  ];

  for (const f of fields) {
    const extractedValue = extracted[f];
    if (extractedValue === null || extractedValue === undefined) continue;
    const currentValue = (pet as Record<string, unknown>)[f] ?? null;
    if (currentValue === extractedValue) continue;
    if (
      typeof currentValue === "string" &&
      typeof extractedValue === "string" &&
      currentValue.trim().toLowerCase() === extractedValue.trim().toLowerCase()
    ) {
      continue;
    }
    diffs.push({
      field: f,
      current: currentValue,
      extracted: extractedValue,
    });
  }
  return diffs;
}
