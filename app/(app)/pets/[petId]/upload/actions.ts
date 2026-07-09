"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processDocumentExtraction } from "@/lib/ai/extraction-trigger";
import {
  deleteDocument as deleteDocumentDb,
  type DeleteDocumentResult,
} from "@/lib/db/document-delete";
import { findDocumentByHash, sha256Hex } from "@/lib/db/document-hash";
import {
  preprocessUploadedFile,
  isHeic,
} from "@/lib/ingest/preprocess";

type CreateDocumentInput = {
  pet_id: string;
  storage_path: string;
  mime_type: string;
  original_filename: string;
  byte_size: number;
};

type CreateDocumentResult =
  | { ok: true; duplicate?: false; documentId: string }
  | { ok: true; duplicate: true; documentId: string; petId: string | null }
  | { ok: false; error: string };

export async function createDocument(
  input: CreateDocumentInput,
): Promise<CreateDocumentResult> {
  if (!input.pet_id) return { ok: false, error: "pet_id is required" };
  if (!input.storage_path) {
    return { ok: false, error: "storage_path is required" };
  }

  const session = await requireSession();
  const supabase = await createClient();

  // v6.1 — Server-side preprocessing pass. Three jobs: detect & convert HEIC
  // to JPEG (Gemini/Claude don't accept HEIC), detect encrypted PDFs and
  // refuse before queueing extraction (Claude rejects + bug #25202 poisons
  // the conversation). We download the just-uploaded bytes, run the
  // detector, and either rewrite the object in storage (HEIC→JPEG) or fail
  // upfront.
  let effectiveMime = input.mime_type;
  let effectiveSize = input.byte_size;
  let effectivePath = input.storage_path;
  // SHA-256 of the ORIGINAL uploaded bytes (pre-HEIC-conversion). Stays null
  // if the download/preprocess pass fails — the partial unique index only
  // covers non-null hashes, so a null content_hash inserts fine and dedup is
  // simply skipped for that upload (matches the "don't block uploads" stance).
  let contentHash: string | null = null;

  try {
    const service = createServiceClient();
    const { data: blob, error: dlErr } = await service.storage
      .from("documents")
      .download(input.storage_path);

    if (!dlErr && blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());

      // Hash the original bytes BEFORE any HEIC→JPEG conversion so two uploads
      // of the same source file collide regardless of downstream conversion.
      contentHash = sha256Hex(bytes);

      // Duplicate check FIRST — before the (potentially expensive) preprocess
      // pass and before insert. If this household already has a byte-identical
      // document, route the user to it instead of inserting a second row and
      // kicking off a redundant extraction. Note: the match may live under a
      // DIFFERENT pet (or none — insurance/inbox docs), so we return the
      // existing doc's pet_id, not the input pet_id.
      const dupe = await findDocumentByHash(session.householdId, contentHash);
      if (dupe) {
        return {
          ok: true,
          duplicate: true,
          documentId: dupe.id,
          petId: dupe.pet_id,
        };
      }

      const finding = await preprocessUploadedFile({
        bytes,
        mimeType: input.mime_type,
        filename: input.original_filename,
      });

      if (finding.kind === "encrypted_pdf") {
        // Storage object stays in place — the user can re-upload an
        // unlocked PDF. Surface a clear error rather than insert a
        // document row that will fail extraction with a cryptic message.
        return { ok: false, error: finding.reason };
      }

      if (finding.kind === "converted_heic") {
        // Rewrite the object as JPEG so downstream extraction reads from
        // the right path with the right mime. Same UUID prefix, .jpg
        // extension. Original HEIC bytes are no longer needed — vision
        // LLMs will never read them.
        const newPath = input.storage_path.replace(
          /\.(heic|heif)$/i,
          ".jpg",
        );
        const { error: upErr } = await service.storage
          .from("documents")
          .upload(newPath, finding.new_bytes, {
            contentType: finding.new_mime,
            cacheControl: "3600",
            upsert: true,
          });
        if (!upErr && newPath !== input.storage_path) {
          // Best-effort delete of the original HEIC so we don't pay
          // storage twice. Failures here are non-fatal.
          await service.storage
            .from("documents")
            .remove([input.storage_path]);
        }
        effectivePath = newPath;
        effectiveMime = finding.new_mime;
        effectiveSize = finding.new_bytes.byteLength;
      }
    }
  } catch (err) {
    console.warn(
      "[createDocument] preprocessing skipped after error:",
      err instanceof Error ? err.message : err,
    );
    // Fall through — the extraction layer will surface format errors if
    // any. We don't want preprocessing failures to block uploads.
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      household_id: session.householdId,
      pet_id: input.pet_id,
      storage_bucket: "documents",
      storage_path: effectivePath,
      mime_type: effectiveMime,
      original_filename:
        isHeic(input.mime_type, input.original_filename) &&
        effectiveMime === "image/jpeg"
          ? // Rename the on-record filename to reflect the JPEG output —
            // the original HEIC name would confuse the download button.
            input.original_filename.replace(/\.(heic|heif)$/i, ".jpg")
          : input.original_filename,
      byte_size: effectiveSize,
      content_hash: contentHash,
      processing_status: "pending",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Unique-violation on (household_id, content_hash) — two concurrent
    // identical uploads raced past the pre-insert dedup check. Re-query and
    // route to the existing document instead of surfacing a generic error.
    // The orphaned storage object lives at a fresh UUID path (distinct from
    // the winning doc's path); we leave it as a tolerable best-effort tradeoff.
    if (error?.code === "23505" && contentHash) {
      const raced = await findDocumentByHash(
        session.householdId,
        contentHash,
      );
      if (raced) {
        return {
          ok: true,
          duplicate: true,
          documentId: raced.id,
          petId: raced.pet_id,
        };
      }
    }
    return { ok: false, error: error?.message ?? "Failed to create document" };
  }

  const documentId = data.id;

  revalidatePath(`/pets/${input.pet_id}`);
  revalidatePath(`/pets/${input.pet_id}/documents`);

  // Run extraction after the response is sent so the user is redirected to
  // /review immediately while AI extraction runs in the background. The
  // review page polls processing_status to update its UI.
  after(async () => {
    await processDocumentExtraction({ documentId });
  });

  return { ok: true, documentId };
}

export async function reextractDocument(documentId: string): Promise<{
  ok: true;
}> {
  await requireSession();
  // Force tier 3 (Sonnet) for manual re-extract — user is explicitly asking
  // for the premium model.
  after(async () => {
    await processDocumentExtraction({ documentId, forceTier3: true });
  });
  return { ok: true };
}

/**
 * Hard-delete a document and every extraction artifact attached to it.
 * Committed entities (vaccinations, medical_events, etc.) survive with their
 * `document_id` back-reference nulled — no FK violations, no orphan rows.
 *
 * On success: returns counts + redirects to the pet's documents gallery so
 * the user lands somewhere meaningful when invoked from the document viewer.
 *
 * When `redirectAfter` is false, the action returns the result instead —
 * used by the gallery's inline delete form so the page just revalidates.
 */
export async function deleteDocumentAction(input: {
  documentId: string;
  /** Pet the document was attached to, used to revalidate + redirect. Empty
   *  string is valid (inbox / unassigned documents) — we just skip the
   *  pet-specific revalidations. */
  petId: string;
  redirectAfter: boolean;
}): Promise<DeleteDocumentResult> {
  const session = await requireSession();
  const result = await deleteDocumentDb({
    householdId: session.householdId,
    actorId: session.userId,
    documentId: input.documentId,
  });

  if (result.ok) {
    if (input.petId) {
      revalidatePath(`/pets/${input.petId}/documents`);
      revalidatePath(`/pets/${input.petId}`);
    }
    revalidatePath("/inbox");
    if (input.redirectAfter && input.petId) {
      redirect(`/pets/${input.petId}/documents`);
    }
  }
  return result;
}
