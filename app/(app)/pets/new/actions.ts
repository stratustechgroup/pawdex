"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { PetActionPayload } from "@/lib/schemas/pet";

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
      color: payload.color,
      markings: payload.markings,
      microchip_number: payload.microchip_number,
      microchip_registry: payload.microchip_registry,
      current_weight_kg: payload.current_weight_kg,
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
