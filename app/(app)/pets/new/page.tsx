import { PetForm } from "./pet-form";

export const metadata = { title: "Add a pet — Puppy" };

export default function NewPetPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add a pet</h1>
        <p className="text-muted-foreground text-sm">
          You can update or fill in missing details later — only the name and species are
          required.
        </p>
      </div>
      <PetForm />
    </div>
  );
}
