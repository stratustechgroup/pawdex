import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CostEstimate } from "@/lib/supabase/types";

export async function listCostEstimatesForPolicy(
  householdId: string,
  policyId: string,
): Promise<CostEstimate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_estimates")
    .select("*")
    .eq("household_id", householdId)
    .eq("insurance_policy_id", policyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCostEstimatesForPolicy: ${error.message}`);
  return (data ?? []) as CostEstimate[];
}

export async function listCostEstimatesForHousehold(
  householdId: string,
): Promise<CostEstimate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_estimates")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`listCostEstimatesForHousehold: ${error.message}`);
  return (data ?? []) as CostEstimate[];
}
