import "server-only";

import { createHash } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * SHA-256 hex digest of a Uint8Array / Buffer. Used to detect byte-identical
 * uploads in the same household.
 */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

export type ExistingDocument = {
  id: string;
  original_filename: string | null;
  uploaded_at: string;
  storage_path: string;
  pet_id: string | null;
  processing_status: string;
  insurance_policy_id: string | null;
};

/**
 * Look up any document in this household that already matches `contentHash`.
 * Returns the linked insurance_policies.id when there's one so the caller
 * can deep-link the user back to it.
 */
export async function findDocumentByHash(
  householdId: string,
  contentHash: string,
): Promise<ExistingDocument | null> {
  const supabase = createServiceClient();
  const { data: doc } = await supabase
    .from("documents")
    .select(
      "id, original_filename, uploaded_at, storage_path, pet_id, processing_status",
    )
    .eq("household_id", householdId)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (!doc) return null;

  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id")
    .eq("household_id", householdId)
    .eq("document_id", doc.id)
    .maybeSingle();

  return {
    id: doc.id,
    original_filename: doc.original_filename,
    uploaded_at: doc.uploaded_at,
    storage_path: doc.storage_path,
    pet_id: doc.pet_id,
    processing_status: doc.processing_status,
    insurance_policy_id: policy?.id ?? null,
  };
}
