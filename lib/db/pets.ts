import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Pet, Vaccination } from "@/lib/supabase/types";

export type PetWithStatus = Pet & {
  next_due_label: string | null;
  status: "up_to_date" | "due_soon" | "overdue" | "incomplete";
};

export async function listPetsForHousehold(
  householdId: string,
): Promise<PetWithStatus[]> {
  const supabase = await createClient();

  const { data: pets, error } = await supabase
    .from("pets")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`listPets: ${error.message}`);
  }

  const petRows = (pets ?? []) as Pet[];
  if (petRows.length === 0) return [];

  const ids = petRows.map((p) => p.id);
  const { data: vaccines, error: vaccErr } = await supabase
    .from("vaccinations")
    .select("pet_id, vaccine_type, expires_on")
    .in("pet_id", ids);

  if (vaccErr) {
    throw new Error(`listPets vaccines: ${vaccErr.message}`);
  }

  const byPet = new Map<string, { vaccine_type: string; expires_on: string | null }[]>();
  for (const v of (vaccines ?? []) as Pick<Vaccination, "pet_id" | "vaccine_type" | "expires_on">[]) {
    const arr = byPet.get(v.pet_id) ?? [];
    arr.push({ vaccine_type: v.vaccine_type, expires_on: v.expires_on });
    byPet.set(v.pet_id, arr);
  }

  return petRows.map((pet) => {
    const vacs = byPet.get(pet.id) ?? [];
    if (vacs.length === 0) {
      return { ...pet, status: "incomplete", next_due_label: null };
    }

    const now = new Date();
    let soonest: { type: string; days: number } | null = null;
    let overdueLabel: { type: string; days: number } | null = null;

    for (const v of vacs) {
      if (!v.expires_on) continue;
      const exp = new Date(v.expires_on);
      if (Number.isNaN(exp.getTime())) continue;
      const days = Math.round((exp.getTime() - now.getTime()) / 86_400_000);
      if (days < 0) {
        if (!overdueLabel || days < overdueLabel.days) {
          overdueLabel = { type: v.vaccine_type, days };
        }
      } else if (!soonest || days < soonest.days) {
        soonest = { type: v.vaccine_type, days };
      }
    }

    if (overdueLabel) {
      return {
        ...pet,
        status: "overdue",
        next_due_label: `${overdueLabel.type} overdue by ${Math.abs(overdueLabel.days)} d`,
      };
    }
    if (soonest && soonest.days <= 30) {
      return {
        ...pet,
        status: "due_soon",
        next_due_label: `${soonest.type} due in ${soonest.days} d`,
      };
    }
    if (soonest) {
      return {
        ...pet,
        status: "up_to_date",
        next_due_label: `Next: ${soonest.type} in ${soonest.days} d`,
      };
    }
    return { ...pet, status: "incomplete", next_due_label: null };
  });
}

export async function getPet(
  householdId: string,
  petId: string,
): Promise<Pet | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", petId)
    .maybeSingle();

  if (error) throw new Error(`getPet: ${error.message}`);
  return (data as Pet | null) ?? null;
}
