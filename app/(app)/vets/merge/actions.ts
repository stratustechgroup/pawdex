"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createServiceClient } from "@/lib/supabase/service";
import { recordAudit } from "@/lib/db/audit";

type Result = { ok: true; movedCount: number } | { ok: false; error: string };

/**
 * Merge a set of duplicate vet clinics into one keeper.
 * - Re-points all vaccinations / medications / medical_events to the keeper
 * - Deletes the merged-away clinics
 * - Audits the merge
 *
 * Uses the service client because we need to update + delete across rows
 * regardless of household_id RLS race conditions — the action verifies that
 * every clinic belongs to the caller's household before touching anything.
 */
export async function mergeVetClinics(input: {
  keeperId: string;
  mergeAwayIds: string[];
}): Promise<Result> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can merge clinics." };
  }
  if (!input.keeperId) return { ok: false, error: "Missing keeper" };
  if (input.mergeAwayIds.length === 0) {
    return { ok: false, error: "No duplicates selected to merge away." };
  }
  if (input.mergeAwayIds.includes(input.keeperId)) {
    return { ok: false, error: "Keeper can't also be in the merge-away list." };
  }

  const service = createServiceClient();

  // Verify ALL clinics belong to this household — single round trip.
  const allIds = [input.keeperId, ...input.mergeAwayIds];
  const { data: clinics, error: verifyErr } = await service
    .from("vet_clinics")
    .select("id, household_id, name")
    .in("id", allIds);

  if (verifyErr) return { ok: false, error: verifyErr.message };
  if (!clinics || clinics.length !== allIds.length) {
    return { ok: false, error: "One or more clinics not found." };
  }
  for (const c of clinics) {
    if (c.household_id !== session.householdId) {
      return { ok: false, error: "Clinic belongs to a different household." };
    }
  }

  // Re-point all dependent rows from mergeAwayIds → keeperId.
  let movedCount = 0;
  for (const table of ["vaccinations", "medications", "medical_events"] as const) {
    const { data: moved, error: mvErr } = await service
      .from(table)
      .update({ vet_clinic_id: input.keeperId })
      .in("vet_clinic_id", input.mergeAwayIds)
      .eq("household_id", session.householdId)
      .select("id");
    if (mvErr) {
      return {
        ok: false,
        error: `Failed to move ${table}: ${mvErr.message}`,
      };
    }
    movedCount += moved?.length ?? 0;
  }

  // Delete the merged-away clinics now that nothing points at them.
  const { error: delErr } = await service
    .from("vet_clinics")
    .delete()
    .in("id", input.mergeAwayIds)
    .eq("household_id", session.householdId);

  if (delErr) return { ok: false, error: `Failed to delete duplicates: ${delErr.message}` };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "vet_clinic",
    entityId: input.keeperId,
    diff: {
      after: {
        merged_into: input.keeperId,
        merged_away: input.mergeAwayIds,
        moved_row_count: movedCount,
      },
    },
  });

  revalidatePath("/vets");
  revalidatePath("/vets/merge");
  revalidatePath(`/vets/${input.keeperId}`);
  return { ok: true, movedCount };
}
