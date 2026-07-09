"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createClient } from "@/lib/supabase/server";
import { maybeScheduleRecordsRequest } from "@/lib/outbound/records-request-schedule";
import type { MedicalEventActionPayload } from "@/lib/schemas/medical-event";

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

export async function createMedicalEvent(
  input: MedicalEventActionPayload,
): Promise<Result> {
  if (!input.title) return { ok: false, error: "Title is required" };
  if (!input.occurred_on) return { ok: false, error: "Date is required" };
  if (!input.event_type) return { ok: false, error: "Event type is required" };

  const session = await requireSession();
  const supabase = await createClient();
  const clinicId = await resolveClinic(session.householdId, input.vet_clinic_name);

  const { data: inserted, error } = await supabase
    .from("medical_events")
    .insert({
      household_id: session.householdId,
      pet_id: input.pet_id,
      event_type: input.event_type,
      occurred_on: input.occurred_on,
      title: input.title,
      summary: input.summary,
      diagnosis: input.diagnosis,
      treatment: input.treatment,
      attending_vet: input.attending_vet,
      vet_clinic_id: clinicId,
      notes: input.notes,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Failed to add event" };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "medical_event",
    entityId: inserted.id,
    diff: {
      after: {
        event_type: input.event_type,
        occurred_on: input.occurred_on,
        title: input.title,
        diagnosis: input.diagnosis,
      },
    },
  });

  revalidatePath(`/pets/${input.pet_id}`);
  revalidatePath(`/pets/${input.pet_id}/medical`);
  revalidatePath("/");

  // Hook the auto-schedule for records requests when the household opted in.
  // Best-effort — never block the manual entry path.
  after(async () => {
    try {
      await maybeScheduleRecordsRequest({
        householdId: session.householdId,
        medicalEventId: inserted.id,
        createdBy: session.userId,
      });
    } catch (err) {
      console.error("maybeScheduleRecordsRequest failed", { err });
    }
  });

  return { ok: true };
}
