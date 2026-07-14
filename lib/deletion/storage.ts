import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

type Service = SupabaseClient<Database>;

// Storage is NOT covered by the DB FK cascade. Files live under
//   {household_id}/{pet_id|'unsorted'}/{uuid}.{ext}
// in the private "documents" and "pet-photos" buckets (0003_storage_policies).
// Deleting a household or pet row leaves those objects behind, so the purge
// path has to walk the prefix and remove every object under it.

const LIST_PAGE = 100;
// Guard against a pathological tree eating the whole cron budget. Two real
// levels exist today (household/pet); the cap is depth, not a functional limit.
const MAX_DEPTH = 6;

/**
 * Recursively collect every object path under `prefix` in one bucket. Supabase
 * storage `list()` returns only immediate children; folder entries come back
 * with a null `id`, files with a non-null `id`. We recurse into folders and
 * page through each level.
 */
async function listAllUnderPrefix(
  service: Service,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  const collected: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await service.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE, offset });
    if (error) {
      console.error(`purge storage list ${bucket}/${prefix}: ${error.message}`);
      break;
    }
    const entries = data ?? [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // Folder, recurse.
        const nested = await listAllUnderPrefix(service, bucket, path, depth + 1);
        collected.push(...nested);
      } else {
        collected.push(path);
      }
    }
    if (entries.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }

  return collected;
}

/**
 * Remove every object under a storage prefix. Best-effort and idempotent: a
 * failure logs loudly and continues (a re-run cleans up stragglers) rather than
 * aborting a purge that has already deleted DB rows. Returns the count removed.
 */
export async function purgeStoragePrefix(
  service: Service,
  bucket: string,
  prefix: string,
): Promise<number> {
  const paths = await listAllUnderPrefix(service, bucket, prefix);
  if (paths.length === 0) return 0;

  let removed = 0;
  // remove() takes an array; chunk so one call can't get unwieldy.
  const CHUNK = 100;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const batch = paths.slice(i, i + CHUNK);
    const { error } = await service.storage.from(bucket).remove(batch);
    if (error) {
      console.error(`purge storage remove ${bucket}: ${error.message}`);
    } else {
      removed += batch.length;
    }
  }
  return removed;
}

/**
 * Purge all storage for one household across both buckets (documents +
 * pet-photos). The household_id is the first path segment in both.
 */
export async function purgeHouseholdStorage(
  service: Service,
  householdId: string,
): Promise<{ documents: number; petPhotos: number }> {
  const documents = await purgeStoragePrefix(service, "documents", householdId);
  const petPhotos = await purgeStoragePrefix(service, "pet-photos", householdId);
  return { documents, petPhotos };
}

/**
 * Purge storage for a single pet: {household_id}/{pet_id} in both buckets.
 * Household-level "unsorted" files are keyed under a different second segment
 * so they are deliberately untouched here.
 */
export async function purgePetStorage(
  service: Service,
  householdId: string,
  petId: string,
): Promise<{ documents: number; petPhotos: number }> {
  const prefix = `${householdId}/${petId}`;
  const documents = await purgeStoragePrefix(service, "documents", prefix);
  const petPhotos = await purgeStoragePrefix(service, "pet-photos", prefix);
  return { documents, petPhotos };
}
