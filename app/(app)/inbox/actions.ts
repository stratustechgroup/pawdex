"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { createServiceClient } from "@/lib/supabase/service";

export async function assignDocumentToPet(formData: FormData): Promise<void> {
  const documentId = formData.get("document_id");
  const petId = formData.get("pet_id");
  if (typeof documentId !== "string" || !documentId) {
    throw new Error("document_id is required");
  }
  if (typeof petId !== "string" || !petId) {
    throw new Error("pet_id is required");
  }

  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't assign documents.");
  const supabase = createServiceClient();

  // Confirm both belong to this household before mutating.
  const [{ data: doc }, { data: pet }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, household_id, pet_id, processing_status")
      .eq("id", documentId)
      .maybeSingle(),
    supabase
      .from("pets")
      .select("id, household_id")
      .eq("id", petId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!doc || doc.household_id !== session.householdId) {
    throw new Error("Document not found in this household.");
  }
  if (!pet || pet.household_id !== session.householdId) {
    throw new Error("Pet not found in this household.");
  }

  const { error } = await supabase
    .from("documents")
    .update({ pet_id: petId })
    .eq("id", documentId);
  if (error) throw new Error(`assignDocumentToPet: ${error.message}`);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "document",
    entityId: documentId,
    diff: {
      before: { pet_id: doc.pet_id },
      after: { pet_id: petId, reason: "inbox_assign" },
    },
  });

  revalidatePath("/inbox");
  revalidatePath(`/pets/${petId}/documents`);

  // If extraction is already finished, send the user straight to review.
  if (doc.processing_status === "extracted") {
    redirect(`/pets/${petId}/documents/${documentId}/review`);
  }
  // Otherwise just send them to the pet's documents page so they can wait.
  redirect(`/pets/${petId}/documents`);
}
