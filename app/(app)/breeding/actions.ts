"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordAudit } from "@/lib/db/audit";
import { createLitter } from "@/lib/db/litters";
import {
  createAnimalWithCustodianship,
  setPlacementStatus,
} from "@/lib/db/animals";
import type { Database } from "@/lib/supabase/types";

type ActionError = { ok: false; error: string };

type PlacementStatus = Database["public"]["Enums"]["animal_placement_status"];
type PetSpecies = Database["public"]["Enums"]["pet_species"];
type PetSex = Database["public"]["Enums"]["pet_sex"];

/**
 * Flip the household into breeder mode. Owner-only, enforced server-side — the
 * UI hides the control for non-owners but the check here is what actually gates
 * it. Uses the service client because households writes are otherwise scoped and
 * we want a single authoritative path for the kind flip.
 */
export async function enableBreederMode(): Promise<ActionError | never> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can enable breeder tools." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("households")
    .update({ kind: "breeder" })
    .eq("id", session.householdId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "household",
    entityId: session.householdId,
    diff: { after: { kind: "breeder" } },
  });

  revalidatePath("/breeding");
  redirect("/breeding");
}

export async function createLitterAction(input: {
  name: string;
  damAnimalId: string;
  sireAnimalId: string | null;
  whelpedOn: string | null;
  notes: string | null;
}): Promise<ActionError | never> {
  const session = await requireSession();
  if (session.role === "viewer") {
    return { ok: false, error: "Viewers cannot create litters." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Litter name is required." };
  if (!input.damAnimalId) return { ok: false, error: "Pick a dam for the litter." };

  const litter = await createLitter({
    householdId: session.householdId,
    name,
    damAnimalId: input.damAnimalId,
    sireAnimalId: input.sireAnimalId,
    whelpedOn: input.whelpedOn,
    notes: input.notes?.trim() || null,
  });

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "litter",
    entityId: litter.id,
    diff: { after: { name, dam_animal_id: input.damAnimalId } },
  });

  revalidatePath("/breeding");
  redirect(`/breeding/${litter.id}`);
}

/**
 * Add a puppy to a litter: create the durable animal (with its litter and an
 * initial "available" placement) plus a linked pets row so the rest of the app
 * treats it like any other pet. The animal gets an OWNER custodianship in this
 * household — that is what later makes it transferable, since transfer_animal
 * hands over the active owner custodianship.
 */
export async function addPuppyAction(input: {
  litterId: string;
  name: string;
  species: PetSpecies;
  sex: PetSex;
  breed: string | null;
  dateOfBirth: string | null;
}): Promise<ActionError | { ok: true; petId: string }> {
  const session = await requireSession();
  if (session.role === "viewer") {
    return { ok: false, error: "Viewers cannot add puppies." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Puppy name is required." };

  const animal = await createAnimalWithCustodianship({
    animal: {
      name,
      species: input.species,
      sex: input.sex,
      breed: input.breed?.trim() || null,
      date_of_birth: input.dateOfBirth,
      litter_id: input.litterId,
      placement_status: "available",
      created_by: session.userId,
    },
    householdId: session.householdId,
    role: "owner",
    createdBy: session.userId,
  });

  // Create the linked legacy pet row via the service client so the animal_id
  // link is set atomically on insert (the pets->animals mirror trigger only
  // fires on UPDATE, so this insert will not clobber litter_id / placement).
  const service = createServiceClient();
  const { data: pet, error: petErr } = await service
    .from("pets")
    .insert({
      household_id: session.householdId,
      animal_id: animal.id,
      name,
      species: input.species,
      sex: input.sex,
      breed: input.breed?.trim() || null,
      date_of_birth: input.dateOfBirth,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (petErr || !pet) {
    return { ok: false, error: petErr?.message ?? "Failed to create puppy record." };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "animal",
    entityId: animal.id,
    diff: { after: { name, litter_id: input.litterId, pet_id: pet.id } },
  });

  revalidatePath(`/breeding/${input.litterId}`);
  return { ok: true, petId: pet.id };
}

export async function setPuppyPlacementAction(input: {
  litterId: string;
  animalId: string;
  status: PlacementStatus;
}): Promise<ActionError | { ok: true }> {
  const session = await requireSession();
  if (session.role === "viewer") {
    return { ok: false, error: "Viewers cannot change placement." };
  }

  await setPlacementStatus({ animalId: input.animalId, status: input.status });

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "animal",
    entityId: input.animalId,
    diff: { after: { placement_status: input.status } },
  });

  revalidatePath(`/breeding/${input.litterId}`);
  return { ok: true };
}
