/**
 * Behavioral tests for the pricing fit finder.
 *
 * Run:  pnpm dlx tsx scripts/test-plan-recommend.ts
 *
 * The fit finder is the only thing on the marketing site that tells a visitor
 * which tier to buy. A wrong threshold here does not throw and does not fail a
 * build: it quietly recommends the wrong plan to every visitor, forever. So the
 * boundaries are pinned down explicitly, including the inclusive/exclusive edge
 * on Free's document meter, which is the one an off-by-one would hide in.
 *
 * No DB, no env, no network. Plain check(cond, msg) + counters, nonzero exit on
 * failure, exactly like scripts/test-billing-entitlements.ts.
 */

import { PLANS } from "../lib/billing/plans";
import { FIT_LIMITS, recommendPlan } from "../lib/billing/recommend";

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

// ── Litters is a capability, not a quantity ─────────────────────────
{
  // Nothing between Household and Breeder is a number. If the toggle did not
  // exist, no slider position could ever reach Breeder and the third card would
  // sit there unreachable, which reads as a broken control.
  check(
    recommendPlan({ pets: 1, docsPerMonth: 2, placesLitters: true }).planId ===
      "breeder",
    "litters alone reaches Breeder regardless of pet count",
  );
  check(
    recommendPlan({
      pets: FIT_LIMITS.maxPets,
      docsPerMonth: FIT_LIMITS.maxDocs,
      placesLitters: true,
    }).planId === "breeder",
    "max sliders plus litters is Breeder",
  );
  check(
    recommendPlan({ pets: 1, docsPerMonth: 0, placesLitters: true })
      .outgrewFree === false,
    "a breeder with one pet and no documents has not outgrown Free on quantity",
  );
}

// ── Free's only real meter is AI extraction ─────────────────────────
{
  const docCap = PLANS.free.limits.aiExtractionsPerMonth as number;
  check(docCap === 10, "this test assumes Free meters 10 extractions a month");

  check(
    recommendPlan({ pets: 1, docsPerMonth: docCap, placesLitters: false })
      .planId === "free",
    "exactly the cap still fits Free: the limit is inclusive",
  );
  check(
    recommendPlan({ pets: 1, docsPerMonth: docCap + 1, placesLitters: false })
      .planId === "household",
    "one over the cap exceeds Free",
  );
  check(
    recommendPlan({ pets: 1, docsPerMonth: docCap + 1, placesLitters: false })
      .outgrewFree === true,
    "outgrewFree flags the moment the Free card should step back",
  );
  check(
    recommendPlan({ pets: 1, docsPerMonth: 0, placesLitters: false })
      .outgrewFree === false,
    "a household inside every limit has not outgrown Free",
  );
}

// ── Free caps pets ──────────────────────────────────────────────────
{
  const petCap = PLANS.free.limits.pets as number;
  check(petCap === 2, "this test assumes Free covers 2 pets");

  check(
    recommendPlan({ pets: petCap, docsPerMonth: 0, placesLitters: false })
      .planId === "free",
    "exactly the pet cap fits Free",
  );
  check(
    recommendPlan({ pets: petCap + 1, docsPerMonth: 0, placesLitters: false })
      .planId === "household",
    "one pet over the cap exceeds Free",
  );
}

// ── Thresholds track plans.ts, they are not hardcoded ───────────────
{
  // If someone changes a limit in plans.ts, the fit finder has to move with it.
  // Reading the caps back out of PLANS is the only way this stays true.
  const petCap = PLANS.free.limits.pets as number;
  const docCap = PLANS.free.limits.aiExtractionsPerMonth as number;
  const r = recommendPlan({
    pets: petCap + 1,
    docsPerMonth: 0,
    placesLitters: false,
  });
  check(
    r.reason.includes(String(petCap)),
    "the reason quotes the real pet cap from plans.ts",
  );
  const r2 = recommendPlan({
    pets: 1,
    docsPerMonth: docCap + 1,
    placesLitters: false,
  });
  check(
    r2.reason.includes(String(docCap)),
    "the reason quotes the real document cap from plans.ts",
  );
}

// ── Every result is presentable ─────────────────────────────────────
{
  const cases = [
    { pets: 1, docsPerMonth: 0, placesLitters: false },
    { pets: 6, docsPerMonth: 20, placesLitters: false },
    { pets: 6, docsPerMonth: 20, placesLitters: true },
    { pets: 3, docsPerMonth: 0, placesLitters: false },
    { pets: 1, docsPerMonth: 40, placesLitters: false },
  ];
  for (const c of cases) {
    const r = recommendPlan(c);
    check(r.reason.length > 0, `every recommendation carries a reason: ${JSON.stringify(c)}`);
    // Project-wide writing rule: no em-dashes in any user-facing copy.
    check(
      !r.reason.includes("—"),
      `no em-dashes in user-facing copy: ${JSON.stringify(c)}`,
    );
    check(
      r.planId in PLANS,
      `recommends a real plan id: ${JSON.stringify(c)} -> ${r.planId}`,
    );
    check(
      r.planId !== "early_access",
      `never recommends the beta state as a plan: ${JSON.stringify(c)}`,
    );
  }
}

// ── report ──────────────────────────────────────────────────────────
console.log(`\nplan fit finder: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
