import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PetCard } from "@/components/pet-card";
import { requireSession } from "@/lib/auth/household";
import { listPetsForHousehold } from "@/lib/db/pets";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Puppy" };

export default async function DashboardPage() {
  const session = await requireSession();
  const pets = await listPetsForHousehold(session.householdId);

  // Sign URLs for pet photos in one batch
  const supabase = await createClient();
  const photoMap = new Map<string, string>();
  const photoPaths = pets.filter((p) => p.photo_storage_path).map((p) => ({
    id: p.id,
    path: p.photo_storage_path!,
  }));
  if (photoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrls(
        photoPaths.map((p) => p.path),
        60 * 60,
      );
    if (data) {
      for (let i = 0; i < data.length; i++) {
        const signed = data[i];
        if (signed.signedUrl) {
          photoMap.set(photoPaths[i].id, signed.signedUrl);
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}{session.email ? `, ${session.email.split("@")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pets.length === 0
              ? "Let's add your first pet to get started."
              : `${pets.length} ${pets.length === 1 ? "pet" : "pets"} in ${session.householdName}.`}
          </p>
        </div>
      </div>

      {pets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              photoUrl={photoMap.get(pet.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Hi";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center">
      <h2 className="text-lg font-medium">No pets yet</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Add your first pet to start tracking vaccines, medications, and visits.
      </p>
      <Button asChild className="mt-5">
        <Link href="/pets/new">Add your first pet</Link>
      </Button>
    </div>
  );
}
