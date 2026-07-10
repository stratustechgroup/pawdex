import "server-only";

// Server-side PDF text-layer extraction: the "pre-pass" that runs before tier
// selection so cheap, deterministic heuristics (PIMS classifier, Form 51
// detector, PEC prefilter) have real text to work on instead of nothing.
//
// This is NOT OCR. It reads the embedded text layer of a digital PDF via
// `unpdf` (a serverless-friendly PDF.js build). Scanned documents and images
// have no text layer, so we return null for them and the pipeline falls back to
// its prior behavior (raw bytes → vision model). Adding OCR for scans is a
// known follow-up (see docs/ingestion-pipeline.md).
//
// Every failure path is non-fatal: any throw, empty result, or too-little-text
// result yields null. Extraction must never break because the pre-pass hiccuped.

import { extractText } from "unpdf";

export type TextSample = {
  /** Merged text across all pages. */
  text: string;
  /** Number of non-whitespace characters (the signal we threshold on). */
  charCount: number;
  /** Page count reported by the PDF. */
  pageCount: number;
};

// A digital PDF with a real text layer yields hundreds to thousands of chars.
// Scanned PDFs (image-only) typically yield a handful of stray chars: page
// numbers, an OCR watermark, nothing usable. Below this floor we treat the doc
// as scanned and return null so the vision path takes over unchanged.
const MIN_MEANINGFUL_CHARS = 100;

/**
 * Extract a text sample from a document's bytes.
 *
 * Returns null (never throws) when:
 *  - the file is not a PDF (images have no text layer to read),
 *  - the PDF has no meaningful text layer (scanned / image-only),
 *  - unpdf fails for any reason (corrupt, encrypted, parser error).
 */
export async function extractTextSample(
  bytes: Uint8Array,
  mimeType: string,
): Promise<TextSample | null> {
  if (mimeType !== "application/pdf") return null;

  try {
    // PDF.js may detach/transfer the underlying buffer during parsing. Hand it
    // a private copy so we never disturb the caller's bytes (the same buffer is
    // still sent to the vision model downstream).
    const copy = bytes.slice();
    const { text, totalPages } = await extractText(copy, { mergePages: true });

    const merged = typeof text === "string" ? text : "";
    const charCount = merged.replace(/\s+/g, "").length;
    if (charCount < MIN_MEANINGFUL_CHARS) return null;

    return { text: merged, charCount, pageCount: totalPages };
  } catch (err) {
    console.warn(
      "[text-prepass] extraction failed, falling back to vision path:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
