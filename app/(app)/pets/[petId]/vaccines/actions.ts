"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { VaccinationActionPayload } from "@/lib/schemas/vaccination";

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

export async function createVaccination(
  input: VaccinationActionPayload,
): Promise<Result> {
  if (!input.vaccine_type) return { ok: false, error: "Vaccine type is required" };
  if (!input.administered_on) return { ok: false, error: "Administered date required" };

  const session = await requireSession();
  const supabase = await createClient();
  const clinicId = await resolveClinic(session.householdId, input.vet_clinic_name);

  const { error } = await supabase.from("vaccinations").insert({
    household_id: session.householdId,
    pet_id: input.pet_id,
    vaccine_type: input.vaccine_type,
    administered_on: input.administered_on,
    expires_on: input.expires_on,
    lot_number: input.lot_number,
    manufacturer: input.manufacturer,
    administering_vet: input.administering_vet,
    vet_clinic_id: clinicId,
    notes: input.notes,
    created_by: session.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pets/${input.pet_id}`);
  revalidatePath(`/pets/${input.pet_id}/vaccines`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteVaccination(input: { id: string; pet_id: string }): Promise<Result> {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("vaccinations")
    .delete()
    .eq("household_id", session.householdId)
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pets/${input.pet_id}`);
  revalidatePath(`/pets/${input.pet_id}/vaccines`);
  revalidatePath("/");
  return { ok: true };
}
