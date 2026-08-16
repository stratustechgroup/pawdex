import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * The pet's effective current weight in kg: the `pets.current_weight_kg`
 * column when set, otherwise the newest `weight_log` row.
 *
 * The column is a denormalized convenience updated by the manual weight action
 * and the extraction commit path, but rows that reach `weight_log` any other
 * way (imports, harness seeds, future integrations) leave it stale or null.
 * The pet-header has always fallen back to the log; the printable documents
 * (packet, APHIS worksheet, share page) read only the column, so they printed
 * "—" for a weight the header displayed on the same screen. Documents handed
 * to vets should use the same fallback the header does — hence this helper.
 *
 * Takes the caller's client so it works under RLS (app pages) and with the
 * service client (the public share page) alike.
 */
export async function effectiveWeightKg(
  supabase: SupabaseClient<Database>,
  householdId: string,
  petId: string,
  columnValue: number | null,
): Promise<number | null> {
  if (columnValue != null) return Number(columnValue);
  const { data } = await supabase
    .from("weight_log")
    .select("weight_kg")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .order("recorded_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? Number(data.weight_kg) : null;
}
