import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { extractDocument, ExtractionError } from "@/lib/ai/extract-document";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/ai/prompts/v1";
import type { Json } from "@/lib/supabase/types";

/**
 * Heuristic — detect rabies-related documents from filename so we can force
 * tier 3 (Sonnet) extraction. Rabies certificates are legally significant; we
 * don't trust tier-1 confidence alone for them.
 */
export function isLikelyRabiesDocument(filename: string | null): boolean {
  if (!filename) return false;
  const n = filename.toLowerCase();
  return n.includes("rabies") || n.includes("rab-") || n.includes("rabid");
}

/**
 * Process a single document end-to-end: fetch from storage, run extraction,
 * persist the result row, and flip the document status.
 *
 * Uses the service-role client throughout because:
 *  - storage read needs to bypass RLS for the worker
 *  - the document_extractions insert needs to land regardless of session
 *
 * Designed to be called from `after()` so it survives past the request that
 * created the document.
 */
export async function processDocumentExtraction(opts: {
  documentId: string;
  forceTier3?: boolean;
}): Promise<void> {
  const supabase = createServiceClient();
  const documentId = opts.documentId;

  // Lookup the document. If it's missing or in a non-extractable state, bail.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select(
      "id, household_id, pet_id, storage_bucket, storage_path, mime_type, original_filename, extraction_attempts",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (docErr || !doc) {
    console.error("processDocumentExtraction: document not found", {
      documentId,
      err: docErr?.message,
    });
    return;
  }

  // pending -> extracting
  await supabase
    .from("documents")
    .update({
      processing_status: "extracting",
      extraction_attempts: (doc.extraction_attempts ?? 0) + 1,
    })
    .eq("id", documentId);

  // Download file bytes from storage
  const { data: blob, error: dlErr } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);

  if (dlErr || !blob) {
    await markFailed(documentId, `Storage download failed: ${dlErr?.message ?? "unknown"}`);
    return;
  }

  const arrayBuf = await blob.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuf);
  const mimeType = doc.mime_type ?? blob.type ?? "application/octet-stream";
  const filename = doc.original_filename ?? "document";
  const sizeBytes = fileBytes.byteLength;

  // v6.1 — Per-provider cap validation BEFORE routing.
  // Gemini Flash-Lite/Flash: 50 MB inline (PDFs) / 20 MB images / 1000 pages.
  // Claude Sonnet 4.5:       32 MB PDFs / 100 pages / 5 MB images (API mode).
  // OpenAI (if escalated):    20 MB images / no native PDF (would need rasterize).
  // We bail with a clear error rather than letting the tier-N call 400 mid-route.
  const isPdf = mimeType === "application/pdf";
  const GEMINI_MAX_INLINE = 50 * 1024 * 1024;
  const CLAUDE_MAX_PDF = 32 * 1024 * 1024;
  const CLAUDE_MAX_IMAGE_API = 5 * 1024 * 1024;

  // First-tier (Gemini) check — bail entirely if too big for the smallest
  // provider in the ladder.
  if (sizeBytes > GEMINI_MAX_INLINE) {
    await markFailed(
      documentId,
      `File is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — exceeds the 50 MB extraction limit. Re-upload a smaller version or split the document.`,
    );
    return;
  }
  // Tier-3 cap warning — log only; tier 3 may still be needed for rabies
  // certs which are typically small. The runtime will fail more cleanly if
  // it happens to exceed mid-ladder.
  if (isPdf && sizeBytes > CLAUDE_MAX_PDF) {
    console.warn(
      `[extraction-trigger] Document ${documentId} (${(sizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds Claude PDF cap — Tier 3 escalation will fail. Consider splitting.`,
    );
  }
  if (!isPdf && mimeType.startsWith("image/") && sizeBytes > CLAUDE_MAX_IMAGE_API) {
    console.warn(
      `[extraction-trigger] Image document ${documentId} (${(sizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds Claude API image cap — Tier 3 escalation will require Files API.`,
    );
  }

  // Run extraction. Rabies certs jump straight to tier 3.
  const forceTier =
    opts.forceTier3 || isLikelyRabiesDocument(filename) ? 3 : undefined;

  try {
    const out = await extractDocument({
      fileBytes,
      mimeType,
      filename,
      forceTier,
    });

    // Persist extraction row. The raw response sometimes carries headers /
    // metadata we don't want to round-trip into Postgres — only keep the
    // structured result + a small bookkeeping envelope.
    // Cast the structured extraction result into Json. The Zod schema
    // guarantees serializability — there are no Dates / functions / etc.
    const rawResponse: Json = {
      tier: out.tier,
      result: out.result as unknown as Json,
    };

    await supabase.from("document_extractions").insert({
      document_id: documentId,
      household_id: doc.household_id,
      model: out.model,
      model_version: null,
      prompt_version: EXTRACTION_PROMPT_VERSION,
      raw_response: rawResponse,
      confidence_overall: out.result.confidence_overall,
      status: "pending_review",
    });

    await supabase
      .from("documents")
      .update({
        processing_status: "extracted",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", documentId);
  } catch (err) {
    const message =
      err instanceof ExtractionError
        ? `${err.message} (attempts: ${err.attempts}, last model: ${err.lastModel})`
        : err instanceof Error
          ? err.message
          : "Unknown extraction error";
    await markFailed(documentId, message);
  }
}

async function markFailed(documentId: string, message: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("documents")
    .update({
      processing_status: "failed",
      error_message: message,
      processed_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}
