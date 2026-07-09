import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/types";

export async function listDocumentsForPet(
  householdId: string,
  petId: string,
): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`listDocumentsForPet: ${error.message}`);
  return (data ?? []) as DocumentRow[];
}

export async function getDocument(
  householdId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw new Error(`getDocument: ${error.message}`);
  return (data as DocumentRow | null) ?? null;
}

export async function getDocumentSignedUrl(
  documentRow: DocumentRow,
  expiresIn: number = 60 * 60,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(documentRow.storage_bucket)
    .createSignedUrl(documentRow.storage_path, expiresIn);

  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Find the next document for this pet that's waiting on review, excluding the
 * one the user just finished. Drives the "Reviewing N of M" queue.
 * Returns null when the queue is empty — caller should redirect to pet detail.
 */
export async function getNextPendingReviewDocument(
  householdId: string,
  petId: string,
  excludeDocumentId: string,
): Promise<{ id: string; uploaded_at: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, uploaded_at")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .eq("processing_status", "extracted")
    .neq("id", excludeDocumentId)
    .order("uploaded_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

/**
 * Count documents in review-waiting state for this pet — used to render
 * "Reviewing X of N" in the header.
 */
export async function countReviewQueue(
  householdId: string,
  petId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("documents")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .eq("processing_status", "extracted");
  if (error) return 0;
  return count ?? 0;
}

/**
 * Documents with no pet assigned — these come from email-forwarding ingestion.
 * Surfaced on /inbox so the user can route each to the right pet.
 */
export async function listUnassignedDocuments(
  householdId: string,
): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("household_id", householdId)
    .is("pet_id", null)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(`listUnassignedDocuments: ${error.message}`);
  return (data ?? []) as DocumentRow[];
}

export async function countUnassignedDocuments(
  householdId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("documents")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", householdId)
    .is("pet_id", null);
  if (error) return 0;
  return count ?? 0;
}
