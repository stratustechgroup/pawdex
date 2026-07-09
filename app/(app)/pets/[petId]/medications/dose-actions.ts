"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createServiceClient } from "@/lib/supabase/service";

export async function markDoseGiven(formData: FormData): Promise<void> {
  const medicationId = String(formData.get("medication_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  if (!medicationId || !petId) throw new Error("medication_id + pet_id required");

  const session = await requireSession();
  const supabase = createServiceClient();

  // Validate the medication belongs to this household + pet.
  const { data: med } = await supabase
    .from("medications")
    .select("id, household_id, pet_id, name")
    .eq("id", medicationId)
    .maybeSingle();
  if (!med || med.household_id !== session.householdId || med.pet_id !== petId) {
    throw new Error("Medication not found in this household.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("medication_administrations")
    .insert({
      household_id: session.householdId,
      pet_id: petId,
      medication_id: medicationId,
      administered_on: today,
      administered_at: now,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to record dose: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "medication_administration",
    entityId: data.id,
    diff: {
      after: { medication_id: medicationId, administered_on: today, medication_name: med.name },
    },
  });

  revalidatePath(`/pets/${petId}/medications`);
}

export async function undoDose(formData: FormData): Promise<void> {
  const administrationId = String(formData.get("administration_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  if (!administrationId || !petId) {
    throw new Error("administration_id + pet_id required");
  }
  const session = await requireSession();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("medication_administrations")
    .delete()
    .eq("id", administrationId)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Undo failed: ${error.message}`);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "medication_administration",
    entityId: administrationId,
  });

  revalidatePath(`/pets/${petId}/medications`);
}
