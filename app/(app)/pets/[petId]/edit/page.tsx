import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/household";
import { getPet } from "@/lib/db/pets";

export const metadata = { title: "Edit pet — Puppy" };

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const pet = await getPet(session.householdId, petId);
  if (!pet) notFound();

  return (
    <div className="max-w-2xl space-y-2">
      <h2 className="text-lg font-medium">Edit {pet.name}</h2>
      <p className="text-muted-foreground text-sm">
        Editing comes in a follow-up commit — for now, archive and re-create if you need
        major changes, or update fields via the database.
      </p>
    </div>
  );
}
