"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createClient } from "@/lib/supabase/server";
import type { MedicationActionPayload } from "@/lib/schemas/medication";

type Result = { ok: true } | { ok: false; error: string };

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
  // rule the document-review commit uses.
  let endedOn = input.ended_on;
  if (!endedOn && input.duration_days && input.duration_days > 0) {
    const start = new Date(input.started_on);
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + input.duration_days);
      endedOn = start.toISOString().slice(0, 10);
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
