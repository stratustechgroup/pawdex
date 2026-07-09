import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExtractionResult } from "@/lib/ai/extraction-schema";

export type LatestExtraction = {
  id: string;
  document_id: string;
  household_id: string;
  model: string;
  prompt_version: string;
  raw_response: unknown;
  confidence_overall: number | null;
  status: "pending_review" | "committed" | "discarded";
  extracted_at: string;
};

/**
 * Returns the most recent extraction row for a document, regardless of status.
 * Multiple extractions can exist per document (manual re-runs); we always want
 * the freshest one for review.
 */
export async function getLatestExtraction(
  householdId: string,
  documentId: string,
): Promise<LatestExtraction | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_extractions")
    .select(
      "id, document_id, household_id, model, prompt_version, raw_response, confidence_overall, status, extracted_at",
    )
    .eq("household_id", householdId)
    .eq("document_id", documentId)
    .order("extracted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestExtraction: ${error.message}`);
  return (data as LatestExtraction | null) ?? null;
}

/**
 * Pull the structured ExtractionResult from a raw_response envelope.
 * The envelope shape is { tier, result } per extraction-trigger.ts.
 * Returns null if the envelope is malformed (e.g. stub rows from before
 * real extraction landed).
 */
export function extractResultFromEnvelope(
  raw: unknown,
): ExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const env = raw as { result?: unknown };
  if (!env.result || typeof env.result !== "object") return null;
  return env.result as ExtractionResult;
}
