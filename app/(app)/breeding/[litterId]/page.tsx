import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getLitter, listLitterAnimals } from "@/lib/db/litters";
import { getAnimal } from "@/lib/db/animals";

import { AddPuppyForm } from "./add-puppy-form";
import { PlacementControl } from "./placement-control";

export const metadata = { title: "Litter · Pawdex" };

export default async function LitterDetailPage({
  params,
}: {
  params: Promise<{ litterId: string }>;
}) {
  const { litterId } = await params;
  const session = await requireSession();

  const litter = await getLitter(session.householdId, litterId);
  if (!litter) notFound();

  const [puppies, dam, sire] = await Promise.all([
    listLitterAnimals(litterId),
    getAnimal(litter.dam_animal_id),
    litter.sire_animal_id ? getAnimal(litter.sire_animal_id) : Promise.resolve(null),
  ]);

  // Map animal_id -> pet id so each puppy links to its full record.
  const supabase = await createClient();
  const petByAnimal = new Map<string, string>();
  if (puppies.length > 0) {
    const { data: pets } = await supabase
      .from("pets")
      .select("id, animal_id")
      .eq("household_id", session.householdId)
      .is("deleted_at", null)
      .in(
        "animal_id",
        puppies.map((p) => p.id),
      );
    for (const p of pets ?? []) {
      if (p.animal_id) petByAnimal.set(p.animal_id, p.id);
    }
  }

  const canEdit = session.role !== "viewer";

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "8px 4px 48px" }}>
      <Link
        href="/breeding"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "500 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <Icon name="arrowLeft" size={14} />
        All litters
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1
          className="serif"
          style={{
            margin: "0 0 4px",
            font: "500 26px var(--font-source-serif)",
            color: "var(--pw-text)",
          }}
        >
          {litter.name}
        </h1>
        <p
          style={{
            margin: 0,
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Dam {dam?.name ?? "unknown"}
          {sire ? ` · Sire ${sire.name}` : " · Sire external"}
          {litter.whelped_on
            ? ` · Whelped ${format(parseISO(litter.whelped_on), "MMM d, yyyy")}`
            : ""}
        </p>
      </div>

      <section style={{ marginBottom: 30 }}>
        <h2
          style={{
            margin: "0 0 12px",
            font: "600 14px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Puppies ({puppies.length})
        </h2>

        {puppies.length === 0 ? (
          <div
            className="pw-card"
            style={{
              padding: 24,
              textAlign: "center",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            No puppies yet. Add the first one below.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {puppies.map((puppy) => {
              const petId = petByAnimal.get(puppy.id);
              return (
                <li
                  key={puppy.id}
                  className="pw-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    flexWrap: "wrap",
                  }}
                >
                  <PetPhoto name={puppy.name} size={38} />
                  <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                    <div
                      style={{
                        font: "600 14px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {puppy.name}
                    </div>
                    <div
                      style={{
                        font: "400 12px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {puppy.breed ?? puppy.species}
                      {puppy.sex !== "unknown" ? ` · ${puppy.sex}` : ""}
                    </div>
                  </div>

                  <PlacementControl
                    litterId={litterId}
                    animalId={puppy.id}
                    status={puppy.placement_status}
                    disabled={!canEdit}
                  />

                  {petId && (
                    <Link
                      href={`/pets/${petId}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 6,
                        border: "1px solid var(--pw-border-strong)",
                        background: "var(--pw-surface)",
                        color: "var(--pw-text)",
                        font: "500 12px var(--font-inter)",
                        textDecoration: "none",
                      }}
                    >
                      Record
                      <Icon name="chevronRight" size={13} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canEdit && (
        <section>
          <h2
            style={{
              margin: "0 0 12px",
              font: "600 14px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            Add a puppy
          </h2>
          <div className="pw-card" style={{ padding: 18 }}>
            <AddPuppyForm
              litterId={litterId}
              defaultSpecies={dam?.species ?? "dog"}
              defaultBreed={dam?.breed ?? null}
            />
          </div>
        </section>
      )}
    </main>
  );
}
