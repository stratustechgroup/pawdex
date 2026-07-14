"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createServiceClient } from "@/lib/supabase/service";
import { recordAudit } from "@/lib/db/audit";
import { writeDeletionLog } from "@/lib/deletion/purge";

type Result = { ok: true } | { ok: false; error: string };

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Soft-delete a pet. Confirmation ladder rung 1: the caller must type the pet's
 * name, which we re-check server-side against the row. Reversible for 30 days
 * from the "recently deleted" list, then hard-purged by the daily job. Members
 * with write access can delete (it is reversible); viewers cannot.
 */
export async function softDeletePetAction(
  petId: string,
  typedName: string,
): Promise<Result> {
  const session = await requireSession();
  if (session.role === "viewer") {
    return { ok: false, error: "Viewers can't delete pets." };
  }

  const service = createServiceClient();
  const { data: pet, error } = await service
    .from("pets")
    .select("id, name, household_id, deleted_at")
    .eq("id", petId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!pet || pet.household_id !== session.householdId) {
    return { ok: false, error: "Pet not found in this household." };
  }
  if (pet.deleted_at) return { ok: true }; // already gone; idempotent

  if (!namesMatch(typedName, pet.name)) {
    return { ok: false, error: `Type "${pet.name}" exactly to confirm.` };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await service
    .from("pets")
    .update({ deleted_at: now, deleted_by: session.userId })
    .eq("id", petId)
    .eq("household_id", session.householdId);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "pet",
    entityId: petId,
    diff: { after: { deleted_at: now, mode: "soft" } },
  });
  await writeDeletionLog(service, {
    scope: "pet",
    subjectId: petId,
    householdId: session.householdId,
    actorUserId: session.userId,
    actorEmail: session.email,
    legalBasis: "user_request",
    action: "soft_delete",
    details: { pet_name: pet.name },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Restore a soft-deleted pet within its retention window. Idempotent; only
 * touches pets that are actually soft-deleted in the caller's household.
 */
export async function restorePetAction(petId: string): Promise<Result> {
  const session = await requireSession();
  if (session.role === "viewer") {
    return { ok: false, error: "Viewers can't restore pets." };
  }

  const service = createServiceClient();
  const { data: pet, error } = await service
    .from("pets")
    .select("id, name, household_id, deleted_at")
    .eq("id", petId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!pet || pet.household_id !== session.householdId) {
    return { ok: false, error: "Pet not found in this household." };
  }
  if (!pet.deleted_at) return { ok: true };

  const { error: updErr } = await service
    .from("pets")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", petId)
    .eq("household_id", session.householdId);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "pet",
    entityId: petId,
    diff: { after: { restored: true } },
  });
  await writeDeletionLog(service, {
    scope: "pet",
    subjectId: petId,
    householdId: session.householdId,
    actorUserId: session.userId,
    actorEmail: session.email,
    legalBasis: "user_request",
    action: "restore",
    details: { pet_name: pet.name },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
