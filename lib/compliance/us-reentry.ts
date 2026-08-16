/**
 * US re-entry requirements — the return leg of a round trip.
 *
 * Outbound-only readiness strands people at the border coming home. The CDC
 * dog-importation regime effective August 1, 2024 (42 CFR 71.51) applies to
 * ALL dogs entering the US, including US-origin pets returning from a
 * two-week vacation. Verified against eCFR and CDC pages (captures) retrieved
 * 2026-08-15/16 — quotes in docs/pet-passport-deep-dive.md §3:
 *
 * - "All importers of dogs must submit a complete and accurate CDC dog import
 *   form to CDC via a CDC-approved system prior to the dogs arriving in the
 *   United States." (71.51(h)(1)). From dog-rabies-free or low-risk countries
 *   (all EU, UK, Japan) the form receipt is the ONLY required document; it is
 *   free, valid 6 months for the same departure country, any port of entry.
 * - "All dogs presented for admission into the United States must be at least
 *   six (6) months old at the time of their arrival." (71.51(f)(1)) — the trap
 *   for puppies taken abroad: they cannot come home until 6 months old.
 * - Microchip "must have been implanted on or before the date the current
 *   rabies vaccine was administered" (71.51(g)(2)).
 * - High-risk wrinkle: Spain's Ceuta and Melilla ARE on the CDC high-risk
 *   list (Apr 15, 2026 version) even though mainland Spain is not. A dog that
 *   has been in a high-risk country in the previous 6 months faces a much
 *   stricter regime.
 * - "Cats are not required to have proof of rabies vaccination for
 *   importation into the United States." (CDC)
 *
 * These rows are appended to every outbound report by the dispatcher. They
 * never gate outbound readiness — they are the checklist for coming home.
 */

import { differenceInDays, parseISO } from "date-fns";

import {
  coveredSpecies,
  type ComplianceInputs,
  type Requirement,
} from "./eu-passport";

export function usReentryRequirements(input: ComplianceInputs): Requirement[] {
  const species = coveredSpecies(input.pet.species);
  const travelDate = input.travel_date ? parseISO(input.travel_date) : null;
  const rows: Requirement[] = [];

  if (species === "cat") {
    rows.push({
      id: "us-reentry",
      label: "US re-entry (coming home)",
      status: "na",
      gates_readiness: false,
      detail:
        "CDC does not require proof of rabies vaccination for cats entering the US. No import form is needed for a cat returning home.",
      action_required: null,
    });
    return rows;
  }

  if (species !== "dog") return rows;

  // ── The 6-month age floor: hard federal minimum, no exceptions by origin.
  if (input.pet.date_of_birth) {
    const dob = parseISO(input.pet.date_of_birth);
    const reference = travelDate ?? new Date();
    // Age on the outbound date is the best available proxy for the return —
    // the return is later, so if the pet clears 6 months outbound it clears
    // it coming home; if it's under 6 months outbound, warn with specifics.
    const ageDaysAtTravel = differenceInDays(reference, dob);
    if (ageDaysAtTravel < 183) {
      rows.push({
        id: "us-reentry-age",
        label: "US re-entry: 6-month minimum age",
        status: "warning",
        gates_readiness: false,
        detail: `${input.pet.name} would be about ${Math.floor(ageDaysAtTravel / 7)} weeks old at travel. US federal rules admit NO dog under 6 months of age, regardless of where it's coming from — a puppy taken abroad cannot come home until it turns 6 months.`,
        action_required:
          "If the return would happen before the 6-month birthday, don't take the puppy abroad. There is no waiver.",
      });
    }
  }

  // ── The form. Free, quick, but mandatory — and unknown to most travelers.
  rows.push({
    id: "us-reentry-form",
    label: "US re-entry: CDC Dog Import Form",
    status: "todo",
    gates_readiness: false,
    detail:
      "Every dog entering the US needs a CDC Dog Import Form receipt — including your own dog coming home from vacation. From low-risk countries (all EU, UK, Japan) the receipt is the only required document. It's free, online, valid 6 months for the same departure country, any port of entry. Caution: a dog that has been in a HIGH-RISK rabies country in the previous 6 months faces a much stricter regime — and the list has surprises (Spain's Ceuta and Melilla are high-risk while mainland Spain is not).",
    action_required:
      "Submit the CDC Dog Import Form online before the return flight and keep the receipt on your phone. Check CDC's current high-risk list if your itinerary includes side trips.",
  });

  return rows;
}
