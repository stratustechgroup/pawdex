"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createServiceClient } from "@/lib/supabase/service";

function asNumber(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asString(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function addLabValue(formData: FormData): Promise<void> {
  const petId = String(formData.get("pet_id") ?? "");
  if (!petId) throw new Error("pet_id required");
  const analyte = asString(formData.get("analyte"));
  const value = asNumber(formData.get("value"));
  const collected = String(formData.get("collected_on") ?? "");
  if (!analyte) throw new Error("Analyte name required.");
  if (value === null) throw new Error("Value required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(collected)) throw new Error("Date required.");

  const session = await requireSession();
  const supabase = createServiceClient();

  const { data: pet } = await supabase
    .from("pets")
    .select("id, household_id")
    .eq("id", petId)
    .maybeSingle();
  if (!pet || pet.household_id !== session.householdId) {
    throw new Error("Pet not found in this household.");
  }

  const refLow = asNumber(formData.get("reference_low"));
  const refHigh = asNumber(formData.get("reference_high"));
  let flag: string | null = asString(formData.get("flag"));
  if (!flag && refLow !== null && refHigh !== null) {
    if (value < refLow) flag = "L";
    else if (value > refHigh) flag = "H";
    else flag = "normal";
  }

  const { data, error } = await supabase
    .from("lab_values")
    .insert({
      household_id: session.householdId,
      pet_id: petId,
      analyte,
      value,
      units: asString(formData.get("units")),
      reference_low: refLow,
      reference_high: refHigh,
      flag,
      collected_on: collected,
      lab: asString(formData.get("lab")),
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "lab_value",
    entityId: data.id,
    diff: {
      after: { pet_id: petId, analyte, value, collected_on: collected, flag },
    },
  });

  revalidatePath(`/pets/${petId}/labs`);
}

export async function deleteLabValue(formData: FormData): Promise<void> {
  const id = String(formData.get("lab_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  if (!id || !petId) throw new Error("lab_id + pet_id required");
  const session = await requireSession();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("lab_values")
    .delete()
    .eq("id", id)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Delete failed: ${error.message}`);
  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "lab_value",
    entityId: id,
  });
  revalidatePath(`/pets/${petId}/labs`);
}
