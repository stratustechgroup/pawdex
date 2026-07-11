/**
 * Behavioral tests for the pure billing plans + entitlements.
 *
 * Run:  pnpm dlx tsx scripts/test-billing-entitlements.ts
 *
 * These functions decide what a household can and cannot do based on its plan.
 * A wrong limit or an off-by-one on a cap type-checks fine and silently either
 * blocks a paying customer or lets a free household exceed the tier, both
 * corrode trust and revenue. The rules are proven here against fixtures.
 *
 * No DB, no env, no network. Plain check(cond, msg) + counters, nonzero exit
 * on failure, exactly like scripts/test-first-year.ts.
 */

import {
  PLANS,
  PURCHASABLE_PLAN_IDS,
  PURCHASABLE_PLANS,
  annualMonthlyEquivalentCents,
  formatUsd,
  isPaidPlan,
  planById,
  type PlanId,
} from "../lib/billing/plans";
import {
  canAddPet,
  canEnforce,
  canRunAiExtraction,
  hasBreederTools,
  hasInsuranceTools,
  isOverSoftAnimalCap,
  planFor,
  remainingAiExtractions,
  remainingPetSlots,
} from "../lib/billing/entitlements";

// ── tiny harness ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

const h = (plan: PlanId) => ({ plan });

// ── Plans: shape + pricing invariants ───────────────────────────────
{
  // Every PlanId in the record round-trips through planById with a matching id.
  for (const id of Object.keys(PLANS) as PlanId[]) {
    check(planById(id).id === id, `planById(${id}).id === ${id}`);
  }

  // The pricing page shows exactly free / household / breeder, in that order,
  // and never early_access (that is a state, not a card).
  check(
    PURCHASABLE_PLAN_IDS.join(",") === "free,household,breeder",
    "purchasable plans are free,household,breeder in order",
  );
  check(
    !PURCHASABLE_PLAN_IDS.includes("early_access"),
    "early_access is not a purchasable card",
  );
  check(PURCHASABLE_PLANS.length === 3, "three purchasable plans");

  // Only household + breeder are paid.
  check(isPaidPlan("household") && isPaidPlan("breeder"), "household+breeder are paid");
  check(
    !isPaidPlan("free") && !isPaidPlan("early_access"),
    "free+early_access are not paid",
  );

  // Free is truly free; paid tiers cost something; annual beats 12x monthly.
  check(PLANS.free.priceMonthlyCents === 0, "free is $0/mo");
  check(PLANS.free.priceAnnualCents === null, "free has no annual price");
  check(PLANS.household.priceMonthlyCents === 600, "household is $6/mo");
  check(PLANS.breeder.priceMonthlyCents === 2900, "breeder is $29/mo");
  for (const id of ["household", "breeder"] as const) {
    const p = PLANS[id];
    check(
      p.priceAnnualCents !== null && p.priceAnnualCents < p.priceMonthlyCents * 12,
      `${id} annual is a discount vs 12x monthly`,
    );
  }

  // Formatting + annual-equivalent math.
  check(formatUsd(600) === "$6", "formatUsd(600) === $6");
  check(formatUsd(2900) === "$29", "formatUsd(2900) === $29");
  check(formatUsd(650) === "$6.50", "formatUsd(650) === $6.50");
  check(
    annualMonthlyEquivalentCents(PLANS.household) === 500,
    "household annual ≈ $5/mo",
  );
  check(
    annualMonthlyEquivalentCents(PLANS.free) === null,
    "free has no annual-equivalent",
  );
}

// ── Entitlements: the free-tier pet cap is the one real capacity gate ──
{
  const free = h("free");
  check(planFor(free).pets === 2, "free pet limit is 2");
  check(canAddPet(free, 0), "free: can add 1st pet");
  check(canAddPet(free, 1), "free: can add 2nd pet");
  check(!canAddPet(free, 2), "free: cannot add 3rd pet");
  check(remainingPetSlots(free, 0) === 2, "free: 2 slots at 0 pets");
  check(remainingPetSlots(free, 2) === 0, "free: 0 slots at cap");
  check(remainingPetSlots(free, 5) === 0, "free: slots never negative");
}

// ── Entitlements: unlimited plans never block ───────────────────────
{
  for (const id of ["household", "breeder", "early_access"] as const) {
    const hh = h(id);
    check(planFor(hh).pets === "unlimited", `${id}: unlimited pets`);
    check(canAddPet(hh, 999), `${id}: can add pet at 999`);
    check(remainingPetSlots(hh, 999) === "unlimited", `${id}: slots unlimited`);
    check(canRunAiExtraction(hh, 10_000), `${id}: AI never capped`);
    check(
      remainingAiExtractions(hh, 10_000) === "unlimited",
      `${id}: AI remaining unlimited`,
    );
  }
}

// ── Entitlements: free-tier AI allowance ────────────────────────────
{
  const free = h("free");
  check(planFor(free).aiExtractionsPerMonth === 10, "free: 10 AI/mo");
  check(canRunAiExtraction(free, 9), "free: 10th extraction allowed");
  check(!canRunAiExtraction(free, 10), "free: 11th extraction blocked");
  check(remainingAiExtractions(free, 3) === 7, "free: 7 left after 3");
  check(remainingAiExtractions(free, 20) === 0, "free: remaining never negative");
}

// ── Entitlements: feature gates track the plan ──────────────────────
{
  check(!hasInsuranceTools(h("free")), "free: no insurance tools");
  check(hasInsuranceTools(h("household")), "household: insurance tools");
  check(!hasBreederTools(h("household")), "household: no breeder tools");
  check(hasBreederTools(h("breeder")), "breeder: breeder tools");
  check(hasBreederTools(h("early_access")), "early_access: everything, incl breeder");
}

// ── Entitlements: breeder soft cap is advisory and only on breeder ──
{
  const breeder = h("breeder");
  check(planFor(breeder).softActiveAnimalCap === 50, "breeder soft cap 50");
  check(!isOverSoftAnimalCap(breeder, 50), "breeder: 50 animals is at cap, not over");
  check(isOverSoftAnimalCap(breeder, 51), "breeder: 51 animals is over cap");
  // No other plan has a soft cap, so the check is always false for them.
  check(!isOverSoftAnimalCap(h("household"), 10_000), "household: no soft cap");
  check(!isOverSoftAnimalCap(h("early_access"), 10_000), "early_access: no soft cap");
}

// ── Enforcement is OFF this pass, the stub must say so ──────────────
{
  check(canEnforce() === false, "canEnforce() is false during early access");
}

// ── report ──────────────────────────────────────────────────────────
console.log(`\nbilling entitlements: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
