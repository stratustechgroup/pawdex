"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createServiceClient } from "@/lib/supabase/service";
import type { ClaimStatus, Database, Json } from "@/lib/supabase/types";

type ClaimUpdate = Database["public"]["Tables"]["claims"]["Update"];

const VALID_STATUSES: ClaimStatus[] = [
  "drafted",
  "submitted",
  "approved",
  "partially_approved",
  "denied",
  "appealed",
  "closed",
];

function asCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function asDate(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

export async function createClaim(formData: FormData): Promise<void> {
  const policyId = String(formData.get("policy_id") ?? "");
  if (!policyId) throw new Error("policy_id required");

  const session = await requireSession();
  const supabase = createServiceClient();

  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id, household_id, pet_id")
    .eq("id", policyId)
    .maybeSingle();
  if (!policy || policy.household_id !== session.householdId) {
    throw new Error("Policy not found.");
  }
  if (!policy.pet_id) {
    throw new Error(
      "Household-scoped policies can't have claims attached. Tie the policy to a specific pet first.",
    );
  }

  const { data, error } = await supabase
    .from("claims")
    .insert({
      household_id: session.householdId,
      pet_id: policy.pet_id,
      insurance_policy_id: policy.id,
      status: "drafted",
      service_date: asDate(formData.get("service_date")),
      total_billed_cents: asCents(formData.get("total_billed")),
      notes: asString(formData.get("notes")),
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create claim: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "claim",
    entityId: data.id,
    diff: {
      after: {
        policy_id: policy.id,
        pet_id: policy.pet_id,
        service_date: asDate(formData.get("service_date")),
      },
    },
  });

  revalidatePath(`/insurance/${policyId}/claims`);
  redirect(`/insurance/${policyId}/claims/${data.id}`);
}

export async function updateClaim(formData: FormData): Promise<void> {
  const claimId = String(formData.get("claim_id") ?? "");
  const policyId = String(formData.get("policy_id") ?? "");
  if (!claimId || !policyId) throw new Error("claim_id + policy_id required");

  const statusRaw = String(formData.get("status") ?? "");
  const status = VALID_STATUSES.includes(statusRaw as ClaimStatus)
    ? (statusRaw as ClaimStatus)
    : null;

  const update: ClaimUpdate = {
    service_date: asDate(formData.get("service_date")),
    submitted_on: asDate(formData.get("submitted_on")),
    decided_on: asDate(formData.get("decided_on")),
    claim_number: asString(formData.get("claim_number")),
    total_billed_cents: asCents(formData.get("total_billed")),
    amount_approved_cents: asCents(formData.get("amount_approved")),
    amount_reimbursed_cents: asCents(formData.get("amount_reimbursed")),
    denial_reason: asString(formData.get("denial_reason")),
    notes: asString(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };
  if (status) update.status = status;

  const session = await requireSession();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("claims")
    .update(update)
    .eq("id", claimId)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Update failed: ${error.message}`);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "claim",
    entityId: claimId,
    diff: { after: update as unknown as Json },
  });

  revalidatePath(`/insurance/${policyId}/claims/${claimId}`);
  revalidatePath(`/insurance/${policyId}/claims`);
}

export async function deleteClaim(formData: FormData): Promise<void> {
  const claimId = String(formData.get("claim_id") ?? "");
  const policyId = String(formData.get("policy_id") ?? "");
  if (!claimId || !policyId) throw new Error("claim_id + policy_id required");
  const session = await requireSession();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("claims")
    .delete()
    .eq("id", claimId)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Delete failed: ${error.message}`);
  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "claim",
    entityId: claimId,
  });
  revalidatePath(`/insurance/${policyId}/claims`);
  redirect(`/insurance/${policyId}/claims`);
}
