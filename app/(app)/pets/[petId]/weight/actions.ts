"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export type LogWeightInput = {
  pet_id: string;
  recorded_on: string;
  weight_kg: number;
  notes?: string | null;
};

export async function logWeight(input: LogWeightInput): Promise<Result> {
  if (!input.pet_id) return { ok: false, error: "Pet is required" };
  if (!input.recorded_on) return { ok: false, error: "Date is required" };
  if (!Number.isFinite(input.weight_kg) || input.weight_kg <= 0) {
    return { ok: false, error: "Weight must be greater than zero" };
  }

  const session = await requireSession();
  const supabase = await createClient();

  // Confirm the pet actually lives in this household before writing — RLS will
  // also block cross-household writes, but failing loudly here gives a better
  // error than a generic insert error.
  const { data: pet, error: petErr } = await supabase
    .from("pets")
    .select("id, household_id")
    .eq("household_id", session.householdId)
    .eq("id", input.pet_id)
    .maybeSingle();

  if (petErr) return { ok: false, error: petErr.message };
  if (!pet) return { ok: false, error: "Pet not found" };

  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const { data: inserted, error: insertErr } = await supabase
    .from("weight_log")
    .insert({
      household_id: session.householdId,
      pet_id: input.pet_id,
      recorded_on: input.recorded_on,
      weight_kg: input.weight_kg,
      source: "manual",
      notes,
      created_by: session.userId,
    })
    .select("id, recorded_on, weight_kg")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Failed to log weight" };
  }

  // If this entry is the newest weight on file for the pet, mirror it onto the
  // pet row so the header shows the latest value without an extra query.
  const { data: newest } = await supabase
    .from("weight_log")
    .select("id, recorded_on, weight_kg")
    .eq("household_id", session.householdId)
    .eq("pet_id", input.pet_id)
    .order("recorded_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (newest && newest.id === inserted.id) {
    await supabase
      .from("pets")
      .update({ current_weight_kg: input.weight_kg })
      .eq("household_id", session.householdId)
      .eq("id", input.pet_id);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "weight_log",
    entityId: inserted.id,
    diff: {
      after: {
        weight_kg: input.weight_kg,
        recorded_on: input.recorded_on,
      },
    },
  });

  revalidatePath(`/pets/${input.pet_id}/weight`);
  revalidatePath(`/pets/${input.pet_id}`);
  revalidatePath("/");

  return { ok: true };
}
