import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";
import type { VetClinic } from "@/lib/supabase/types";

export type DuplicateGroup = {
  // Stable key for React + form posts (one of the duplicates' ids, prefixed
  // with the signal type that grouped them).
  key: string;
  reason: "phone" | "name";
  clinics: ClinicWithStats[];
};

export type ClinicWithStats = VetClinic & {
  vaccination_count: number;
  medication_count: number;
  medical_event_count: number;
  pet_count: number;
};

// Squash whitespace + lowercase + strip non-alphanumerics for fuzzy name
// grouping. "Cleveland Park Animal Hospital" and "cleveland park animal
// hospital." both reduce to "clevelandparkanimalhospital".
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export async function findDuplicateGroups(
  householdId: string,
): Promise<DuplicateGroup[]> {
  const supabase = await createClient();

  const { data: clinics, error } = await supabase
    .from("vet_clinics")
    .select("*")
    .eq("household_id", householdId);

  if (error) throw new Error(`findDuplicateGroups: ${error.message}`);
  const rows = (clinics ?? []) as VetClinic[];
  if (rows.length < 2) return [];

  const stats = await fetchClinicStats(householdId, rows.map((r) => r.id));
  const enriched: ClinicWithStats[] = rows.map((c) => ({
    ...c,
    ...(stats.get(c.id) ?? {
      vaccination_count: 0,
      medication_count: 0,
      medical_event_count: 0,
      pet_count: 0,
    }),
  }));

  // Group by phone first (strong signal), then by fuzzy name (weaker).
  const byPhone = new Map<string, ClinicWithStats[]>();
  const byName = new Map<string, ClinicWithStats[]>();

  for (const c of enriched) {
    const phone = c.phone_normalized ?? normalizePhone(c.phone);
    if (phone) {
      const list = byPhone.get(phone) ?? [];
      list.push(c);
      byPhone.set(phone, list);
    }
    const nm = nameKey(c.name);
    if (nm) {
      const list = byName.get(nm) ?? [];
      list.push(c);
      byName.set(nm, list);
    }
  }

  const groups: DuplicateGroup[] = [];
  const claimed = new Set<string>(); // clinic IDs already in a group

  // Emit phone-matched groups first (higher confidence).
  for (const [phone, list] of byPhone) {
    if (list.length < 2) continue;
    const filtered = list.filter((c) => !claimed.has(c.id));
    if (filtered.length < 2) continue;
    for (const c of filtered) claimed.add(c.id);
    groups.push({
      key: `phone:${phone}:${filtered[0].id}`,
      reason: "phone",
      clinics: filtered,
    });
  }

  // Then name-matched groups (excluding clinics already in a phone group).
  for (const [nm, list] of byName) {
    if (list.length < 2) continue;
    const filtered = list.filter((c) => !claimed.has(c.id));
    if (filtered.length < 2) continue;
    for (const c of filtered) claimed.add(c.id);
    groups.push({
      key: `name:${nm}:${filtered[0].id}`,
      reason: "name",
      clinics: filtered,
    });
  }

  return groups;
}

async function fetchClinicStats(
  householdId: string,
  clinicIds: string[],
): Promise<
  Map<
    string,
    {
      vaccination_count: number;
      medication_count: number;
      medical_event_count: number;
      pet_count: number;
    }
  >
> {
  const supabase = await createClient();
  if (clinicIds.length === 0) return new Map();

  const [vacc, events, meds] = await Promise.all([
    supabase
      .from("vaccinations")
      .select("vet_clinic_id, pet_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", clinicIds),
    supabase
      .from("medical_events")
      .select("vet_clinic_id, pet_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", clinicIds),
    supabase
      .from("medications")
      .select("vet_clinic_id, pet_id")
      .eq("household_id", householdId)
      .in("vet_clinic_id", clinicIds),
  ]);

  type Counter = {
    vaccination_count: number;
    medication_count: number;
    medical_event_count: number;
    pets: Set<string>;
  };
  const m = new Map<string, Counter>();
  const ensure = (id: string): Counter => {
    let c = m.get(id);
    if (!c) {
      c = {
        vaccination_count: 0,
        medication_count: 0,
        medical_event_count: 0,
        pets: new Set(),
      };
      m.set(id, c);
    }
    return c;
  };
  for (const r of (vacc.data ?? []) as Array<{
    vet_clinic_id: string | null;
    pet_id: string;
  }>) {
    if (!r.vet_clinic_id) continue;
    const c = ensure(r.vet_clinic_id);
    c.vaccination_count++;
    c.pets.add(r.pet_id);
  }
  for (const r of (events.data ?? []) as Array<{
    vet_clinic_id: string | null;
    pet_id: string;
  }>) {
    if (!r.vet_clinic_id) continue;
    const c = ensure(r.vet_clinic_id);
    c.medical_event_count++;
    c.pets.add(r.pet_id);
  }
  for (const r of (meds.data ?? []) as Array<{
    vet_clinic_id: string | null;
    pet_id: string;
  }>) {
    if (!r.vet_clinic_id) continue;
    const c = ensure(r.vet_clinic_id);
    c.medication_count++;
    c.pets.add(r.pet_id);
  }

  const out = new Map<
    string,
    {
      vaccination_count: number;
      medication_count: number;
      medical_event_count: number;
      pet_count: number;
    }
  >();
  for (const [id, counter] of m) {
    out.set(id, {
      vaccination_count: counter.vaccination_count,
      medication_count: counter.medication_count,
      medical_event_count: counter.medical_event_count,
      pet_count: counter.pets.size,
    });
  }
  return out;
}
