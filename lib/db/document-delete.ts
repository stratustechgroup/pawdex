import "server-only";

import { recordAudit } from "@/lib/db/audit";
import { createServiceClient } from "@/lib/supabase/service";

export type DeleteDocumentResult =
  | {
      ok: true;
      counts: {
        extractions: number;
        chunks: number;
        feedback: number;
        pet_links: number;
        vaccinations_unlinked: number;
        events_unlinked: number;
        medications_unlinked: number;
        weights_unlinked: number;
        labs_unlinked: number;
        policies_unlinked: number;
      };
      storage_path: string;
      original_filename: string | null;
    }
  | { ok: false; error: string };

/**
 * Remove a document and every extraction artifact attached to it, then
 * delete the underlying storage object. Committed entities (vaccinations,
 * medical_events, medications, weight_log, lab_values, insurance_policies)
 * SURVIVE — their `document_id` back-references are nulled out so the data
 * remains usable without pointing at a row that's about to be deleted.
 *
 * Safe to call from any server context; performs its own household-scope
 * check before mutating.
 */
export async function deleteDocument(input: {
  householdId: string;
  actorId: string;
  documentId: string;
}): Promise<DeleteDocumentResult> {
  const supabase = createServiceClient();

  // 1. Verify the document belongs to this household.
  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select(
      "id, household_id, storage_bucket, storage_path, original_filename, pet_id",
    )
    .eq("id", input.documentId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.household_id !== input.householdId) {
    return { ok: false, error: "Document not in this household." };
  }

  // 2. Cleanup pass — extraction artifacts and unlinking derived entities.
  // Each step swallows-then-logs failure so a partial cleanup doesn't strand
  // the document row in a half-deleted state. We collect counts to report
  // back in audit_log + UI toast.
  const counts = {
    extractions: 0,
    chunks: 0,
    feedback: 0,
    pet_links: 0,
    vaccinations_unlinked: 0,
    events_unlinked: 0,
    medications_unlinked: 0,
    weights_unlinked: 0,
    labs_unlinked: 0,
    policies_unlinked: 0,
  };

  const cleanups: Array<{
    label: keyof typeof counts;
    op: () => Promise<{ count: number; error: string | null }>;
  }> = [
    {
      label: "extractions",
      op: async () => {
        const { data, error } = await supabase
          .from("document_extractions")
          .delete()
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "feedback",
      op: async () => {
        const { data, error } = await supabase
          .from("extraction_feedback")
          .delete()
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "chunks",
      op: async () => {
        const { data, error } = await supabase
          .from("extraction_chunks")
          .delete()
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "pet_links",
      op: async () => {
        const { data, error } = await supabase
          .from("document_pet_links")
          .delete()
          .eq("document_id", input.documentId)
          .select("document_id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "vaccinations_unlinked",
      op: async () => {
        const { data, error } = await supabase
          .from("vaccinations")
          .update({ document_id: null })
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "events_unlinked",
      op: async () => {
        const { data, error } = await supabase
          .from("medical_events")
          .update({ document_id: null })
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "medications_unlinked",
      op: async () => {
        const { data, error } = await supabase
          .from("medications")
          .update({ document_id: null })
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "weights_unlinked",
      op: async () => {
        const { data, error } = await supabase
          .from("weight_log")
          .update({ document_id: null })
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "labs_unlinked",
      op: async () => {
        const { data, error } = await supabase
          .from("lab_values")
          .update({ document_id: null })
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
    {
      label: "policies_unlinked",
      op: async () => {
        const { data, error } = await supabase
          .from("insurance_policies")
          .update({ document_id: null })
          .eq("document_id", input.documentId)
          .select("id");
        return { count: data?.length ?? 0, error: error?.message ?? null };
      },
    },
  ];

  for (const { label, op } of cleanups) {
    try {
      const r = await op();
      counts[label] = r.count;
      if (r.error) console.error(`deleteDocument ${label}: ${r.error}`);
    } catch (err) {
      console.error(`deleteDocument ${label} crashed`, err);
    }
  }

  // 3. Delete the document row itself.
  const { error: delErr } = await supabase
    .from("documents")
    .delete()
    .eq("id", input.documentId)
    .eq("household_id", input.householdId);
  if (delErr) {
    return {
      ok: false,
      error: `Failed to delete document row: ${delErr.message}`,
    };
  }

  // 4. Remove the storage object — best-effort. We've already deleted the DB
  // row, so a failure here leaves an orphan object the user can't see through
  // the UI but which still consumes storage. Log loudly + continue.
  const { error: storageErr } = await supabase.storage
    .from(doc.storage_bucket)
    .remove([doc.storage_path]);
  if (storageErr) {
    console.error(
      `deleteDocument: storage remove failed for ${doc.storage_path}: ${storageErr.message}`,
    );
  }

  // 5. Audit log entry — captures what was nulled vs deleted.
  await recordAudit({
    householdId: input.householdId,
    actorId: input.actorId,
    action: "delete",
    entityType: "document",
    entityId: input.documentId,
    diff: {
      after: {
        deleted: true,
        original_filename: doc.original_filename,
        storage_path: doc.storage_path,
        ...counts,
      },
    },
  });

  return {
    ok: true,
    counts,
    storage_path: doc.storage_path,
    original_filename: doc.original_filename,
  };
}
