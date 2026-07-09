"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { diffOf, recordAudit } from "@/lib/db/audit";

type Result = { ok: true } | { ok: false; error: string };

export async function setPetPhoto(
  petId: string,
  storagePath: string | null,
): Promise<Result> {
  if (!petId) return { ok: false, error: "Missing pet id" };

  const session = await requireSession();
  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("pets")
    .select("id, photo_storage_path")
    .eq("household_id", session.householdId)
    .eq("id", petId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Pet not found" };

  const { error: updErr } = await supabase
    .from("pets")
    .update({ photo_storage_path: storagePath })
    .eq("household_id", session.householdId)
    .eq("id", petId);

  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "pet",
    entityId: petId,
    diff: diffOf(
      { photo_storage_path: existing.photo_storage_path },
      { photo_storage_path: storagePath },
    ),
  });

  // If the user removed/replaced an existing photo, try to delete the old
  // object so storage doesn't fill up with orphans. Best-effort.
  if (
    existing.photo_storage_path &&
    existing.photo_storage_path !== storagePath
  ) {
    try {
      await supabase.storage
        .from("pet-photos")
        .remove([existing.photo_storage_path]);
    } catch (err) {
      console.error("setPetPhoto: failed to remove old photo:", err);
    }
  }

  revalidatePath("/");
  revalidatePath(`/pets/${petId}`);
  revalidatePath(`/pets/${petId}/edit`);
  return { ok: true };
}
