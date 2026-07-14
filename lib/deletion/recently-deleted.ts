import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { RETENTION_DAYS } from "@/lib/deletion/purge";

export type DeletedPet = {
  id: string;
  name: string;
  deletedAt: string;
  daysRemaining: number;
};

export type DeletedHousehold = {
  id: string;
  name: string;
  deletedAt: string;
  daysRemaining: number;
};

/**
 * Days left before a soft-deleted row is hard-purged. Clamped at 0 so a row
 * already past the window (waiting for the next cron tick) never shows negative.
 */
export function daysRemaining(deletedAtIso: string): number {
  const deleted = new Date(deletedAtIso).getTime();
  const purgeAt = deleted + RETENTION_DAYS * 86_400_000;
  const left = Math.ceil((purgeAt - Date.now()) / 86_400_000);
  return Math.max(0, left);
}

/**
 * Soft-deleted pets in one household, for the "recently deleted" restore list.
 * Uses the service client precisely because it must SEE deleted rows, which the
 * normal helpers filter out. Scoped to the household id passed by the caller,
 * which has already been authorized.
 */
export async function listDeletedPets(householdId: string): Promise<DeletedPet[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("pets")
    .select("id, name, deleted_at")
    .eq("household_id", householdId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) {
    console.error("listDeletedPets:", error.message);
    return [];
  }
  return (data ?? [])
    .filter((p): p is { id: string; name: string; deleted_at: string } => !!p.deleted_at)
    .map((p) => ({
      id: p.id,
      name: p.name,
      deletedAt: p.deleted_at,
      daysRemaining: daysRemaining(p.deleted_at),
    }));
}

/**
 * Soft-deleted households a given user OWNS, for the account settings restore
 * list. A soft-deleted household is invisible to requireSession, so it can only
 * be reached through this deliberate service-client read.
 */
export async function listDeletedHouseholdsOwnedBy(
  userId: string,
): Promise<DeletedHousehold[]> {
  const service = createServiceClient();
  const { data: memberships } = await service
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .eq("role", "owner");
  const ownedIds = (memberships ?? []).map((m) => m.household_id);
  if (ownedIds.length === 0) return [];

  const { data, error } = await service
    .from("households")
    .select("id, name, deleted_at")
    .in("id", ownedIds)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) {
    console.error("listDeletedHouseholdsOwnedBy:", error.message);
    return [];
  }
  return (data ?? [])
    .filter((h): h is { id: string; name: string; deleted_at: string } => !!h.deleted_at)
    .map((h) => ({
      id: h.id,
      name: h.name,
      deletedAt: h.deleted_at,
      daysRemaining: daysRemaining(h.deleted_at),
    }));
}
