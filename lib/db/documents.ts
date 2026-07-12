import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/types";
import { extractResultFromEnvelope } from "@/lib/db/extractions";
import { sameClinic } from "@/lib/db/extraction-dedup-match";

/**
 * Other documents for this pet that are ALSO awaiting review and describe one of
 * the same visits (same date + same clinic) as the document being reviewed.
 *
 * The commit-time dedup matchers only compare against COMMITTED rows, so when a
 * SOAP note and its matching invoice are both uploaded and sit in review at the
 * same time, neither sees the other until one is committed — the exact shape of
 * the founder's real cross-document duplication. This surfaces the overlap up
 * front so the reviewer can commit them together (the second review then dedups
 * against the first, now committed).
 *
 * Read-only and best-effort: any failure returns [] and the banner is simply not
 * shown. `currentVisits` is the set of (date, clinic) the document under review
 * covers.
 */
export async function findSiblingPendingVisits(
  householdId: string,
  petId: string,
  excludeDocumentId: string,
  currentVisits: Array<{ date: string; clinic: string | null }>,
): Promise<Array<{ id: string; filename: string | null; sharedDates: string[] }>> {
  if (currentVisits.length === 0) return [];
  const supabase = await createClient();

  const { data: siblings, error } = await supabase
    .from("documents")
    .select("id, original_filename")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .eq("processing_status", "extracted")
    .neq("id", excludeDocumentId);
  if (error || !siblings || siblings.length === 0) return [];

  const out: Array<{ id: string; filename: string | null; sharedDates: string[] }> = [];
  for (const sib of siblings) {
    const { data: ext } = await supabase
      .from("document_extractions")
      .select("raw_response")
      .eq("household_id", householdId)
      .eq("document_id", sib.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const result = ext?.raw_response
      ? extractResultFromEnvelope(ext.raw_response)
      : null;
    if (!result) continue;

    const shared = new Set<string>();
    for (const e of result.medical_events ?? []) {
      const sibDate = typeof e.occurred_on === "string" ? e.occurred_on : "";
      if (!sibDate) continue;
      const sibClinic = e.clinic_name ?? result.vet_clinic?.name ?? null;
      for (const cv of currentVisits) {
        if (cv.date === sibDate && sameClinic(cv.clinic, sibClinic)) {
          shared.add(sibDate);
        }
      }
    }
    if (shared.size > 0) {
      out.push({
        id: sib.id,
        filename: sib.original_filename,
        sharedDates: Array.from(shared).sort(),
      });
    }
  }
  return out;
}

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
