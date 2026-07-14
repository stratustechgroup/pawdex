"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { sanitizeHttpUrl } from "@/lib/security/url";
import { createServiceClient } from "@/lib/supabase/service";
import type { PharmacySource } from "@/lib/supabase/types";

const VALID_SOURCES: PharmacySource[] = [
  "chewy",
  "costco",
  "goodrx",
  "1800petmeds",
  "walmart",
  "vet_in_house",
  "other",
];

export async function addPriceQuote(formData: FormData): Promise<void> {
  const petId = String(formData.get("pet_id") ?? "");
  const medicationId = String(formData.get("medication_id") ?? "");
  const sourceRaw = String(formData.get("source") ?? "");
  const packLabel = String(formData.get("pack_size_label") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "");
  const linkUrl = sanitizeHttpUrl(String(formData.get("link_url") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!petId || !medicationId) throw new Error("pet_id + medication_id required");
  if (!VALID_SOURCES.includes(sourceRaw as PharmacySource)) {
    throw new Error("Pick a pharmacy from the list.");
  }
  const priceNum = Number(priceRaw);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    throw new Error("Enter a valid price.");
  }
  const priceCents = Math.round(priceNum * 100);

  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't add price quotes.");
  const supabase = createServiceClient();
  const { data: med } = await supabase
    .from("medications")
    .select("id, household_id, pet_id, name")
    .eq("id", medicationId)
    .maybeSingle();
  if (
    !med ||
    med.household_id !== session.householdId ||
    med.pet_id !== petId
  ) {
    throw new Error("Medication not found in this household.");
  }

  const { data, error } = await supabase
    .from("medication_price_quotes")
    .insert({
      household_id: session.householdId,
      pet_id: petId,
      medication_id: medicationId,
      source: sourceRaw as PharmacySource,
      pack_size_label: packLabel,
      price_cents: priceCents,
      link_url: linkUrl,
      notes,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save: ${error?.message ?? "no row"}`);
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "medication_price_quote",
    entityId: data.id,
    diff: {
      after: {
        medication_id: medicationId,
        medication_name: med.name,
        source: sourceRaw,
        price_cents: priceCents,
      },
    },
  });

  revalidatePath(`/pets/${petId}/medications/${medicationId}/prices`);
}

export async function deletePriceQuote(formData: FormData): Promise<void> {
  const id = String(formData.get("quote_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  const medicationId = String(formData.get("medication_id") ?? "");
  if (!id) throw new Error("quote_id required");
  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't delete price quotes.");
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("medication_price_quotes")
    .delete()
    .eq("id", id)
    .eq("household_id", session.householdId);
  if (error) throw new Error(`Delete failed: ${error.message}`);

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "medication_price_quote",
    entityId: id,
  });

  if (petId && medicationId) {
    revalidatePath(`/pets/${petId}/medications/${medicationId}/prices`);
  }
}
