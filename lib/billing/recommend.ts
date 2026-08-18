/**
 * Which tier fits a household, given three inputs. Pure: no DB, no env, no
 * network, importable into a client component exactly like plans.ts.
 *
 * This is a FIT finder, not a price calculator. The tiers are flat rate
 * ($0 / $6 / $29), so nothing here recomputes a price. What moves is the
 * recommendation.
 *
 * Two things worth knowing before changing it:
 *
 * 1. The thresholds are read back out of PLANS rather than written down here.
 *    Change a limit in plans.ts and the fit finder moves with it. Hardcoding
 *    2 and 10 would silently desync the marketing page from the entitlements
 *    the moment anyone touched a plan.
 *
 * 2. Litters is a boolean, not a quantity, because nothing between Household
 *    and Breeder is a number. Without that input no slider position could ever
 *    reach Breeder.
 *
 * Rationale for the numbers themselves lives in docs/pricing-strategy.md.
 */

import { PLANS, type PlanId } from "./plans";

export type FitInput = {
  pets: number;
  docsPerMonth: number;
  placesLitters: boolean;
};

export type FitResult = {
  planId: PlanId;
  /** One sentence a visitor can read, explaining why this tier and not Free. */
  reason: string;
  /**
   * True once the household is past a Free limit on quantity alone. Drives the
   * Free card visibly stepping back, so a visitor watches themselves outgrow
   * the free tier rather than being told they will.
   */
  outgrewFree: boolean;
};

/** Slider ends. Past these the answer stops changing, so the range stops too. */
export const FIT_LIMITS = { maxPets: 10, maxDocs: 40 } as const;

export function recommendPlan(input: FitInput): FitResult {
  const free = PLANS.free.limits;
  const petCap = typeof free.pets === "number" ? free.pets : Infinity;
  const docCap =
    typeof free.aiExtractionsPerMonth === "number"
      ? free.aiExtractionsPerMonth
      : Infinity;

  // Both caps are inclusive: the plan says "up to 2 pets" and "10 extractions a
  // month", so being exactly at the number still fits.
  const overPets = input.pets > petCap;
  const overDocs = input.docsPerMonth > docCap;
  const outgrewFree = overPets || overDocs;

  if (input.placesLitters) {
    return {
      planId: "breeder",
      reason:
        "Litters, whelping records and placement transfers only exist on Breeder.",
      outgrewFree,
    };
  }

  if (overPets && overDocs) {
    return {
      planId: "household",
      reason: `More than ${petCap} pets, and more than ${docCap} documents a month.`,
      outgrewFree,
    };
  }
  if (overDocs) {
    return {
      planId: "household",
      reason: `Free reads ${docCap} documents a month. You are past that.`,
      outgrewFree,
    };
  }
  if (overPets) {
    return {
      planId: "household",
      reason: `Free covers up to ${petCap} pets. You have more.`,
      outgrewFree,
    };
  }

  return {
    planId: "free",
    reason: "Free covers this, and it stays free.",
    outgrewFree: false,
  };
}
