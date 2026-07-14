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
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`listPets: ${error.message}`);
  }

  const petRows = (pets ?? []) as Pet[];
  if (petRows.length === 0) return [];

  const ids = petRows.map((p) => p.id);
  const { data: vaccines, error: vaccErr } = await supabase
    .from("vaccinations")
    .select("pet_id, vaccine_type, vaccine_family, administered_on, expires_on")
    .in("pet_id", ids)
    .order("administered_on", { ascending: false });

  if (vaccErr) {
    throw new Error(`listPets vaccines: ${vaccErr.message}`);
  }

  // Reduce to the latest-per-family per pet — multiple historical entries for
  // the same vaccine (e.g. 6 rabies certs over 6 years) collapse to the most
  // recent dose, which is the one whose expiration drives the status badge.
  type SlimVacc = Pick<
    Vaccination,
    "pet_id" | "vaccine_type" | "vaccine_family" | "administered_on" | "expires_on"
  >;
  const byPet = new Map<string, SlimVacc[]>();
  const seenPerPet = new Map<string, Set<string>>(); // pet_id -> set of families already kept
  for (const v of (vaccines ?? []) as SlimVacc[]) {
    const key =
      v.vaccine_family ?? `__type:${v.vaccine_type.toLowerCase().trim()}`;
    let seen = seenPerPet.get(v.pet_id);
    if (!seen) {
      seen = new Set();
      seenPerPet.set(v.pet_id, seen);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const arr = byPet.get(v.pet_id) ?? [];
    arr.push(v);
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
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getPet: ${error.message}`);
  return (data as Pet | null) ?? null;
}
