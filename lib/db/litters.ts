import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type Litter = Database["public"]["Tables"]["litters"]["Row"];
export type LitterInsert = Database["public"]["Tables"]["litters"]["Insert"];

export async function listLittersForHousehold(
  householdId: string,
): Promise<Litter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("litters")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listLittersForHousehold: ${error.message}`);
  return (data ?? []) as Litter[];
}

export async function getLitter(
  householdId: string,
  litterId: string,
): Promise<Litter | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("litters")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", litterId)
    .maybeSingle();
  if (error) throw new Error(`getLitter: ${error.message}`);
  return (data as Litter | null) ?? null;
}

/** Animals currently assigned to a litter. */
export async function listLitterAnimals(
  litterId: string,
): Promise<Database["public"]["Tables"]["animals"]["Row"][]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .select("*")
    .eq("litter_id", litterId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listLitterAnimals: ${error.message}`);
  return (data ?? []) as Database["public"]["Tables"]["animals"]["Row"][];
}

export async function createLitter(input: {
  householdId: string;
  name: string;
  damAnimalId: string;
  sireAnimalId: string | null;
  whelpedOn: string | null;
  notes: string | null;
}): Promise<Litter> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("litters")
    .insert({
      household_id: input.householdId,
      name: input.name,
      dam_animal_id: input.damAnimalId,
      sire_animal_id: input.sireAnimalId,
      whelped_on: input.whelpedOn,
      notes: input.notes,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`createLitter: ${error?.message ?? "no row"}`);
  }
  return data as Litter;
}
