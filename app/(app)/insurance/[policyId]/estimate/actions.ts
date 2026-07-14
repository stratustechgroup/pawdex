"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/household";
import { computeTrueOop } from "@/lib/calculator/true-oop";
import { recordAudit } from "@/lib/db/audit";
import { getPolicyYtdTotals } from "@/lib/db/policy-ytd";
import { createServiceClient } from "@/lib/supabase/service";
import type { InsurancePolicy } from "@/lib/supabase/types";

function asCents(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createCostEstimate(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't create estimates.");
  const policyId = formData.get("policy_id");
  if (typeof policyId !== "string" || !policyId) {
    throw new Error("policy_id required");
  }

  const petId = formData.get("pet_id");
  if (typeof petId !== "string" || !petId) {
    throw new Error("Pick a pet for this estimate.");
  }

  const procedure = formData.get("procedure_summary");
  if (typeof procedure !== "string" || procedure.trim().length === 0) {
    throw new Error("Describe the procedure briefly.");
  }

  const grossCents = asCents(formData.get("gross_estimate"));
  if (grossCents === null) {
    throw new Error("Enter the gross estimate amount.");
  }

  // Load the policy + compute YTD totals to derive accurate remaining caps.
  const supabase = createServiceClient();
  const { data: policy, error: polErr } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("id", policyId)
    .maybeSingle();
  if (polErr || !policy || policy.household_id !== session.householdId) {
    throw new Error("Policy not found in this household.");
  }

  const ytd = await getPolicyYtdTotals(
    session.householdId,
    policy as InsurancePolicy,
  );
  const deductibleRemainingFromYtd =
    policy.deductible_annual_cents !== null
      ? Math.max(0, policy.deductible_annual_cents - ytd.approved_cents)
      : null;
  const annualMaxRemainingFromYtd =
    policy.annual_max_cents !== null
      ? Math.max(0, policy.annual_max_cents - ytd.reimbursed_cents)
      : null;

  const deductibleRemainingCentsOverride = asCents(
    formData.get("deductible_remaining"),
  );
  const deductibleRemaining =
    deductibleRemainingCentsOverride ?? deductibleRemainingFromYtd;

  const breakdown = computeTrueOop({
    gross_cents: grossCents,
    deductible_remaining_cents: deductibleRemaining,
    reimbursement_rate: policy.reimbursement_rate,
    annual_max_remaining_cents: annualMaxRemainingFromYtd,
  });

  const { data: row, error } = await supabase
    .from("cost_estimates")
    .insert({
      household_id: session.householdId,
      pet_id: petId,
      insurance_policy_id: policy.id,
      procedure_summary: procedure.trim(),
      gross_estimate_cents: breakdown.gross_cents,
      applied_deductible_cents: breakdown.applied_deductible_cents,
      reimbursement_eligible_cents: breakdown.reimbursement_eligible_cents,
      reimbursement_rate: breakdown.reimbursement_rate,
      true_oop_cents: breakdown.true_oop_cents,
      status: "computed",
      computed_at: new Date().toISOString(),
      computed_by_model: "deterministic-v1",
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !row) {
    throw new Error(`Failed to save estimate: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "cost_estimate",
    entityId: row.id,
    diff: {
      after: {
        policy_id: policy.id,
        pet_id: petId,
        procedure: procedure.trim(),
        gross_cents: breakdown.gross_cents,
        true_oop_cents: breakdown.true_oop_cents,
      },
    },
  });

  revalidatePath(`/insurance/${policy.id}/estimate`);
  revalidatePath("/insurance");
  redirect(`/insurance/${policy.id}/estimate`);
}

export async function deleteCostEstimate(formData: FormData): Promise<void> {
  const id = formData.get("estimate_id");
  if (typeof id !== "string" || !id) throw new Error("estimate_id required");
  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't delete estimates.");
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("cost_estimates")
    .select("insurance_policy_id, household_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.household_id !== session.householdId) return;

  await supabase
    .from("cost_estimates")
    .delete()
    .eq("id", id)
    .eq("household_id", session.householdId);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "cost_estimate",
    entityId: id,
  });

  if (row.insurance_policy_id) {
    revalidatePath(`/insurance/${row.insurance_policy_id}/estimate`);
  }
}
