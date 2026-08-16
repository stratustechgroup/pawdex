/**
 * Airline pet-policy links — curated, dated, deliberately NOT encoded as
 * rules.
 *
 * The Aug 2026 research (docs/pet-passport-deep-dive.md §5) found these
 * policies high-churn and mostly undated: Alaska's CMS showed an update three
 * days before retrieval and a live dated breed embargo; Delta's fee is keyed
 * to ticket-issue date; two of six carriers sit behind bot walls. Encoding
 * hard numbers that churn like that would go stale in a damaging way, so the
 * launch posture is structural facts + the official link + a retrieval date,
 * and "verify with the airline" always.
 *
 * Only quote-verified structural facts appear below. United's site was
 * unverifiable (SPA shell) — link only, no facts, and that is stated rather
 * than papered over. Lufthansa's facts come from Wayback snapshots of the
 * official pages and are flagged.
 */

export type AirlineEntry = {
  name: string;
  policy_url: string;
  /** Two-line structural summary. Empty when unverified. */
  facts: string[];
  retrieved_at: string;
  /** Set when the facts could not be verified against the live site. */
  unverified_note?: string;
};

export const AIRLINES: AirlineEntry[] = [
  {
    name: "American Airlines",
    policy_url: "https://www.aa.com/i18n/travel-info/special-assistance/pets.html",
    facts: [
      "Checked/cargo pets are limited to active-duty US military and State Department personnel — everyone else is in-cabin only.",
      "Seasonal embargo: non-cabin pets can't route via PHX, TUS, LAS or PSP May 1 – Sep 30.",
    ],
    retrieved_at: "2026-08-16",
  },
  {
    name: "Delta",
    policy_url: "https://www.delta.com/us/en/pet-travel/overview",
    facts: [
      "Cargo shipment is limited to active US military / Foreign Service; others carry in-cabin within size limits.",
      "Watch the operating carrier: Delta Connection prohibits live animals on flights outside the US except Canada.",
    ],
    retrieved_at: "2026-08-16",
  },
  {
    name: "United",
    policy_url: "https://www.united.com/en/us/fly/travel/traveling-with-pets.html",
    facts: [],
    retrieved_at: "2026-08-16",
    unverified_note:
      "United's policy page could not be verified at last check — read it directly and confirm with the airline.",
  },
  {
    name: "Alaska Airlines",
    policy_url:
      "https://www.alaskaair.com/content/travel-info/policies/pets-traveling-with-pets/pets-in-cabin",
    facts: [
      "Still sells baggage-compartment carriage to the general public ($200 each way per kennel at last check).",
      "Runs dated breed embargoes — French/English Bulldogs barred from the hold Jul 31 – Sep 30, 2026.",
    ],
    retrieved_at: "2026-08-16",
  },
  {
    name: "Southwest",
    policy_url: "https://support.southwest.com/helpcenter/s/article/pet-policy",
    facts: [
      "No pets in cargo at all — small cats and dogs in-cabin only, in a carrier under the seat.",
      "Domestic routes only (plus limited exceptions) — not an option for EU/GB travel itself.",
    ],
    retrieved_at: "2026-08-16",
  },
  {
    name: "Lufthansa",
    policy_url: "https://www.lufthansa.com/us/en/travelling-with-animals",
    facts: [
      "Cabin allowance is weight-capped (small pets incl. carrier); larger animals travel in the hold at route-based pricing.",
    ],
    retrieved_at: "2026-07-29",
    unverified_note:
      "Facts from an archived copy of the official page — the live site blocked verification. Confirm directly before booking.",
  },
];
