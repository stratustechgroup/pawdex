import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

export type Animal = Database["public"]["Tables"]["animals"]["Row"];
export type AnimalInsert = Database["public"]["Tables"]["animals"]["Insert"];
export type Custodianship = Database["public"]["Tables"]["custodianships"]["Row"];
export type CustodianshipRole = Database["public"]["Enums"]["custodianship_role"];

/**
 * Animals a household currently holds, via its active custodianships. Read path
 * runs as the caller (RLS enforces custodian visibility).
 */
export async function listAnimalsForHousehold(
  householdId: string,
): Promise<Animal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custodianships")
    .select("animals(*)")
    .eq("household_id", householdId)
    .is("ended_at", null);
  if (error) throw new Error(`listAnimalsForHousehold: ${error.message}`);

  return ((data ?? []) as unknown as { animals: Animal | null }[])
    .map((row) => row.animals)
    .filter((a): a is Animal => a !== null);
}

export async function getAnimal(animalId: string): Promise<Animal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .select("*")
    .eq("id", animalId)
    .maybeSingle();
  if (error) throw new Error(`getAnimal: ${error.message}`);
  return (data as Animal | null) ?? null;
}

export async function listActiveCustodianships(
  animalId: string,
): Promise<Custodianship[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custodianships")
    .select("*")
    .eq("animal_id", animalId)
    .is("ended_at", null)
    .order("started_at", { ascending: true });
  if (error) throw new Error(`listActiveCustodianships: ${error.message}`);
  return (data ?? []) as Custodianship[];
}

/**
 * Create a new animal together with its first custodianship, atomically enough
 * for the app: both writes go through the service role (animals INSERT and
 * custodianships INSERT are service-role only by RLS). If the custodianship
 * write fails we best-effort remove the orphan animal.
 */
export async function createAnimalWithCustodianship(input: {
  animal: AnimalInsert;
  householdId: string;
  role: CustodianshipRole;
  createdBy: string | null;
}): Promise<Animal> {
  const supabase = createServiceClient();

  const { data: animal, error: animalErr } = await supabase
    .from("animals")
    .insert(input.animal)
    .select("*")
    .single();
  if (animalErr || !animal) {
    throw new Error(`createAnimal: ${animalErr?.message ?? "no row"}`);
  }

  const { error: custErr } = await supabase.from("custodianships").insert({
    animal_id: animal.id,
    household_id: input.householdId,
    role: input.role,
    created_by: input.createdBy,
  });
  if (custErr) {
    await supabase.from("animals").delete().eq("id", animal.id);
    throw new Error(`createAnimal custodianship: ${custErr.message}`);
  }

  return animal as Animal;
}

export async function setPlacementStatus(input: {
  animalId: string;
  status: Database["public"]["Enums"]["animal_placement_status"];
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("animals")
    .update({ placement_status: input.status })
    .eq("id", input.animalId);
  if (error) throw new Error(`setPlacementStatus: ${error.message}`);
}
