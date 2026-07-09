"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { diffOf, recordAudit } from "@/lib/db/audit";
import type { PetActionPayload } from "@/lib/schemas/pet";

// Fields tracked in the pet diff. Keep these in sync with the columns we
// actually update from the form below.
const TRACKED_FIELDS = [
  "name",
  "species",
  "breed",
  "sex",
  "altered",
  "date_of_birth",
  "dob_is_estimated",
  "acquired_on",
  "color",
  "markings",
  "microchip_number",
  "microchip_registry",
  "microchip_implanted_on",
  "current_weight_kg",
  "allergies",
  "notes",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

function pickTracked(
  row: Record<string, unknown>,
): Record<TrackedField, unknown> {
  const out = {} as Record<TrackedField, unknown>;
  for (const k of TRACKED_FIELDS) out[k] = row[k] ?? null;
  return out;
}

export async function createPet(
  payload: PetActionPayload,
): Promise<{ ok: false; error: string } | never> {
  if (!payload.name) {
    return { ok: false, error: "Name is required." };
  }
  const session = await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pets")
    .insert({
      household_id: session.householdId,
      name: payload.name,
      species: payload.species,
      breed: payload.breed,
      sex: payload.sex,
      altered: payload.altered,
      date_of_birth: payload.date_of_birth,
      dob_is_estimated: payload.dob_is_estimated,
      acquired_on: payload.acquired_on,
      color: payload.color,
      markings: payload.markings,
      microchip_number: payload.microchip_number,
      microchip_registry: payload.microchip_registry,
      microchip_implanted_on: payload.microchip_implanted_on,
      current_weight_kg: payload.current_weight_kg,
      allergies: payload.allergies,
      notes: payload.notes,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create pet" };
  }

  revalidatePath("/");
  redirect(`/pets/${data.id}`);
}

export async function updatePet(
  petId: string,
  payload: PetActionPayload,
): Promise<{ ok: false; error: string } | never> {
  if (!petId) return { ok: false, error: "Missing pet id" };
  if (!payload.name) return { ok: false, error: "Name is required." };

  const session = await requireSession();
  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("pets")
    .select("*")
    .eq("household_id", session.householdId)
    .eq("id", petId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Pet not found" };

  const update = {
    name: payload.name,
    species: payload.species,
    breed: payload.breed,
    sex: payload.sex,
    altered: payload.altered,
    date_of_birth: payload.date_of_birth,
    dob_is_estimated: payload.dob_is_estimated,
    acquired_on: payload.acquired_on,
    color: payload.color,
    markings: payload.markings,
    microchip_number: payload.microchip_number,
    microchip_registry: payload.microchip_registry,
    microchip_implanted_on: payload.microchip_implanted_on,
    current_weight_kg: payload.current_weight_kg,
    allergies: payload.allergies,
    notes: payload.notes,
  };

  const { data: updated, error: updErr } = await supabase
    .from("pets")
    .update(update)
    .eq("household_id", session.householdId)
    .eq("id", petId)
    .select("*")
    .single();

  if (updErr || !updated) {
    return { ok: false, error: updErr?.message ?? "Failed to update pet" };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "pet",
    entityId: petId,
    diff: diffOf(
      pickTracked(existing as Record<string, unknown>),
      pickTracked(updated as Record<string, unknown>),
    ),
  });

  revalidatePath("/");
  revalidatePath(`/pets/${petId}`);
  revalidatePath(`/pets/${petId}/edit`);
  redirect(`/pets/${petId}`);
}

export async function archivePet(
  petId: string,
): Promise<{ ok: false; error: string } | never> {
  if (!petId) return { ok: false, error: "Missing pet id" };

  const session = await requireSession();
  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("pets")
    .select("id, name, archived_at")
    .eq("household_id", session.householdId)
    .eq("id", petId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Pet not found" };

  const archivedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("pets")
    .update({ archived_at: archivedAt })
    .eq("household_id", session.householdId)
    .eq("id", petId);

  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "archive",
    entityType: "pet",
    entityId: petId,
    diff: diffOf(
      { archived_at: existing.archived_at },
      { archived_at: archivedAt },
    ),
  });

  revalidatePath("/");
  revalidatePath(`/pets/${petId}`);
  redirect("/");
}
