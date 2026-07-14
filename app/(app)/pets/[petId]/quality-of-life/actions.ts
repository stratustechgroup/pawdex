"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { QOL_DIMENSIONS } from "@/lib/db/qol";
import { createServiceClient } from "@/lib/supabase/service";

function parseScore(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export async function saveQolEntry(formData: FormData): Promise<void> {
  const petId = String(formData.get("pet_id") ?? "");
  const recordedOn = String(formData.get("recorded_on") ?? "");
  if (!petId) throw new Error("pet_id is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn)) {
    throw new Error("recorded_on must be ISO YYYY-MM-DD");
  }

  const scores: Record<string, number> = {};
  for (const dim of QOL_DIMENSIONS) {
    const v = parseScore(formData.get(dim.key));
    if (v === null) throw new Error(`Missing or invalid score for ${dim.label}`);
    scores[dim.key] = v;
  }

  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't record quality-of-life entries.");
  const supabase = createServiceClient();

  // Validate pet belongs to household.
  const { data: pet } = await supabase
    .from("pets")
    .select("id, household_id, name")
    .eq("id", petId)
    .maybeSingle();
  if (!pet || pet.household_id !== session.householdId) {
    throw new Error("Pet not found in this household.");
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { data, error } = await supabase
    .from("qol_entries")
    .upsert(
      {
        household_id: session.householdId,
        pet_id: petId,
        recorded_on: recordedOn,
        hurt: scores.hurt,
        hunger: scores.hunger,
        hydration: scores.hydration,
        hygiene: scores.hygiene,
        happiness: scores.happiness,
        mobility: scores.mobility,
        more_good: scores.more_good,
        notes,
        created_by: session.userId,
      },
      { onConflict: "pet_id,recorded_on" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "qol_entry",
    entityId: data.id,
    diff: { after: { pet_id: petId, recorded_on: recordedOn, scores } },
  });

  revalidatePath(`/pets/${petId}/quality-of-life`);
}

export async function deleteQolEntry(formData: FormData): Promise<void> {
  const id = String(formData.get("entry_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  if (!id || !petId) throw new Error("entry_id + pet_id required");
  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't delete quality-of-life entries.");
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("qol_entries")
    .delete()
    .eq("id", id)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Delete failed: ${error.message}`);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "qol_entry",
    entityId: id,
  });

  revalidatePath(`/pets/${petId}/quality-of-life`);
}
