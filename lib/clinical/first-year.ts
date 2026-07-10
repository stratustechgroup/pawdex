/**
 * First-year care plan, a PURE projection of the typical first-year
 * veterinary schedule for a puppy or kitten, computed from species + date of
 * birth. No database, no I/O, no randomness: same inputs always yield the same
 * plan, which is what makes scripts/test-first-year.ts deterministic.
 *
 * Sources: AAHA Canine Vaccination Guidelines (2022), AAFP/AAHA Feline
 * Vaccination Guidelines (2020), CDC rabies timing, common US wellness
 * practice. This is a GUIDE, not a diagnosis or a schedule of record. Every
 * surface that renders it must frame it as "typical schedule, confirm with
 * your vet." Pawdex never makes the legal call on rabies; state law controls.
 *
 * Ages are expressed as a target week and a human window. Dates are computed
 * as birthDate + (targetWeeks * 7 days) and returned as yyyy-mm-dd strings.
 * `asOf` (default: now) splits each item into past vs. upcoming so the caller
 * can, e.g., only schedule reminders for future-dated milestones.
 */

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import type { VaccineFamily } from "@/lib/clinical/vaccine-catalog";

export type PlanSpecies = "dog" | "cat" | "other";

export type FirstYearCategory =
  | "vaccine" // maps to a real vaccine family; eligible for reminders
  | "preventative" // heartworm / parasite prevention
  | "procedure" // spay / neuter discussion
  | "wellness"; // vet visits, lifestyle-dependent vaccines

export type FirstYearItem = {
  /** Stable slug, unique within a plan. Used to key reminders idempotently. */
  key: string;
  title: string;
  category: FirstYearCategory;
  /** Set only when category === "vaccine"; null otherwise. */
  vaccineFamily: VaccineFamily | null;
  /** Target age in weeks the milestone is anchored to. */
  targetWeeks: number;
  /** Human age window, e.g. "6–8 weeks". */
  window: string;
  /** Computed calendar date (yyyy-mm-dd) = birthDate + targetWeeks. */
  dueOn: string;
  /** Plain-English explanation. Framed as guidance, never as a directive. */
  detail: string;
  /** dueOn is strictly before asOf (calendar day). */
  isPast: boolean;
  /** Rabies and anything else where jurisdiction/law controls timing. */
  legallySensitive: boolean;
  /**
   * True when this item can be turned into a scheduled reminder: it is a real
   * vaccine milestone AND it is still in the future. Non-vaccine items and
   * past milestones are guidance-only (the reminders pipeline frames every row
   * as a "vaccine coming due", so scheduling a non-vaccine or past item would
   * send a misleading email).
   */
  remindable: boolean;
};

export type FirstYearPlan = {
  species: "dog" | "cat";
  birthDate: string; // yyyy-mm-dd
  asOf: string; // yyyy-mm-dd
  /** Age at asOf, in whole weeks (floored, never negative). */
  ageWeeks: number;
  items: FirstYearItem[];
  /**
   * True when the animal is past the primary puppy/kitten series window
   * (>= 20 weeks at asOf), so the plan is mostly annual-booster upkeep rather
   * than a full first-year series. Callers use this to decide whether the
   * first-year card is the right value moment.
   */
  isMinimal: boolean;
};

/** Age (in weeks) at which the primary series is considered complete. */
export const SERIES_COMPLETE_WEEKS = 20;

type ItemSeed = Omit<FirstYearItem, "dueOn" | "isPast" | "remindable">;

function isoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// ── Species schedules ────────────────────────────────────────────────
// Anchored to the EARLY edge of each accepted window (the target week), which
// is how vets book the first eligible visit. Windows are shown to the user so
// they understand there is flexibility.

function dogSeeds(): ItemSeed[] {
  return [
    {
      key: "dhpp_1",
      title: "DHPP: first dose",
      category: "vaccine",
      vaccineFamily: "dhpp",
      targetWeeks: 6,
      window: "6–8 weeks",
      detail:
        "First dose of the core distemper/parvo series (DHPP/DAPP). The series matters more than any single shot. Parvo is the reason puppies start this early.",
      legallySensitive: false,
    },
    {
      key: "dhpp_2",
      title: "DHPP: second dose",
      category: "vaccine",
      vaccineFamily: "dhpp",
      targetWeeks: 10,
      window: "10–12 weeks",
      detail:
        "Second dose in the core series, given roughly 3–4 weeks after the first.",
      legallySensitive: false,
    },
    {
      key: "dhpp_3",
      title: "DHPP: final puppy dose",
      category: "vaccine",
      vaccineFamily: "dhpp",
      targetWeeks: 14,
      window: "14–16 weeks",
      detail:
        "Final puppy dose. AAHA wants the last dose at 16 weeks or older so maternal antibodies no longer blunt it.",
      legallySensitive: false,
    },
    {
      key: "heartworm_start",
      title: "Start heartworm prevention",
      category: "preventative",
      vaccineFamily: null,
      targetWeeks: 8,
      window: "by ~8 weeks",
      detail:
        "Most monthly heartworm preventatives can start around 8 weeks. Year-round prevention is far cheaper and safer than treating an infection.",
      legallySensitive: false,
    },
    {
      key: "lepto_lifestyle",
      title: "Discuss leptospirosis (lifestyle)",
      category: "wellness",
      vaccineFamily: "leptospirosis",
      targetWeeks: 12,
      window: "from ~12 weeks",
      detail:
        "A lifestyle vaccine, not core. Worth it for dogs with water, wildlife, or rural exposure. Given as a 2-dose series 3–4 weeks apart. Ask your vet about local risk.",
      legallySensitive: false,
    },
    {
      key: "bordetella_lifestyle",
      title: "Discuss bordetella / kennel cough (lifestyle)",
      category: "wellness",
      vaccineFamily: "bordetella",
      targetWeeks: 12,
      window: "from ~12 weeks",
      detail:
        "A lifestyle vaccine. Often required by boarding, daycare, grooming, and training classes, worth timing before you need it.",
      legallySensitive: false,
    },
    {
      key: "rabies_1",
      title: "Rabies: first dose",
      category: "vaccine",
      vaccineFamily: "rabies",
      targetWeeks: 16,
      window: "around 16 weeks",
      detail:
        "Typically given at 16 weeks in the US. Timing and interval are set by STATE LAW, not by us. Confirm the local requirement with your vet.",
      legallySensitive: true,
    },
    {
      key: "spay_neuter_discussion",
      title: "Spay / neuter discussion window",
      category: "procedure",
      vaccineFamily: null,
      targetWeeks: 26,
      window: "around 6 months",
      detail:
        "The right age depends on breed and adult size, larger breeds are often done later. This is a conversation to have with your vet, not a fixed date.",
      legallySensitive: false,
    },
    {
      key: "dhpp_booster_1yr",
      title: "DHPP: 1-year booster",
      category: "vaccine",
      vaccineFamily: "dhpp",
      targetWeeks: 52,
      window: "around 1 year",
      detail:
        "The booster one year after the puppy series. After this, core DHPP is typically every 3 years per AAHA.",
      legallySensitive: false,
    },
    {
      key: "rabies_booster_1yr",
      title: "Rabies: 1-year booster",
      category: "vaccine",
      vaccineFamily: "rabies",
      targetWeeks: 52,
      window: "around 1 year",
      detail:
        "The first rabies booster is always due one year after the first dose. Subsequent boosters may be 3-year depending on product and state law.",
      legallySensitive: true,
    },
  ];
}

function catSeeds(): ItemSeed[] {
  return [
    {
      key: "fvrcp_1",
      title: "FVRCP: first dose",
      category: "vaccine",
      vaccineFamily: "fvrcp",
      targetWeeks: 6,
      window: "6–8 weeks",
      detail:
        "First dose of the core feline series (rhinotracheitis, calicivirus, panleukopenia). Panleukopenia is the reason kittens start this early.",
      legallySensitive: false,
    },
    {
      key: "fvrcp_2",
      title: "FVRCP: second dose",
      category: "vaccine",
      vaccineFamily: "fvrcp",
      targetWeeks: 10,
      window: "10–12 weeks",
      detail:
        "Second dose in the core series, roughly 3–4 weeks after the first.",
      legallySensitive: false,
    },
    {
      key: "fvrcp_3",
      title: "FVRCP: final kitten dose",
      category: "vaccine",
      vaccineFamily: "fvrcp",
      targetWeeks: 14,
      window: "14–16 weeks",
      detail:
        "Final kitten dose, given at 16 weeks or older so it takes fully.",
      legallySensitive: false,
    },
    {
      key: "felv_1",
      title: "FeLV: first dose (kittens)",
      category: "vaccine",
      vaccineFamily: "felv",
      targetWeeks: 8,
      window: "8–9 weeks",
      detail:
        "Feline leukemia vaccine is recommended for all kittens, their exposure risk over a lifetime isn't known yet. Given as a 2-dose series.",
      legallySensitive: false,
    },
    {
      key: "felv_2",
      title: "FeLV: second dose (kittens)",
      category: "vaccine",
      vaccineFamily: "felv",
      targetWeeks: 12,
      window: "3–4 weeks after first",
      detail:
        "Second FeLV dose completes the kitten series, roughly 3–4 weeks after the first.",
      legallySensitive: false,
    },
    {
      key: "rabies_1",
      title: "Rabies: first dose",
      category: "vaccine",
      vaccineFamily: "rabies",
      targetWeeks: 16,
      window: "around 16 weeks",
      detail:
        "Typically given at 16 weeks in the US. Timing is set by STATE LAW, not by us. Confirm the local requirement with your vet.",
      legallySensitive: true,
    },
    {
      key: "spay_neuter_discussion",
      title: "Spay / neuter discussion window",
      category: "procedure",
      vaccineFamily: null,
      targetWeeks: 20,
      window: "around 5 months",
      detail:
        "Many cats are spayed or neutered around 5 months, before the first heat. Confirm timing with your vet.",
      legallySensitive: false,
    },
    {
      key: "fvrcp_booster_1yr",
      title: "FVRCP: 1-year booster",
      category: "vaccine",
      vaccineFamily: "fvrcp",
      targetWeeks: 52,
      window: "around 1 year",
      detail:
        "The booster one year after the kitten series. After this, core FVRCP is typically every 3 years.",
      legallySensitive: false,
    },
    {
      key: "rabies_booster_1yr",
      title: "Rabies: 1-year booster",
      category: "vaccine",
      vaccineFamily: "rabies",
      targetWeeks: 52,
      window: "around 1 year",
      detail:
        "The first rabies booster is always due one year after the first dose. Subsequent boosters may be longer depending on product and state law.",
      legallySensitive: true,
    },
  ];
}

/**
 * Build the first-year plan for a puppy or kitten. Returns null when we have no
 * species-correct schedule to offer (species "other", or an unparseable /
 * future birth date), so callers can cleanly fall back rather than render a
 * misleading plan.
 */
export function buildFirstYearPlan(input: {
  species: PlanSpecies;
  birthDate: string;
  asOf?: Date;
}): FirstYearPlan | null {
  if (input.species !== "dog" && input.species !== "cat") return null;

  const birth = parseISO(input.birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const asOf = input.asOf ?? new Date();
  // A birth date in the future is almost certainly a typo, no plan.
  if (differenceInCalendarDays(asOf, birth) < 0) return null;

  const asOfDay = isoDay(asOf);
  const ageDays = differenceInCalendarDays(asOf, birth);
  const ageWeeks = Math.max(0, Math.floor(ageDays / 7));

  const seeds = input.species === "dog" ? dogSeeds() : catSeeds();

  const items: FirstYearItem[] = seeds.map((seed) => {
    const due = addDays(birth, seed.targetWeeks * 7);
    const dueOn = isoDay(due);
    const isPast = differenceInCalendarDays(due, asOf) < 0;
    const remindable = seed.category === "vaccine" && !isPast;
    return { ...seed, dueOn, isPast, remindable };
  });

  return {
    species: input.species,
    birthDate: isoDay(birth),
    asOf: asOfDay,
    ageWeeks,
    items,
    isMinimal: ageWeeks >= SERIES_COMPLETE_WEEKS,
  };
}

/** The subset of items that can be turned into scheduled reminders. */
export function remindableItems(plan: FirstYearPlan): FirstYearItem[] {
  return plan.items.filter((i) => i.remindable);
}
