import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { extractDocument, ExtractionError } from "@/lib/ai/extract-document";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/ai/prompts/v1";
import { extractTextSample } from "@/lib/ingest/text-prepass";
import {
  classifyPimsFromText,
  pimsPromptFragment,
} from "@/lib/ai/pims-classifier";
import { detectForm51, form51PromptFragment } from "@/lib/ai/form51-anchor";
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
  // We decide the whole ladder up front from byte size rather than letting a
  // tier-N call 400 mid-route.
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const GEMINI_MAX_INLINE = 50 * 1024 * 1024;
  const CLAUDE_MAX_PDF = 32 * 1024 * 1024;
  const CLAUDE_MAX_IMAGE_API = 5 * 1024 * 1024;
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

  // First-tier (Gemini) check — bail entirely if too big for the smallest
  // provider in the ladder.
  if (sizeBytes > GEMINI_MAX_INLINE) {
    await markFailed(
      documentId,
      `File is ${mb(sizeBytes)} MB, over the 50 MB extraction limit. Re-upload a smaller version or split the document.`,
    );
    return;
  }

  // Tier-3 (Claude) cap, computed UP FRONT. When a document exceeds it we
  // either cap the ladder at tier 2 (normal docs) or hard-fail (docs that MUST
  // run tier 3), decided below, before we pay for tier 1.
  const exceedsTier3Cap =
    (isPdf && sizeBytes > CLAUDE_MAX_PDF) ||
    (isImage && sizeBytes > CLAUDE_MAX_IMAGE_API);

  // ── Text pre-pass + classifiers ──────────────────────────────────
  // Read the PDF text layer (never OCR here) so the PIMS classifier and Form 51
  // detector have real text to fingerprint. Non-fatal: any failure yields null
  // and the pipeline behaves exactly as before (raw bytes → vision model).
  let textSample = null;
  try {
    textSample = await extractTextSample(fileBytes, mimeType);
  } catch (err) {
    console.warn(
      `[extraction-trigger] text pre-pass threw for ${documentId}, continuing without it:`,
      err instanceof Error ? err.message : err,
    );
  }

  const pims = textSample ? classifyPimsFromText(textSample.text) : null;
  const form51 = textSample ? detectForm51(textSample.text) : null;

  // Confidence floor for injecting PIMS guidance: 2+ signals ("confident
  // match"). Below that the classifier is guessing and a wrong PIMS fragment
  // could mislead segmentation more than help.
  const PIMS_CONFIDENCE_FLOOR = 0.7;
  const promptFragments: string[] = [];
  const firedFragments: string[] = [];
  if (
    pims &&
    pims.family !== "unknown" &&
    pims.confidence >= PIMS_CONFIDENCE_FLOOR
  ) {
    const frag = pimsPromptFragment(pims.family);
    if (frag.trim()) {
      promptFragments.push(frag);
      firedFragments.push(`pims:${pims.family}`);
    }
  }
  if (form51?.is_form51) {
    promptFragments.push(form51PromptFragment());
    firedFragments.push("form51");
  }

  // Tier-3 forcing: an explicit request, a rabies filename, OR a positive
  // Form 51 text detection. The filename heuristic remains the fallback for the
  // no-text case (scanned images) where detectForm51 never runs.
  const needsTier3 =
    opts.forceTier3 ||
    isLikelyRabiesDocument(filename) ||
    (form51?.is_form51 ?? false);

  // A legally-significant document that MUST run tier 3 can't be silently
  // downgraded to tier 2 just because it's oversized. Fail loudly instead.
  if (needsTier3 && exceedsTier3Cap) {
    await markFailed(
      documentId,
      `This document requires our most careful model, which rabies certificates and NASPHV Form 51 always do, but at ${mb(sizeBytes)} MB it exceeds that model's ${isPdf ? "32 MB PDF" : "5 MB image"} limit. Please split it or upload a smaller version.`,
    );
    return;
  }

  const forceTier = needsTier3 ? 3 : undefined;
  // Normal docs that are too big for tier 3: cap the ladder at tier 2 up front
  // and record why, instead of escalating into a guaranteed tier-3 failure.
  const maxTier = !forceTier && exceedsTier3Cap ? 2 : undefined;
  const tierCapReason = maxTier
    ? `Document is ${mb(sizeBytes)} MB, over the Claude ${isPdf ? "32 MB PDF" : "5 MB image"} cap; escalation capped at tier 2.`
    : null;

  try {
    const out = await extractDocument({
      fileBytes,
      mimeType,
      filename,
      forceTier,
      maxTier,
      promptFragments,
    });

    // Persist extraction row. The raw response sometimes carries headers /
    // metadata we don't want to round-trip into Postgres — only keep the
    // structured result + a small bookkeeping envelope. The `metadata` block
    // records what the pre-pass saw and which fragments fired, for debugging
    // extraction quality without re-running the pipeline.
    // Cast the structured extraction result into Json. The Zod schema
    // guarantees serializability — there are no Dates / functions / etc.
    const rawResponse: Json = {
      tier: out.tier,
      result: out.result as unknown as Json,
      metadata: {
        text_prepass: textSample
          ? { char_count: textSample.charCount, page_count: textSample.pageCount }
          : null,
        pims:
          pims && pims.family !== "unknown"
            ? {
                family: pims.family,
                confidence: pims.confidence,
                matched_signals: pims.matched_signals,
              }
            : null,
        form51: form51
          ? {
              is_form51: form51.is_form51,
              confidence: form51.confidence,
              matched_signals: form51.matched_signals,
            }
          : null,
        prompt_fragments: firedFragments,
        tier_cap: tierCapReason ? { capped_at: 2, reason: tierCapReason } : null,
      } as unknown as Json,
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
