import { ActivityFeed } from "@/components/pawdex/cockpit/activity-feed";
import { InsightCards } from "@/components/pawdex/cockpit/insight-card";
import { PawdexPetCard } from "@/components/pawdex/pet-card";
import { WeightTrendChart } from "@/components/pawdex/weight-trend-chart";
import type { ActivityItem } from "@/lib/db/activity";
import type { Insight } from "@/lib/db/insights";
import type { PetWithStatus } from "@/lib/db/pets";

// The hero visual: one large, dense surface of the real product.
//
// This is the single change that separates this page from the version before
// it. Linear, Mercury and Oura all lead with one big real image; a marketing
// page assembled only from boxes, hairlines and type reads as a wireframe no
// matter how carefully the type is set. Pawdex has no photography, so the honest
// equivalent is Linear's: a large, genuinely dense screenshot of the product.
//
// Every component here is the one the signed-in app renders. Nothing is drawn
// to look like the product. The whole surface is inert, so none of the links
// inside it are focusable, and it is aria-hidden with a text description
// alongside, because a screen reader gains nothing from walking a screenshot.

const PETS: PetWithStatus[] = [
  {
    name: "Maple",
    species: "dog",
    breed: "Golden Retriever",
    sex: "female",
    date_of_birth: "2017-04-02",
    status: "up_to_date",
    next_due_label: "Rabies due 2027-03-11",
    id: "s1",
  },
  {
    name: "Juniper",
    species: "cat",
    breed: "Domestic Shorthair",
    sex: "female",
    date_of_birth: "2021-08-19",
    status: "due_soon",
    next_due_label: "FVRCP due in 3 weeks",
    id: "s2",
  },
].map((p) => p as unknown as PetWithStatus);

const WEIGHTS = [
  { recorded_on: "2025-09-14", weight_kg: 27.1 },
  { recorded_on: "2025-12-02", weight_kg: 27.9 },
  { recorded_on: "2026-02-21", weight_kg: 28.6 },
  { recorded_on: "2026-05-08", weight_kg: 28.4 },
  { recorded_on: "2026-07-30", weight_kg: 27.6 },
];

const INSIGHTS: Insight[] = [
  {
    id: "i1",
    petId: "s1",
    petName: "Maple",
    tone: "watch",
    icon: "scale",
    headline: "Maple is down 1.0 kg since February",
    citation: "28.6 kg on Feb 21 to 27.6 kg on Jul 30, 4 of 5 entries",
    href: "#",
  },
];

const ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    kind: "document_reviewed",
    icon: "fileCheck",
    title: "Annual exam, Lakeside Animal Hospital",
    detail: "6 facts added, 1 skipped as duplicate",
    petName: "Maple",
    actorName: "You",
    at: "2026-07-30T14:12:00.000Z",
    href: null,
  },
  {
    id: "a2",
    kind: "document_added",
    icon: "file",
    title: "Rabies certificate, 3 year",
    detail: "Forwarded from your inbox, 41 pages read",
    petName: "Maple",
    actorName: "You",
    at: "2026-07-28T09:41:00.000Z",
    href: null,
  },
  {
    id: "a3",
    kind: "member_joined",
    icon: "user",
    title: "Dana joined the household",
    detail: "Full access",
    petName: null,
    actorName: "You",
    at: "2026-07-12T18:03:00.000Z",
    href: null,
  },
];

export function ProductSurface() {
  return (
    <figure className="mk-surface">
      <div className="mk-surface-frame" inert aria-hidden="true">
        <div className="mk-surface-bar">
          <span className="mk-surface-dot" />
          <span className="mk-surface-title">Maple and Juniper</span>
          <span className="mk-surface-meta">Household</span>
        </div>

        <div className="mk-surface-body">
          <div className="mk-surface-col">
            {PETS.map((p) => (
              <PawdexPetCard key={p.id} pet={p} photoUrl={null} />
            ))}
          </div>

          <div className="mk-surface-col mk-surface-col--wide">
            <div className="mk-surface-panel">
              <div className="mk-surface-chart">
                <WeightTrendChart data={WEIGHTS} />
              </div>
            </div>
            <InsightCards insights={INSIGHTS} />
          </div>

          <div className="mk-surface-col">
            <div className="mk-surface-panel-head">Recent</div>
            <ActivityFeed items={ACTIVITY} />
          </div>
        </div>
      </div>

      <figcaption className="mk-surface-caption">
        Pawdex with two pets: vaccination status, a weight trend read from
        eleven documents, and every change in the household as it happens.
      </figcaption>
    </figure>
  );
}
