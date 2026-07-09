import "server-only";

// Server-side preprocessing for uploaded documents. Runs in the createDocument
// server action AFTER the file lands in Supabase Storage, so we can reach for
// Node-only deps (heic-convert, pdf-lib) without bloating the client bundle.
//
// Three jobs:
//   1. HEIC → JPEG conversion (iPhone Live Photo / Photos.app default format
//      that no vision LLM accepts natively).
//   2. Encrypted PDF detection (Claude's pipeline rejects + poisons the
//      conversation per anthropic/claude-code#25202).
//   3. Per-provider size cap awareness — done elsewhere (extraction-trigger).

import heicConvert from "heic-convert";
import { PDFDocument } from "pdf-lib";

export type PreprocessFinding =
  | { kind: "ok" }
  | { kind: "converted_heic"; new_bytes: Uint8Array; new_mime: "image/jpeg" }
  | { kind: "encrypted_pdf"; reason: string }
  | { kind: "corrupt"; reason: string };

/**
 * Test whether a file's bytes + mime indicate it's HEIC/HEIF. iPhones serve
 * these with mime "image/heic" or "image/heif" — browsers don't decode them.
 */
export function isHeic(mimeType: string, filename: string | null): boolean {
  const m = mimeType.toLowerCase();
  if (m === "image/heic" || m === "image/heif") return true;
  const name = (filename ?? "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/**
 * HEIC → JPEG at quality 0.9. heic-convert is pure-JS (no native deps) so it
 * runs anywhere — slower than sharp+libheif but doesn't require platform
 * builds. Vision LLMs scale our output down anyway, so 90% quality is
 * already lossy beyond the model's perception.
 */
export async function convertHeicToJpeg(
  bytes: Uint8Array,
): Promise<Uint8Array> {
  const out = await heicConvert({
    // heic-convert accepts ArrayBuffer or Uint8Array; cast for type safety.
    buffer: bytes as unknown as ArrayBufferLike as ArrayBuffer,
    format: "JPEG",
    quality: 0.9,
  });
  // heic-convert returns ArrayBuffer; wrap as Uint8Array for downstream
  // consistency with the rest of the upload flow.
  return new Uint8Array(out);
}

/**
 * Detect whether a PDF is encrypted/password-protected. pdf-lib's loader
 * throws on encrypted docs unless `ignoreEncryption: true` is set; we use
 * that flag to detect (rather than reject hard) and then check `isEncrypted`.
 *
 * This matters because Claude Sonnet rejects encrypted PDFs and the bug at
 * anthropic/claude-code#25202 means a single encrypted PDF can poison the
 * whole conversation. Detect at upload time, fail loudly, save the user a
 * stuck extraction.
 */
export async function isEncryptedPdf(bytes: Uint8Array): Promise<boolean> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.isEncrypted;
  } catch {
    // If pdf-lib can't even parse the header, that's a different problem
    // (corrupt file) — let the extraction layer surface that via its own
    // error path. We only signal-fail when we can confidently say "yes
    // it's encrypted."
    return false;
  }
}

/**
 * Single entry point. Runs whichever preprocessing the file needs and
 * returns a finding the createDocument action can act on:
 *   - "ok" → upload as-is
 *   - "converted_heic" → re-upload with the new bytes + JPEG mime
 *   - "encrypted_pdf" → reject upfront, mark the document failed with a
 *     clear "please remove the password" message
 *   - "corrupt" → currently never returned — reserved for future use
 */
export async function preprocessUploadedFile(input: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string | null;
}): Promise<PreprocessFinding> {
  // HEIC pass — convert to JPEG so downstream vision models can read it.
  if (isHeic(input.mimeType, input.filename)) {
    try {
      const jpeg = await convertHeicToJpeg(input.bytes);
      return { kind: "converted_heic", new_bytes: jpeg, new_mime: "image/jpeg" };
    } catch (err) {
      // HEIC decode failures shouldn't block — fall through and let the
      // extraction layer reject the unsupported file with its own error.
      console.warn(
        "[preprocess] HEIC conversion failed, passing through:",
        err instanceof Error ? err.message : err,
      );
      return { kind: "ok" };
    }
  }

  // PDF encryption check — only run on PDF files.
  if (input.mimeType === "application/pdf") {
    const encrypted = await isEncryptedPdf(input.bytes);
    if (encrypted) {
      return {
        kind: "encrypted_pdf",
        reason:
          "This PDF is password-protected. Please remove the password and re-upload — Pawdex can't read encrypted PDFs.",
      };
    }
  }

  return { kind: "ok" };
}
