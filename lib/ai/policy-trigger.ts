import "server-only";

import { recordAudit } from "@/lib/db/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { extractPolicy, PolicyExtractionError } from "@/lib/ai/extract-policy";
import type { Database } from "@/lib/supabase/types";

type InsurancePolicyUpdate =
  Database["public"]["Tables"]["insurance_policies"]["Update"];

/**
 * Pipeline: fetch the policy document from storage → run Sonnet extraction →
 * upsert into insurance_policies. Designed to run from `after()` post-upload.
 */
export async function processPolicyExtraction(opts: {
  documentId: string;
  insurancePolicyId: string;
  petId: string | null;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select(
      "id, household_id, storage_bucket, storage_path, mime_type, original_filename",
    )
    .eq("id", opts.documentId)
    .maybeSingle();
  if (docErr || !doc) {
    console.error("processPolicyExtraction: document not found", {
      documentId: opts.documentId,
      err: docErr?.message,
    });
    return;
  }

  await supabase
    .from("documents")
    .update({ processing_status: "extracting" })
    .eq("id", doc.id);

  const { data: blob, error: dlErr } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);
  if (dlErr || !blob) {
    await markFailed(doc.id, `Storage download failed: ${dlErr?.message ?? "unknown"}`);
    return;
  }

  const fileBytes = new Uint8Array(await blob.arrayBuffer());
  const mimeType = doc.mime_type ?? blob.type ?? "application/octet-stream";
  const filename = doc.original_filename ?? "policy";

  let extracted;
  try {
    extracted = await extractPolicy({ fileBytes, mimeType, filename });
  } catch (err) {
    const msg = err instanceof PolicyExtractionError ? err.message : String(err);
    await markFailed(doc.id, msg);
    return;
  }

  const r = extracted.result;

  // Update the insurance_policies row with the extracted fields. Don't
  // overwrite fields the user already filled in manually — coalesce nulls.
  const { data: existing } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("id", opts.insurancePolicyId)
    .maybeSingle();

  const isPlaceholder =
    !existing?.insurer_name || existing.insurer_name === "Pending extraction…";

  const update: InsurancePolicyUpdate = {
    // Only overwrite the placeholder; never clobber a name the user already
    // typed by hand.
    insurer_name: isPlaceholder ? r.insurer_name : existing?.insurer_name,
    plan_name: existing?.plan_name ?? r.plan_name,
    policy_number: existing?.policy_number ?? r.policy_number,
    premium_monthly_cents:
      existing?.premium_monthly_cents ??
      (r.premium_monthly_dollars !== null
        ? Math.round(r.premium_monthly_dollars * 100)
        : null),
    deductible_annual_cents:
      existing?.deductible_annual_cents ??
      (r.deductible_annual_dollars !== null
        ? Math.round(r.deductible_annual_dollars * 100)
        : null),
    annual_max_cents:
      existing?.annual_max_cents ??
      (r.annual_max_dollars !== null
        ? Math.round(r.annual_max_dollars * 100)
        : null),
    reimbursement_rate: existing?.reimbursement_rate ?? r.reimbursement_rate,
    effective_on: existing?.effective_on ?? r.effective_on,
    renews_on: existing?.renews_on ?? r.renews_on,
    extracted_exclusions:
      r.extracted_exclusions.length > 0
        ? r.extracted_exclusions
        : (existing?.extracted_exclusions ?? null),
    extracted_pec_definitions: {
      window_months: r.pre_existing_condition_window_months,
      definitions: r.pre_existing_condition_definitions,
    },
    notes: existing?.notes ?? r.notes,
  };

  await supabase
    .from("insurance_policies")
    .update(update)
    .eq("id", opts.insurancePolicyId);

  await supabase
    .from("documents")
    .update({
      processing_status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  await recordAudit({
    householdId: doc.household_id,
    actorId: null,
    action: "commit_extraction",
    entityType: "insurance_policy",
    entityId: opts.insurancePolicyId,
    diff: {
      after: {
        insurer_name: r.insurer_name,
        plan_name: r.plan_name,
        reimbursement_rate: r.reimbursement_rate,
        confidence_overall: r.confidence_overall,
        prompt_version: extracted.promptVersion,
        model: extracted.model,
      },
    },
  });
}

async function markFailed(documentId: string, message: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("documents")
    .update({ processing_status: "failed", error_message: message })
    .eq("id", documentId);
}
