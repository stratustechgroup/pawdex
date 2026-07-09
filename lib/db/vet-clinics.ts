import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { VetClinic } from "@/lib/supabase/types";

export type VetClinicWithStats = VetClinic & {
  document_count: number;
  vaccination_count: number;
  medical_event_count: number;
  medication_count: number;
  pet_count: number;
};

export async function listVetClinics(
  householdId: string,
): Promise<VetClinicWithStats[]> {
  const supabase = await createClient();

  const { data: clinics, error } = await supabase
    .from("vet_clinics")
    .select("*")
    .eq("household_id", householdId)
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`listVetClinics: ${error.message}`);

  const clinicRows = (clinics ?? []) as VetClinic[];
  if (clinicRows.length === 0) return [];

  const ids = clinicRows.map((c) => c.id);

  // Pull related counts in parallel; merge into the clinic rows.
  const [vacc, events, meds, docs] = await Promise.all([
    supabase
      .from("vaccinations")
      .select("vet_clinic_id, pet_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", ids),
    supabase
      .from("medical_events")
      .select("vet_clinic_id, pet_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", ids),
    supabase
      .from("medications")
      .select("vet_clinic_id, pet_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", ids),
    // documents.vet_clinic isn't directly linked — instead we count documents
    // that have at least one vaccination/event/medication linked to a clinic.
    supabase
      .from("vaccinations")
      .select("vet_clinic_id, document_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", ids)
      .not("document_id", "is", null),
  ]);

  type Counter = { count: number; pets: Set<string>; docs?: Set<string> };
  const stats = new Map<string, Counter>();
  const ensure = (id: string): Counter => {
    let c = stats.get(id);
    if (!c) {
      c = { count: 0, pets: new Set<string>() };
      stats.set(id, c);
    }
    return c;
  };

  const vaccCount = new Map<string, number>();
  const eventCount = new Map<string, number>();
  const medCount = new Map<string, number>();
  const docSet = new Map<string, Set<string>>();

  for (const r of (vacc.data ?? []) as Array<{ vet_clinic_id: string | null; pet_id: string }>) {
    if (!r.vet_clinic_id) continue;
    vaccCount.set(r.vet_clinic_id, (vaccCount.get(r.vet_clinic_id) ?? 0) + 1);
    ensure(r.vet_clinic_id).pets.add(r.pet_id);
  }
  for (const r of (events.data ?? []) as Array<{ vet_clinic_id: string | null; pet_id: string }>) {
    if (!r.vet_clinic_id) continue;
    eventCount.set(r.vet_clinic_id, (eventCount.get(r.vet_clinic_id) ?? 0) + 1);
    ensure(r.vet_clinic_id).pets.add(r.pet_id);
  }
  for (const r of (meds.data ?? []) as Array<{ vet_clinic_id: string | null; pet_id: string }>) {
    if (!r.vet_clinic_id) continue;
    medCount.set(r.vet_clinic_id, (medCount.get(r.vet_clinic_id) ?? 0) + 1);
    ensure(r.vet_clinic_id).pets.add(r.pet_id);
  }
  for (const r of (docs.data ?? []) as Array<{ vet_clinic_id: string | null; document_id: string | null }>) {
    if (!r.vet_clinic_id || !r.document_id) continue;
    let set = docSet.get(r.vet_clinic_id);
    if (!set) {
      set = new Set();
      docSet.set(r.vet_clinic_id, set);
    }
    set.add(r.document_id);
  }

  return clinicRows.map((c) => ({
    ...c,
    document_count: docSet.get(c.id)?.size ?? 0,
    vaccination_count: vaccCount.get(c.id) ?? 0,
    medical_event_count: eventCount.get(c.id) ?? 0,
    medication_count: medCount.get(c.id) ?? 0,
    pet_count: stats.get(c.id)?.pets.size ?? 0,
  }));
}

export async function getVetClinic(
  householdId: string,
  clinicId: string,
): Promise<VetClinic | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vet_clinics")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", clinicId)
    .maybeSingle();
  if (error) throw new Error(`getVetClinic: ${error.message}`);
  return (data as VetClinic | null) ?? null;
}
