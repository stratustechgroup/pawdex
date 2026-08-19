import type { CSSProperties } from "react";

import { PawdexPetCard } from "@/components/pawdex/pet-card";
import { StatusBadge } from "@/components/pawdex/status-badge";
import type { PetWithStatus } from "@/lib/db/pets";

// Real product, not a drawing of it.
//
// Everything on this page that shows the product renders the SAME components
// the signed-in app renders: PawdexPetCard, StatusBadge. The previous
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

// The genuine in-progress state. Pawdex reads a forwarded document with a
// model, which takes real seconds.
//
// This used to render four shimmering Skeleton bars. Two things were wrong
// with that. A shimmer block is a drawing of loading rather than a report of
// it, and it tells a visitor nothing about what the product is doing; and a
// marketing page is server-rendered with the data already in hand, so the
// shimmer was animating over content that was never going to arrive.
//
// What replaces it is the extraction itself, mid-flight: the fields that have
// resolved carry their value and their page citation, the ones still being
// read say so, and the progress is a determinate count of pages rather than an
// indefinite pulse. It is an honest state and a demonstration at the same
// time.
const INGEST_FIELDS = [
  { label: "Rabies, 3 year", value: "2024-03-11", cite: "p. 2" },
  { label: "Weight", value: "28.4 kg", cite: "p. 2" },
  { label: "Apoquel 16mg", value: "reading", cite: null },
  { label: "T4 panel", value: "reading", cite: null },
];

export function IngestingPreview() {
  const read = 27;
  const total = 41;
  return (
    <Frame caption="While a forwarded document is being read.">
      <div className="mk-preview-ingest">
        <div className="mk-preview-ingest-head">
          <span className="mk-preview-ingest-file">Maple_annual_2024.pdf</span>
          <span className="mk-preview-ingest-status">
            {read} of {total} pages
          </span>
        </div>
        <div
          className="mk-preview-ingest-rule"
          role="progressbar"
          aria-label="Pages read"
          aria-valuenow={read}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <span style={{ inlineSize: `${(read / total) * 100}%` }} />
        </div>
        <ul className="mk-preview-ingest-fields">
          {INGEST_FIELDS.map((f) => (
            <li key={f.label} data-pending={f.cite ? undefined : "true"}>
              <span className="mk-preview-ingest-label">{f.label}</span>
              <span className="mk-preview-ingest-value">{f.value}</span>
              {f.cite ? (
                <span className="mk-cite">{f.cite}</span>
              ) : (
                <span className="mk-preview-ingest-wait" aria-hidden="true">
                  ...
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}
