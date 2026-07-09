import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Vaccination } from "@/lib/supabase/types";

/**
 * The pet's "current" vaccine roster — one entry per vaccine family, picking
 * the row with the latest administered_on. Older entries for the same family
 * are superseded by the newest dose, which is the one whose expiration date
 * matters for "Up to date" / "Due soon" / "Overdue" status.
 *
 * Returns the full vaccination row (with vaccine_family populated from the
 * generated column) so callers can read expires_on, vaccine_type, etc.
 */
export async function getCurrentVaccinations(
  householdId: string,
  petId: string,
): Promise<Vaccination[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vaccinations")
    .select("*")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .order("administered_on", { ascending: false });
  if (error) throw new Error(`getCurrentVaccinations: ${error.message}`);

  const byFamily = new Map<string, Vaccination>();
  for (const row of (data ?? []) as Vaccination[]) {
    const family = row.vaccine_family;
    if (!family) {
      // Fall back to the verbatim vaccine_type so untyped rows still surface.
      const fallbackKey = `__unfamilied:${row.vaccine_type.toLowerCase().trim()}`;
      if (!byFamily.has(fallbackKey)) byFamily.set(fallbackKey, row);
      continue;
    }
    if (!byFamily.has(family)) byFamily.set(family, row);
  }
  return [...byFamily.values()];
}

/**
 * Across all pets in the household, return latest-per-(pet, family) rows.
 * Used by the dashboard status badges so a pet with 6 rabies entries
 * (from different historical visits) still shows a single "up to date"
 * green badge driven by the most recent dose.
 */
export async function getCurrentVaccinationsForHousehold(
  householdId: string,
): Promise<Map<string, Vaccination[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vaccinations")
    .select("*")
    .eq("household_id", householdId)
    .order("administered_on", { ascending: false });
  if (error) throw new Error(`getCurrentVaccinationsForHousehold: ${error.message}`);

  const byPet = new Map<string, Map<string, Vaccination>>();
  for (const row of (data ?? []) as Vaccination[]) {
    const family =
      row.vaccine_family ?? `__unfamilied:${row.vaccine_type.toLowerCase().trim()}`;
    let perFamily = byPet.get(row.pet_id);
    if (!perFamily) {
      perFamily = new Map();
      byPet.set(row.pet_id, perFamily);
    }
    if (!perFamily.has(family)) perFamily.set(family, row);
  }
  const out = new Map<string, Vaccination[]>();
  for (const [petId, perFamily] of byPet) {
    out.set(petId, [...perFamily.values()]);
  }
  return out;
}
