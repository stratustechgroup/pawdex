/**
 * Re-runnable safety net for the animal-identity backfill in migration 0024.
 *
 * For every `pets` row that still has a null animal_id, create the mirrored
 * `animals` row, link it, and open an owner custodianship in the pet's
 * household — the same three steps the migration performs. Any pet inserted by
 * the legacy path after the migration ran (before app code learns to create
 * animals itself) gets caught here.
 *
 * Usage:
 *   pnpm dlx tsx scripts/backfill-animals.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env. Safe to
 * re-run — only touches pets where animal_id IS NULL.
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: pets, error } = await supabase
    .from("pets")
    .select(
      "id, household_id, name, species, breed, sex, altered, date_of_birth, dob_is_estimated, color, markings, microchip_number, microchip_registry, microchip_implanted_on, photo_storage_path, current_weight_kg, acquired_on, allergies, notes, archived_at, created_at, updated_at, created_by",
    )
    .is("animal_id", null);
  if (error) throw new Error(`fetch pets: ${error.message}`);

  console.log(`Backfilling ${pets?.length ?? 0} pets missing an animal…`);

  let ok = 0;
  let skipped = 0;
  for (const pet of pets ?? []) {
    // 1. Create the mirrored animal.
    const { data: animal, error: animalErr } = await supabase
      .from("animals")
      .insert({
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        sex: pet.sex,
        altered: pet.altered,
        date_of_birth: pet.date_of_birth,
        dob_is_estimated: pet.dob_is_estimated,
        color: pet.color,
        markings: pet.markings,
        microchip_number: pet.microchip_number,
        microchip_registry: pet.microchip_registry,
        microchip_implanted_on: pet.microchip_implanted_on,
        photo_storage_path: pet.photo_storage_path,
        current_weight_kg: pet.current_weight_kg,
        acquired_on: pet.acquired_on,
        allergies: pet.allergies,
        notes: pet.notes,
        archived_at: pet.archived_at,
        created_at: pet.created_at,
        updated_at: pet.updated_at,
        created_by: pet.created_by,
      })
      .select("id")
      .single();
    if (animalErr || !animal) {
      console.warn(`skip pet ${pet.id} — animal insert: ${animalErr?.message}`);
      skipped++;
      continue;
    }

    // 2. Link the pet.
    const { error: linkErr } = await supabase
      .from("pets")
      .update({ animal_id: animal.id })
      .eq("id", pet.id)
      .is("animal_id", null); // guard against a concurrent backfill
    if (linkErr) {
      console.warn(`skip pet ${pet.id} — link: ${linkErr.message}`);
      await supabase.from("animals").delete().eq("id", animal.id);
      skipped++;
      continue;
    }

    // 3. Open the owner custodianship.
    const { error: custErr } = await supabase.from("custodianships").insert({
      animal_id: animal.id,
      household_id: pet.household_id,
      role: "owner",
      started_at: pet.created_at,
      created_by: pet.created_by,
    });
    if (custErr) {
      console.warn(`pet ${pet.id} linked but custodianship failed: ${custErr.message}`);
      skipped++;
      continue;
    }
    ok++;
  }

  console.log(`Done. linked=${ok} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
