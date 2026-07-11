/**
 * Pawdex entitlements, pure functions that turn a household's plan into a set
 * of limits and a handful of yes/no capability checks. No DB, no env, no
 * server-only import: this is the shared brain that both the UI and (later)
 * any enforcement point call.
 *
 * Hard rule from docs/pricing-strategy.md: entitlements govern *capacity and
 * convenience*, never *retention*. Nothing here can delete, hide, or lock a
 * record. The strongest thing an entitlement says is "you cannot add a 3rd
 * pet on Free", the two you have stay fully visible and exportable.
 */

import {
  PLANS,
  type Limit,
  type PlanId,
  type PlanLimits,
} from "./plans";

// The minimal household shape entitlements need. Deliberately structural (not
// the generated Row type) so callers can pass a full DB row or a test fixture.
export type HouseholdForEntitlements = {
  plan: PlanId;
};

/** The limits in force for a household, derived purely from its plan. */
export function planFor(household: HouseholdForEntitlements): PlanLimits {
  return PLANS[household.plan].limits;
}

function isUnlimited(limit: Limit): limit is "unlimited" {
  return limit === "unlimited";
}

/**
 * Whether a household may add another pet given how many it already has.
 * Unlimited plans always allow it. This is the one capacity check the free
 * tier actually enforces, and only on *adding*, never on existing pets.
 */
export function canAddPet(
  household: HouseholdForEntitlements,
  currentPetCount: number,
): boolean {
  const limit = planFor(household).pets;
  if (isUnlimited(limit)) return true;
  return currentPetCount < limit;
}

/** Remaining pet slots, or "unlimited". Never negative. */
export function remainingPetSlots(
  household: HouseholdForEntitlements,
  currentPetCount: number,
): Limit {
  const limit = planFor(household).pets;
  if (isUnlimited(limit)) return "unlimited";
  return Math.max(0, limit - currentPetCount);
}

/**
 * Whether a household may run another document AI extraction this month, given
 * how many it has already used. Unlimited plans always allow it.
 */
export function canRunAiExtraction(
  household: HouseholdForEntitlements,
  usedThisMonth: number,
): boolean {
  const limit = planFor(household).aiExtractionsPerMonth;
  if (isUnlimited(limit)) return true;
  return usedThisMonth < limit;
}

/** Remaining AI extractions this month, or "unlimited". Never negative. */
export function remainingAiExtractions(
  household: HouseholdForEntitlements,
  usedThisMonth: number,
): Limit {
  const limit = planFor(household).aiExtractionsPerMonth;
  if (isUnlimited(limit)) return "unlimited";
  return Math.max(0, limit - usedThisMonth);
}

/** Feature-gate helpers. Each reads straight off the plan limits. */
export function hasInsuranceTools(h: HouseholdForEntitlements): boolean {
  return planFor(h).insuranceTools;
}
export function hasTravelPackets(h: HouseholdForEntitlements): boolean {
  return planFor(h).travelPackets;
}
export function hasBreederTools(h: HouseholdForEntitlements): boolean {
  return planFor(h).breederTools;
}

/**
 * Whether a breeder household is over its soft active-animal cap. This is
 * advisory ONLY, the caller surfaces a "let's talk" prompt, never a lock.
 * Returns false for any plan without a soft cap.
 */
export function isOverSoftAnimalCap(
  household: HouseholdForEntitlements,
  activeAnimalCount: number,
): boolean {
  const cap = planFor(household).softActiveAnimalCap;
  if (cap == null) return false;
  return activeAnimalCount > cap;
}

/**
 * Enforcement kill-switch stub, documented for a later pass. During early
 * access, and until the founder decides otherwise, NOTHING is enforced. Every
 * capacity check above is called only to *inform* the UI (show remaining
 * slots, nudge upgrades); no code path should block a user on the result yet.
 *
 * When enforcement turns on, this becomes the single gate every call site
 * consults, so soft-launch enforcement is one flag flip, not a hunt through the
 * codebase. The full enforcement map (which feature, which surface, what the
 * user sees) lives in docs/billing.md.
 */
export function canEnforce(): boolean {
  return false;
}
