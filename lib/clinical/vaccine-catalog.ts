/**
 * Vaccine duration catalog — the single source of truth for "when does this
 * vaccine expire" math.
 *
 * Sources: AAHA Canine Vaccination Guidelines (2022), AAFP Feline Vaccination
 * Guidelines (2020), CDC rabies model, individual product labels for
 * commonly-used vaccines. Conservative defaults: when AAHA permits both 1y
 * and 3y dosing for a product (e.g. Rabies adult booster), the catalog
 * defaults to the LONGER duration and offers the shorter as an alternate.
 *
 * The "first-dose-is-always-1y" rule applies to most multi-year vaccines
 * (Rabies, DHPP, FVRCP). When `is_first_dose` is true OR the pet is young
 * enough that this could be the first adult dose, helpers should fall back
 * to 12 months regardless of the family default.
 *
 * Pawdex never makes the legal call on rabies — state law controls. The
 * catalog defaults represent product-label maximums; the UI flags rabies
 * specifically and reminds the user to verify against their jurisdiction.
 */

import { addMonths, differenceInMonths, parseISO } from "date-fns";

export type VaccineFamily =
  | "rabies"
  | "dhpp"
  | "leptospirosis"
  | "bordetella"
  | "civ"
  | "lyme"
  | "rattlesnake"
  | "fvrcp"
  | "felv"
  | "fiv";

export type VaccineCatalogEntry = {
  family: VaccineFamily;
  label: string;
  species: "dog" | "cat" | "both";
  /** Default expected duration when no other signal is available. */
  default_duration_months: number;
  /** Other durations occasionally seen in product labels or local mandates. */
  alt_durations_months: number[];
  /** When true, a first/initial dose is always 12 months regardless of default. */
  first_dose_is_one_year: boolean;
  /** Plain-English explanation surfaced in the review UI when we infer expiry. */
  notes: string;
  /**
   * Legal/regulatory caveat — when true, the UI flags this vaccine for
   * explicit user verification (rabies state law, etc.).
   */
  legally_sensitive: boolean;
};

export const VACCINE_CATALOG: Record<VaccineFamily, VaccineCatalogEntry> = {
  rabies: {
    family: "rabies",
    label: "Rabies",
    species: "both",
    default_duration_months: 36,
    alt_durations_months: [12],
    first_dose_is_one_year: true,
    notes:
      "First rabies dose is always 1-year. Subsequent doses can be 3-year per AAHA when product label permits. State law controls — verify against your jurisdiction.",
    legally_sensitive: true,
  },
  dhpp: {
    family: "dhpp",
    label: "DHPP / DA2PP / DAPP / DHLPP",
    species: "dog",
    default_duration_months: 36,
    alt_durations_months: [12],
    first_dose_is_one_year: true,
    notes:
      "Puppy series (q2-4 weeks through 16 weeks) → 1-year booster → 3-year boosters per AAHA. Some clinics still vaccinate annually.",
    legally_sensitive: false,
  },
  leptospirosis: {
    family: "leptospirosis",
    label: "Leptospirosis",
    species: "dog",
    default_duration_months: 12,
    alt_durations_months: [],
    first_dose_is_one_year: false,
    notes:
      "Annual. Initial series is 2 doses 2-4 weeks apart starting at 12 weeks of age. Often bundled into DHLPP combo.",
    legally_sensitive: false,
  },
  bordetella: {
    family: "bordetella",
    label: "Bordetella",
    species: "dog",
    default_duration_months: 12,
    alt_durations_months: [6],
    first_dose_is_one_year: false,
    notes:
      "Annual for low-exposure pets, every 6 months for dogs in boarding/daycare/grooming. Boarding facilities often require ≤ 6 months since last dose.",
    legally_sensitive: false,
  },
  civ: {
    family: "civ",
    label: "Canine Influenza (CIV)",
    species: "dog",
    default_duration_months: 12,
    alt_durations_months: [],
    first_dose_is_one_year: false,
    notes:
      "Annual. Initial 2-dose series 2-4 weeks apart. Bivalent (H3N2 + H3N8) is the current standard.",
    legally_sensitive: false,
  },
  lyme: {
    family: "lyme",
    label: "Lyme",
    species: "dog",
    default_duration_months: 12,
    alt_durations_months: [],
    first_dose_is_one_year: false,
    notes:
      "Annual. Initial 2-dose series 2-4 weeks apart. Recommended in Lyme-endemic regions (NE, upper Midwest, mid-Atlantic).",
    legally_sensitive: false,
  },
  rattlesnake: {
    family: "rattlesnake",
    label: "Rattlesnake (Crotalus)",
    species: "dog",
    default_duration_months: 6,
    alt_durations_months: [],
    first_dose_is_one_year: false,
    notes:
      "Every 6 months during snake-active season. Primarily SW US (CA, AZ, NM, TX). Initial 2-dose series 30 days apart.",
    legally_sensitive: false,
  },
  fvrcp: {
    family: "fvrcp",
    label: "FVRCP / FRCP",
    species: "cat",
    default_duration_months: 36,
    alt_durations_months: [12],
    first_dose_is_one_year: true,
    notes:
      "Kitten series → 1-year booster → 3-year for indoor-only cats per AAFP, annual for outdoor or boarded cats.",
    legally_sensitive: false,
  },
  felv: {
    family: "felv",
    label: "FeLV",
    species: "cat",
    default_duration_months: 12,
    alt_durations_months: [24, 36],
    first_dose_is_one_year: false,
    notes:
      "Annual for outdoor cats or households with FeLV+ cats. Every 2-3 years acceptable for low-risk indoor-only adult cats.",
    legally_sensitive: false,
  },
  fiv: {
    family: "fiv",
    label: "FIV",
    species: "cat",
    default_duration_months: 12,
    alt_durations_months: [],
    first_dose_is_one_year: false,
    notes:
      "Rarely given in US — the vaccine causes positive FIV antibody tests, complicating future diagnosis. Initial series + annual booster when used.",
    legally_sensitive: false,
  },
};

/**
 * Best-effort family inference from a free-text vaccine_type string. The
 * extraction prompt v6 is supposed to fill `vaccine_family` directly, but
 * older extractions + manually-entered rows might only have the type text.
 */
export function inferFamilyFromType(
  vaccineType: string | null | undefined,
): VaccineFamily | null {
  if (!vaccineType) return null;
  const t = vaccineType.toLowerCase();

  // Order matters — check more-specific terms before more-general ones.
  if (/\brabies\b/.test(t)) return "rabies";
  if (/dhlpp|dhpp|da2pp|dapp|dappv|distemper/.test(t)) return "dhpp";
  if (/\blepto/.test(t)) return "leptospirosis";
  if (/bordetella|kennel.?cough/.test(t)) return "bordetella";
  if (/\bciv\b|canine.?(flu|influenza)|bivalent.?flu|fluvac/.test(t)) return "civ";
  if (/\blyme\b/.test(t)) return "lyme";
  if (/rattlesnake|crotalus/.test(t)) return "rattlesnake";
  if (/fvrcp|frcp/.test(t)) return "fvrcp";
  if (/felv|feline.?leukemia/.test(t)) return "felv";
  if (/\bfiv\b/.test(t)) return "fiv";
  return null;
}

export type ComputedExpiry = {
  expires_on: string; // ISO YYYY-MM-DD
  duration_months: number;
  is_first_dose: boolean;
  source: "catalog_default" | "catalog_first_dose";
  rationale: string;
  legally_sensitive: boolean;
};

/**
 * Given administered date + family (+ optional pet birthday for first-dose
 * detection), compute the expected expiration date. Returns null when the
 * family is unknown or the administered date is unparseable.
 *
 * `firstDoseHint` lets the caller override the heuristic — useful when the
 * document explicitly says "puppy series, initial dose" vs "annual booster".
 */
export function computeExpiryFromFamily(input: {
  family: VaccineFamily | string | null | undefined;
  administered_on: string;
  pet_date_of_birth?: string | null;
  /** Force first-dose handling regardless of pet age. */
  firstDoseHint?: boolean;
}): ComputedExpiry | null {
  if (!input.family) return null;
  const entry = VACCINE_CATALOG[input.family as VaccineFamily];
  if (!entry) return null;

  const administered = parseISO(input.administered_on);
  if (Number.isNaN(administered.getTime())) return null;

  // First-dose detection — explicit hint wins; otherwise infer from pet age
  // at administration. A dog under 18 months getting Rabies is highly likely
  // on their first adult dose, so the 1-year rule applies.
  let isFirstDose = input.firstDoseHint === true;
  if (
    !isFirstDose &&
    entry.first_dose_is_one_year &&
    input.pet_date_of_birth
  ) {
    const dob = parseISO(input.pet_date_of_birth);
    if (!Number.isNaN(dob.getTime())) {
      const ageMonths = differenceInMonths(administered, dob);
      // Heuristic: rabies in the first 18 months of life is treated as the
      // initial dose. After 18mo + we assume the user is on the adult booster
      // cadence. Caller can override via firstDoseHint when the document is
      // explicit.
      if (ageMonths <= 18) isFirstDose = true;
    }
  }

  const durationMonths = isFirstDose
    ? Math.min(entry.default_duration_months, 12)
    : entry.default_duration_months;

  const expires = addMonths(administered, durationMonths);

  return {
    expires_on: expires.toISOString().slice(0, 10),
    duration_months: durationMonths,
    is_first_dose: isFirstDose,
    source: isFirstDose ? "catalog_first_dose" : "catalog_default",
    rationale: isFirstDose
      ? `First-dose default — ${entry.label} initial dose is always 1 year. ${entry.notes}`
      : `Catalog default — ${entry.label} typically lasts ${entry.default_duration_months} months. ${entry.notes}`,
    legally_sensitive: entry.legally_sensitive,
  };
}

/**
 * Lookup helper for the UI — given a family identifier, return the catalog
 * entry. Returns null for unknown families so callers can degrade gracefully.
 */
export function getCatalogEntry(
  family: VaccineFamily | string | null | undefined,
): VaccineCatalogEntry | null {
  if (!family) return null;
  return VACCINE_CATALOG[family as VaccineFamily] ?? null;
}

/**
 * All catalog entries as an array. Used by reference docs / a future
 * "vaccine durations" help page.
 */
export const VACCINE_CATALOG_LIST: VaccineCatalogEntry[] = Object.values(VACCINE_CATALOG);
