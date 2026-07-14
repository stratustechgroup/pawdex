import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/types";
import { teardownHouseholdBilling } from "@/lib/deletion/billing-teardown";
import {
  purgeHouseholdStorage,
  purgePetStorage,
} from "@/lib/deletion/storage";

type Service = SupabaseClient<Database>;

export type LegalBasis = "user_request" | "ccpa_immediate" | "retention_purge";

// Days a soft-deleted row stays restorable before the daily job hard-purges it.
export const RETENTION_DAYS = 30;

type LogInput = {
  scope: "pet" | "household" | "account";
  subjectId: string | null;
  householdId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  legalBasis: LegalBasis;
  action: "soft_delete" | "restore" | "hard_purge";
  details?: Json;
};

/**
 * Write to the durable deletion ledger. deletion_log has no FK to households or
 * auth.users, so this trace survives the very cascade / auth deletion it
 * records. Never throws: the ledger is evidence, not the user's blocker.
 */
export async function writeDeletionLog(
  service: Service,
  input: LogInput,
): Promise<void> {
  try {
    await service.from("deletion_log").insert({
      scope: input.scope,
      subject_id: input.subjectId,
      household_id: input.householdId,
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail,
      legal_basis: input.legalBasis,
      action: input.action,
      details: input.details ?? {},
    });
  } catch (err) {
    console.error("writeDeletionLog failed:", err);
  }
}

// ============================================================
// Pet hard purge
// ============================================================

export type PurgePetInput = {
  householdId: string;
  petId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  legalBasis: LegalBasis;
};

/**
 * Permanently remove a pet: its documents (which the pets FK only SET NULLs, so
 * they would otherwise be stranded as "unsorted"), the pet row itself (which
 * cascades vaccinations, medical_events, medications, reminders, weights,
 * qol_entries, lab_values, administrations, price_quotes, claims,
 * cost_estimates, insurance_policies, share_links, extraction_chunks,
 * document_pet_links, ingestion_v2), and the pet's storage prefix. The linked
 * animal identity row is intentionally left alone (pets.animal_id is SET NULL);
 * an animal is decoupled from any one pet by design.
 */
export async function hardPurgePet(
  service: Service,
  input: PurgePetInput,
): Promise<{ ok: boolean; error?: string; details: Json }> {
  const { householdId, petId } = input;

  // Confirm scope before mutating.
  const { data: pet, error: petErr } = await service
    .from("pets")
    .select("id, household_id, name")
    .eq("id", petId)
    .maybeSingle();
  if (petErr) return { ok: false, error: petErr.message, details: {} };
  if (!pet || pet.household_id !== householdId) {
    return { ok: false, error: "Pet not in this household.", details: {} };
  }

  // 1. Delete the pet's documents (SET NULL edge → delete explicitly so their
  //    files + extraction artifacts go with the pet). Cascades extractions,
  //    feedback, chunks, links.
  const { data: docs } = await service
    .from("documents")
    .select("id")
    .eq("household_id", householdId)
    .eq("pet_id", petId);
  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length > 0) {
    await service.from("documents").delete().in("id", docIds);
  }

  // 2. Delete the pet row, cascades every pet-scoped child table.
  const { error: delErr } = await service
    .from("pets")
    .delete()
    .eq("id", petId)
    .eq("household_id", householdId);
  if (delErr) return { ok: false, error: delErr.message, details: {} };

  // 3. Purge the pet's storage prefix in both buckets.
  const storage = await purgePetStorage(service, householdId, petId);

  const details: Json = {
    pet_name: pet.name,
    documents_deleted: docIds.length,
    storage_removed: storage,
  };

  await writeDeletionLog(service, {
    scope: "pet",
    subjectId: petId,
    householdId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    legalBasis: input.legalBasis,
    action: "hard_purge",
    details,
  });

  return { ok: true, details };
}

// ============================================================
// Household hard purge
// ============================================================

export type PurgeHouseholdInput = {
  householdId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  legalBasis: LegalBasis;
};

/**
 * Permanently remove a household and everything under it, in FK-safe order.
 *
 * The three ON DELETE RESTRICT edges in the schema are cleared first:
 *   - outbound_emails.authorization_id  → authorizations (RESTRICT)
 *   - research_consents.authorization_id → authorizations (RESTRICT)
 *   - litters.dam_animal_id             → animals (RESTRICT)
 * Deleting outbound_emails + research_consents + litters for this household
 * releases all three, after which deleting the household row cascades the rest
 * (members, invitations, audit_log, pets+children, documents+children,
 * authorizations, custodianships, billing, transfers, inbound addresses, ...).
 *
 * Animals are a decoupled, transferable identity anchor and are NOT deleted
 * wholesale. But an animal that this household solely held becomes orphaned
 * personal data once the household is gone, so we delete captured animals that
 * (a) have no remaining active custodianship, (b) are not the dam of any
 * surviving litter, and (c) are not part of a released research dataset. That
 * closes the CCPA erasure gap without touching animals still held elsewhere.
 */
export async function hardPurgeHousehold(
  service: Service,
  input: PurgeHouseholdInput,
): Promise<{ ok: boolean; error?: string; details: Json }> {
  const { householdId } = input;

  const { data: household, error: hhErr } = await service
    .from("households")
    .select("id, name")
    .eq("id", householdId)
    .maybeSingle();
  if (hhErr) return { ok: false, error: hhErr.message, details: {} };
  if (!household) return { ok: false, error: "Household not found.", details: {} };

  // Counts for the durable log (best-effort, before we delete anything).
  const [{ count: petCount }, { count: docCount }] = await Promise.all([
    service.from("pets").select("id", { head: true, count: "exact" }).eq("household_id", householdId),
    service.from("documents").select("id", { head: true, count: "exact" }).eq("household_id", householdId),
  ]);

  // Capture animal ids this household has ever held, to evaluate for orphan
  // cleanup after the cascade removes this household's custodianships.
  const { data: custRows } = await service
    .from("custodianships")
    .select("animal_id")
    .eq("household_id", householdId);
  const heldAnimalIds = [...new Set((custRows ?? []).map((c) => c.animal_id))];

  // Stripe teardown while billing_customers / subscriptions still exist.
  const billing = await teardownHouseholdBilling(service, householdId);

  // Clear the RESTRICT edges for this household.
  await service.from("outbound_emails").delete().eq("household_id", householdId);
  await service.from("research_consents").delete().eq("household_id", householdId);
  await service.from("litters").delete().eq("household_id", householdId);

  // Delete the household, cascades the remainder.
  const { error: delErr } = await service
    .from("households")
    .delete()
    .eq("id", householdId);
  if (delErr) return { ok: false, error: delErr.message, details: {} };

  // Orphan-animal cleanup.
  const orphansDeleted = await purgeOrphanedAnimals(service, heldAnimalIds);

  // Storage prefix for the whole household.
  const storage = await purgeHouseholdStorage(service, householdId);

  const details: Json = {
    household_name: household.name,
    pets: petCount ?? 0,
    documents: docCount ?? 0,
    animals_considered: heldAnimalIds.length,
    animals_orphaned_deleted: orphansDeleted,
    storage_removed: storage,
    billing_teardown: billing as unknown as Json,
  };

  await writeDeletionLog(service, {
    scope: "household",
    subjectId: householdId,
    householdId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    legalBasis: input.legalBasis,
    action: "hard_purge",
    details,
  });

  return { ok: true, details };
}

/**
 * Delete the animals in `animalIds` that are now truly orphaned: no active
 * custodianship remains, they are not the dam of any surviving litter, and they
 * are not referenced by a released research dataset. Each delete is guarded so
 * a lingering cross-household RESTRICT can't abort the whole purge.
 */
async function purgeOrphanedAnimals(
  service: Service,
  animalIds: string[],
): Promise<number> {
  if (animalIds.length === 0) return 0;
  let deleted = 0;

  for (const animalId of animalIds) {
    // (a) still held somewhere?
    const { count: activeCust } = await service
      .from("custodianships")
      .select("id", { head: true, count: "exact" })
      .eq("animal_id", animalId)
      .is("ended_at", null);
    if ((activeCust ?? 0) > 0) continue;

    // (b) dam of a surviving litter?
    const { count: asDam } = await service
      .from("litters")
      .select("id", { head: true, count: "exact" })
      .eq("dam_animal_id", animalId);
    if ((asDam ?? 0) > 0) continue;

    // (c) part of a released research dataset?
    const { count: released } = await service
      .from("dataset_release_items")
      .select("id", { head: true, count: "exact" })
      .eq("source_table", "animals")
      .eq("source_row_id", animalId);
    if ((released ?? 0) > 0) continue;

    const { error } = await service.from("animals").delete().eq("id", animalId);
    if (error) {
      console.error(`purge orphan animal ${animalId}: ${error.message}`);
    } else {
      deleted += 1;
    }
  }

  return deleted;
}

// ============================================================
// Account hard purge
// ============================================================

export type PurgeAccountInput = {
  userId: string;
  actorEmail: string | null;
  legalBasis: LegalBasis;
};

/**
 * Recompute which households the user SOLELY owns (owner role, no other owner).
 * These must be purged with the account; households with another owner just
 * lose this user's membership when auth.users is deleted.
 */
export async function soleOwnedHouseholds(
  service: Service,
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data: owned } = await service
    .from("household_members")
    .select("household_id, households(id, name, deleted_at)")
    .eq("user_id", userId)
    .eq("role", "owner");

  const result: Array<{ id: string; name: string }> = [];
  for (const row of owned ?? []) {
    const hh = row.households as unknown as {
      id: string;
      name: string;
    } | null;
    if (!hh) continue;
    const { count: otherOwners } = await service
      .from("household_members")
      .select("user_id", { head: true, count: "exact" })
      .eq("household_id", row.household_id)
      .eq("role", "owner")
      .neq("user_id", userId);
    if ((otherOwners ?? 0) === 0) {
      result.push({ id: hh.id, name: hh.name });
    }
  }
  return result;
}

/**
 * Permanently remove a user account: hard-purge every household they solely
 * own, then delete the auth.users row (which cascades household_members,
 * profiles, and the account_deletions grace row). The durable deletion_log
 * entries written here and by each household purge survive that deletion.
 */
export async function hardPurgeAccount(
  service: Service,
  input: PurgeAccountInput,
): Promise<{ ok: boolean; error?: string; details: Json }> {
  const { userId } = input;

  const sole = await soleOwnedHouseholds(service, userId);
  const purgedHouseholds: Array<{ id: string; name: string; ok: boolean }> = [];
  for (const hh of sole) {
    const r = await hardPurgeHousehold(service, {
      householdId: hh.id,
      actorUserId: userId,
      actorEmail: input.actorEmail,
      legalBasis: input.legalBasis,
    });
    purgedHouseholds.push({ id: hh.id, name: hh.name, ok: r.ok });
  }

  // Mark the grace row completed before we delete the user (it cascades away).
  await service
    .from("account_deletions")
    .update({ status: "completed" })
    .eq("user_id", userId);

  const details: Json = {
    sole_owned_households: purgedHouseholds as unknown as Json,
  };

  // Durable account-level trace, written BEFORE the auth deletion.
  await writeDeletionLog(service, {
    scope: "account",
    subjectId: userId,
    householdId: null,
    actorUserId: userId,
    actorEmail: input.actorEmail,
    legalBasis: input.legalBasis,
    action: "hard_purge",
    details,
  });

  // Finally, remove the auth identity. Only profiles + household_members cascade
  // from auth.users, so everything else had to be handled above.
  const { error: authErr } = await service.auth.admin.deleteUser(userId);
  if (authErr) {
    return { ok: false, error: `auth deleteUser: ${authErr.message}`, details };
  }

  return { ok: true, details };
}
