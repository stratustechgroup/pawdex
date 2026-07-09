import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/db/pets";
import { ageFromDob, kgToLbs } from "@/lib/utils";
import { PawPrint } from "lucide-react";

import { PetTabs } from "./pet-tabs";

export default async function PetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const pet = await getPet(session.householdId, petId);
  if (!pet) notFound();

  let photoUrl: string | null = null;
  if (pet.photo_storage_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrl(pet.photo_storage_path, 60 * 60);
    photoUrl = data?.signedUrl ?? null;
  }

  const age = ageFromDob(pet.date_of_birth);
  const headerDetails = [
    pet.breed,
    pet.sex !== "unknown" ? pet.sex : null,
    age,
    pet.current_weight_kg
      ? `${kgToLbs(Number(pet.current_weight_kg))} lbs`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-border">
            {photoUrl ? <AvatarImage src={photoUrl} alt={pet.name} /> : null}
            <AvatarFallback>
              <PawPrint className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {pet.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {headerDetails || pet.species}
            </p>
            {pet.microchip_number ? (
              <p className="text-muted-foreground text-xs">
                Microchip: <span className="font-mono">{pet.microchip_number}</span>
                {pet.microchip_registry ? ` · ${pet.microchip_registry}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/pets/${pet.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Separator className="my-6" />
      <PetTabs petId={pet.id} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
