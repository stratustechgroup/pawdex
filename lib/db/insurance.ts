import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { InsurancePolicy } from "@/lib/supabase/types";

export type InsurancePolicyWithPet = InsurancePolicy & {
  pet_name: string | null;
};

export async function listInsurancePolicies(
  householdId: string,
): Promise<InsurancePolicyWithPet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("renews_on", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`listInsurancePolicies: ${error.message}`);

  const rows = (data ?? []) as InsurancePolicy[];
  const petIds = Array.from(
    new Set(rows.map((r) => r.pet_id).filter((id): id is string => !!id)),
  );

  const petNameById = new Map<string, string>();
  if (petIds.length > 0) {
    const { data: pets } = await supabase
      .from("pets")
      .select("id, name")
      .in("id", petIds);
    for (const p of pets ?? []) petNameById.set(p.id, p.name);
  }

  return rows.map((r) => ({
    ...r,
    pet_name: r.pet_id ? (petNameById.get(r.pet_id) ?? null) : null,
  }));
}

export async function getInsurancePolicy(
  householdId: string,
  policyId: string,
): Promise<InsurancePolicy | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", policyId)
    .maybeSingle();
  if (error) throw new Error(`getInsurancePolicy: ${error.message}`);
  return (data as InsurancePolicy | null) ?? null;
}
