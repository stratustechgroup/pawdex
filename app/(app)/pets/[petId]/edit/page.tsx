import { notFound } from "next/navigation";

import { PetForm } from "@/app/(app)/pets/new/pet-form";
import { PetPhotoUploader } from "@/components/pawdex/pet-photo-uploader";
import { tintFromString } from "@/components/pawdex/pet-photo";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/db/pets";
import type { PetFormValues } from "@/lib/schemas/pet";
import { kgToLbs } from "@/lib/utils";

export const metadata = { title: "Edit pet — Pawdex" };

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const pet = await getPet(session.householdId, petId);
  if (!pet) notFound();

  const supabase = await createClient();
  let photoUrl: string | null = null;
  if (pet.photo_storage_path) {
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrl(pet.photo_storage_path, 60 * 60);
    photoUrl = data?.signedUrl ?? null;
  }

  const weightKg =
    pet.current_weight_kg != null ? Number(pet.current_weight_kg) : null;
  const weightValue =
    weightKg != null && !Number.isNaN(weightKg)
      ? String(kgToLbs(weightKg))
      : "";

  const initial: PetFormValues = {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? "",
    sex: pet.sex,
    altered: pet.altered === true ? "yes" : pet.altered === false ? "no" : "",
    date_of_birth: pet.date_of_birth ?? "",
    dob_is_estimated: pet.dob_is_estimated,
    acquired_on: pet.acquired_on ?? "",
    color: pet.color ?? "",
    markings: pet.markings ?? "",
    microchip_number: pet.microchip_number ?? "",
    microchip_registry: pet.microchip_registry ?? "",
    microchip_implanted_on: pet.microchip_implanted_on ?? "",
    weight_value: weightValue,
    weight_unit: "lbs",
    allergies: pet.allergies ?? "",
    notes: pet.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8 space-y-1">
        <h1
          className="serif"
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--pw-text)",
          }}
        >
          Edit {pet.name}
        </h1>
        <p
          style={{
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Changes are saved to {session.householdName}'s household and synced to
          everyone who shares it.
        </p>
      </div>

      <div
        style={{
          marginBottom: 24,
          paddingBottom: 24,
          borderBottom: "1px solid var(--pw-border)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <PetPhotoUploader
          petId={pet.id}
          householdId={session.householdId}
          currentPhotoUrl={photoUrl}
          currentInitial={pet.name}
          tint={tintFromString(pet.name)}
        />
      </div>

      <PetForm mode="edit" petId={pet.id} initial={initial} />
    </div>
  );
}
