"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { processPolicyExtraction } from "@/lib/ai/policy-trigger";
import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { findDocumentByHash, sha256Hex } from "@/lib/db/document-hash";
import { createServiceClient } from "@/lib/supabase/service";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);
const MAX_BYTES = 25 * 1024 * 1024;

export type UploadPolicyState =
  | { status: "idle" }
  | {
      status: "duplicate";
      message: string;
      existingPolicyId: string | null;
      existingDocumentId: string;
    }
  | { status: "error"; message: string };

const initial: UploadPolicyState = { status: "idle" };

/**
 * Server Action used with `useActionState` so duplicate / validation errors
 * round-trip to the form without bouncing through the error boundary. On
 * success this still redirects — useActionState resolves to {status: "idle"}
 * because the redirect aborts the action.
 */
export async function uploadPolicyDocumentAction(
  _prev: UploadPolicyState,
  formData: FormData,
): Promise<UploadPolicyState> {
  void initial;
  const session = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Pick a PDF or image first." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      status: "error",
      message: `Unsupported file type: ${file.type || "unknown"}. Use PDF, JPG, PNG, HEIC, or WebP.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "File is larger than 25 MB." };
  }

  const petIdRaw = formData.get("pet_id");
  const petId =
    typeof petIdRaw === "string" && petIdRaw && petIdRaw !== "household"
      ? petIdRaw
      : null;

  const buf = Buffer.from(await file.arrayBuffer());
  const contentHash = sha256Hex(buf);

  // Duplicate check FIRST — before we touch storage, so a re-upload is cheap.
  const existing = await findDocumentByHash(session.householdId, contentHash);
  if (existing) {
    return {
      status: "duplicate",
      message:
        existing.original_filename && existing.original_filename === file.name
          ? `You already uploaded "${file.name}". Edit the existing policy below or retry extraction if it stalled.`
          : `This file matches "${existing.original_filename ?? "an existing document"}" you already uploaded. Open the existing policy instead of re-uploading.`,
      existingPolicyId: existing.insurance_policy_id,
      existingDocumentId: existing.id,
    };
  }

  const supabase = createServiceClient();
  const docId = randomUUID();
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "pdf";
  const storagePath = `${session.householdId}/insurance/${docId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, buf, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return { status: "error", message: `Upload failed: ${uploadErr.message}` };
  }

  const { data: doc, error: docInsErr } = await supabase
    .from("documents")
    .insert({
      id: docId,
      household_id: session.householdId,
      pet_id: petId,
      storage_bucket: "documents",
      storage_path: storagePath,
      mime_type: file.type,
      original_filename: file.name,
      byte_size: file.size,
      content_hash: contentHash,
      processing_status: "pending",
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (docInsErr || !doc) {
    await supabase.storage.from("documents").remove([storagePath]);
    // Unique-violation on (household_id, content_hash) — race condition where
    // the user double-submitted; surface as a duplicate, not a generic error.
    if (docInsErr?.code === "23505") {
      const racedExisting = await findDocumentByHash(
        session.householdId,
        contentHash,
      );
      return {
        status: "duplicate",
        message: `This file was already uploaded a moment ago — open the existing entry below.`,
        existingPolicyId: racedExisting?.insurance_policy_id ?? null,
        existingDocumentId: racedExisting?.id ?? docId,
      };
    }
    return {
      status: "error",
      message: `Document insert failed: ${docInsErr?.message ?? "no row"}`,
    };
  }

  const { data: policy, error: polInsErr } = await supabase
    .from("insurance_policies")
    .insert({
      household_id: session.householdId,
      pet_id: petId,
      insurer_name: "Pending extraction…",
      document_id: doc.id,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (polInsErr || !policy) {
    return {
      status: "error",
      message: `Policy placeholder insert failed: ${polInsErr?.message ?? "no row"}`,
    };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "insurance_policy",
    entityId: policy.id,
    diff: {
      after: { source: "upload", document_id: doc.id, pet_id: petId },
    },
  });

  after(async () => {
    try {
      await processPolicyExtraction({
        documentId: doc.id,
        insurancePolicyId: policy.id,
        petId,
      });
    } catch (err) {
      console.error("processPolicyExtraction failed", err);
    }
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}
