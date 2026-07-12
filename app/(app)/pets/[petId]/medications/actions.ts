"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createClient } from "@/lib/supabase/server";
import { estimateCourseEnd } from "@/lib/clinical/course-duration";
import type { MedicationActionPayload } from "@/lib/schemas/medication";

type Result = { ok: true } | { ok: false; error: string };

/**
 * "Still taking it" correction. A course whose estimated end has passed drops
 * off the Active list; if the pet is in fact still on it, this clears the
 * estimated end so it's active again. Only clears ends WE estimated
 * (ended_estimated = true) — an explicit vet-stated end is never silently
 * reopened.
 */
export async function markStillTaking(input: {
  petId: string;
  medicationId: string;
}): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: med } = await supabase
    .from("medications")
    .select("id, ended_estimated")
    .eq("household_id", session.householdId)
    .eq("id", input.medicationId)
    .maybeSingle();
  if (!med) return { ok: false, error: "Medication not found" };
  if (!med.ended_estimated) {
    return {
      ok: false,
      error: "This medication has an end date from the document, not an estimate.",
    };
  }

  const { error } = await supabase
    .from("medications")
    .update({ ended_on: null, ended_estimated: false })
    .eq("household_id", session.householdId)
    .eq("id", input.medicationId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "medication",
    entityId: input.medicationId,
    diff: { after: { ended_on: null, ended_estimated: false, correction: "still_taking" } },
  });

  revalidatePath(`/pets/${input.petId}`);
  revalidatePath(`/pets/${input.petId}/medications`);
  revalidatePath("/");
  return { ok: true };
}

async function resolveClinic(
  householdId: string,
  name: string | null,
): Promise<string | null> {
  if (!name) return null;
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from("vet_clinics")
    .select("id")
    .eq("household_id", householdId)
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("vet_clinics")
    .insert({ household_id: householdId, name: trimmed })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

export async function createMedication(
  input: MedicationActionPayload,
): Promise<Result> {
  if (!input.name) return { ok: false, error: "Medication name is required" };
  if (!input.dose) return { ok: false, error: "Dose is required" };
  if (!input.started_on) return { ok: false, error: "Start date is required" };

  const session = await requireSession();
  const supabase = await createClient();
  const clinicId = await resolveClinic(session.householdId, input.vet_clinic_name);

  // When ended_on isn't provided but a duration is, compute it from started_on
  // so the medication auto-rolls off "active" once the course completes — same
  // rule the document-review commit uses. A computed end is flagged estimated so
  // it stays correctable via "still taking it".
  let endedOn = input.ended_on;
  let endedEstimated = false;
  if (!endedOn) {
    const estimate = estimateCourseEnd({
      started_on: input.started_on,
      duration_days: input.duration_days,
    });
    if (estimate) {
      endedOn = estimate.ended_on;
      endedEstimated = true;
    }
  }

  const { data: inserted, error } = await supabase
    .from("medications")
    .insert({
      household_id: session.householdId,
      pet_id: input.pet_id,
      name: input.name,
      dose: input.dose,
      frequency: input.frequency,
      started_on: input.started_on,
      ended_on: endedOn,
      ended_estimated: endedEstimated,
      duration_days: input.duration_days,
      medication_context: input.medication_context,
      prescriber: input.prescriber,
      indication: input.indication,
      vet_clinic_id: clinicId,
      notes: input.notes,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Failed to add medication" };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "medication",
    entityId: inserted.id,
    diff: {
      after: {
        name: input.name,
        dose: input.dose,
        started_on: input.started_on,
        ended_on: endedOn,
        medication_context: input.medication_context,
      },
    },
  });

  revalidatePath(`/pets/${input.pet_id}`);
  revalidatePath(`/pets/${input.pet_id}/medications`);
  revalidatePath("/");
  return { ok: true };
}
