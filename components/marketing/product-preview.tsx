import type { CSSProperties } from "react";

import { PawdexPetCard } from "@/components/pawdex/pet-card";
import { StatusBadge } from "@/components/pawdex/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PetWithStatus } from "@/lib/db/pets";

// Real product, not a drawing of it.
//
// Everything on this page that shows the product renders the SAME components
// the signed-in app renders: PawdexPetCard, StatusBadge, Skeleton. The previous
// version of this page built lookalikes out of styled divs, which is the most
// reliable tell that nobody has seen the actual product, and it rots the moment
// the real UI moves.
//
// Two consequences worth stating rather than hiding:
//
//   1. These previews inherit the app's own icon set and its ` · ` separators.
//      That is correct. A real preview shows the product as it is, not a
//      marketing-styled variant of it.
//   2. The card is a <Link> into an authenticated route. Every preview is
//      therefore wrapped in `inert`, so nothing inside is focusable or
//      clickable, and each figure carries its own caption for screen readers.
//
// The sample data is sample data and says so. The numbers are shapes of real
// records (a 3-year rabies, an Apoquel course, a weight in kg), not invented
// precision about the business.

function Frame({
  caption,
  children,
  style,
}: {
  caption: string;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <figure className="mk-preview" style={style}>
      {/* inert keeps the embedded app UI non-interactive: the pet card is a
          link into a signed-in route, and a marketing page must not offer a
          tab stop that goes nowhere. */}
      <div className="mk-preview-stage" inert>
        {children}
      </div>
      <figcaption className="mk-preview-caption">{caption}</figcaption>
    </figure>
  );
}

// A display-only row. The card reads name, species, breed, sex, date_of_birth,
// status and next_due_label, so those are real; the remaining columns exist to
// satisfy the row type and are never read here.
function samplePet(over: Partial<PetWithStatus>): PetWithStatus {
  return {
    name: "Maple",
    species: "dog",
    breed: "Golden Retriever",
    sex: "female",
    date_of_birth: "2017-04-02",
    status: "up_to_date",
    next_due_label: "Rabies due 2027-03-11",
    id: "sample",
    ...over,
  } as PetWithStatus;
}

export function PetCardPreview() {
  return (
    <Frame caption="A pet in Pawdex, with its next due date on the card.">
      <PawdexPetCard pet={samplePet({})} photoUrl={null} />
    </Frame>
  );
}

export function StatusRowPreview() {
  const rows = [
    { kind: "up" as const, label: "Rabies, 3 year", meta: "2024-03-11" },
    { kind: "due" as const, label: "Lepto booster", meta: "due Jun 2027" },
    { kind: "overdue" as const, label: "Heartworm test", meta: "18 months ago" },
  ];
  return (
    <Frame caption="Vaccination status, as the app shows it.">
      <ul className="mk-preview-rows">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="mk-preview-row-label">{r.label}</span>
            <time className="mk-preview-row-meta">{r.meta}</time>
            <StatusBadge kind={r.kind} />
          </li>
        ))}
      </ul>
    </Frame>
  );
}

// The genuine loading state. Pawdex reads a forwarded document with a model,
// which takes real seconds, and the app shows the record's shape while it
// works rather than a spinner over an empty page. Showing that here is both an
// honest loading state and a demonstration of what the product does.
export function IngestingPreview() {
  return (
    <Frame caption="While a forwarded document is being read.">
      <div className="mk-preview-ingest">
        <div className="mk-preview-ingest-head">
          <Skeleton className="h-4 w-40" />
          <span className="mk-preview-ingest-status">Reading 41 pages</span>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[82%]" />
        <Skeleton className="h-3 w-[64%]" />
        <Skeleton className="h-3 w-[91%]" />
      </div>
    </Frame>
  );
}
