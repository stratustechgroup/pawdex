import Link from "next/link";
import { format, parseISO } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listLittersForHousehold } from "@/lib/db/litters";
import { listAnimalsForHousehold } from "@/lib/db/animals";

import { BreederEnable } from "./breeder-enable";
import { CreateLitterForm } from "./create-litter-form";

export const metadata = { title: "Breeding · Pawdex" };

export default async function BreedingPage() {
  const session = await requireSession();

  if (session.householdKind !== "breeder") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 48px" }}>
        <BreederEnable canEnable={session.role === "owner"} />
      </main>
    );
  }

  const [litters, animals] = await Promise.all([
    listLittersForHousehold(session.householdId),
    listAnimalsForHousehold(session.householdId),
  ]);

  const nameById = new Map<string, string>(animals.map((a) => [a.id, a.name]));

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "8px 4px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          className="serif"
          style={{
            margin: "0 0 4px",
            font: "500 26px var(--font-source-serif)",
            color: "var(--pw-text)",
          }}
        >
          Breeding
        </h1>
        <p
          style={{
            margin: 0,
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Group your animals into litters, track placements, and hand puppies to
          their new families with a transfer link.
        </p>
      </div>

      <section style={{ marginBottom: 32 }}>
        <SectionHead
          title="New litter"
          sub="Pick the dam from your animals. Sire and whelp date are optional."
        />
        <div className="pw-card" style={{ padding: 18 }}>
          <CreateLitterForm animals={animals.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </section>

      <section>
        <SectionHead title="Litters" sub={`${litters.length} on file`} />
        {litters.length === 0 ? (
          <div
            className="pw-card"
            style={{
              padding: 28,
              textAlign: "center",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            No litters yet. Create one above to start adding puppies.
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
            {litters.map((litter) => (
              <li key={litter.id}>
                <Link
                  href={`/breeding/${litter.id}`}
                  className="pw-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    textDecoration: "none",
                    color: "var(--pw-text)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 38,
                      height: 38,
                      borderRadius: 9,
                      background: "var(--pw-accent-soft)",
                      color: "var(--pw-accent-fg-on-soft)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="paw" size={18} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        font: "600 14px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {litter.name}
                    </div>
                    <div
                      style={{
                        font: "400 12px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      Dam {nameById.get(litter.dam_animal_id) ?? "unknown"}
                      {litter.sire_animal_id
                        ? ` · Sire ${nameById.get(litter.sire_animal_id) ?? "unknown"}`
                        : ""}
                      {litter.whelped_on
                        ? ` · Whelped ${format(parseISO(litter.whelped_on), "MMM d, yyyy")}`
                        : ""}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={16} style={{ color: "var(--pw-text-subtle)" }} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
