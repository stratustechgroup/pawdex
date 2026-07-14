"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { processPolicyExtraction } from "@/lib/ai/policy-trigger";
import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function asCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function asPercent(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

function asDate(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

function asString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function asArrayOfLines(value: FormDataEntryValue | null): string[] | null {
  if (typeof value !== "string") return null;
  const arr = value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length === 0 ? null : arr;
}

export async function createInsurancePolicy(formData: FormData): Promise<void> {
  const session = await requireSession();
  const insurer = asString(formData.get("insurer_name"));
  if (!insurer) throw new Error("Insurer name is required.");

  const petIdRaw = formData.get("pet_id");
  const petId =
    typeof petIdRaw === "string" && petIdRaw && petIdRaw !== "household"
      ? petIdRaw
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurance_policies")
    .insert({
      household_id: session.householdId,
      pet_id: petId,
      insurer_name: insurer,
      plan_name: asString(formData.get("plan_name")),
      policy_number: asString(formData.get("policy_number")),
      premium_monthly_cents: asCents(formData.get("premium_monthly")),
      deductible_annual_cents: asCents(formData.get("deductible_annual")),
      annual_max_cents: asCents(formData.get("annual_max")),
      reimbursement_rate: asPercent(formData.get("reimbursement_rate")),
      effective_on: asDate(formData.get("effective_on")),
      renews_on: asDate(formData.get("renews_on")),
      extracted_exclusions: asArrayOfLines(formData.get("exclusions")),
      notes: asString(formData.get("notes")),
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save policy: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "insurance_policy",
    entityId: data.id,
    diff: {
      after: {
        insurer_name: insurer,
        plan_name: asString(formData.get("plan_name")),
        pet_id: petId,
      },
    },
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}

export async function retryPolicyExtraction(formData: FormData): Promise<void> {
  const id = formData.get("policy_id");
  if (typeof id !== "string" || !id) throw new Error("policy_id required");
  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't retry extraction.");

  const supabase = createServiceClient();
  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id, household_id, pet_id, document_id")
    .eq("id", id)
    .maybeSingle();
  if (!policy || policy.household_id !== session.householdId) {
    throw new Error("Policy not found in this household.");
  }
  if (!policy.document_id) {
    throw new Error(
      "This policy has no source document — extraction can only retry against a stored PDF.",
    );
  }

  // Reset the document to pending so the trigger flow runs cleanly.
  await supabase
    .from("documents")
    .update({ processing_status: "pending", error_message: null })
    .eq("id", policy.document_id);

  after(async () => {
    try {
      await processPolicyExtraction({
        documentId: policy.document_id!,
        insurancePolicyId: policy.id,
        petId: policy.pet_id,
      });
    } catch (err) {
      console.error("retryPolicyExtraction failed", err);
    }
  });

  revalidatePath("/insurance");
}

export async function archiveInsurancePolicy(formData: FormData): Promise<void> {
  const id = formData.get("policy_id");
  if (typeof id !== "string" || !id) throw new Error("policy_id required");
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("insurance_policies")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Archive failed: ${error.message}`);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "archive",
    entityType: "insurance_policy",
    entityId: id,
  });

  revalidatePath("/insurance");
}
