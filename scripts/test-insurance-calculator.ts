/**
 * Pure-function tests for the true out-of-pocket calculator.
 *
 * Run with: pnpm dlx tsx scripts/test-insurance-calculator.ts
 *
 * computeTrueOop is the deterministic core behind every cost estimate. It has
 * no I/O and no server-only imports, so it is tested here in isolation across
 * the deductible / reimbursement / annual-limit edge cases that have
 * historically produced bugs.
 */

import { computeTrueOop } from "../lib/calculator/true-oop";
import type { TrueOopInputs } from "../lib/calculator/true-oop";

let failed = false;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failed = true;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

function run(label: string, inputs: TrueOopInputs) {
  const b = computeTrueOop(inputs);
  console.log(
    `\n${label}\n  in=${JSON.stringify(inputs)}\n  out=${JSON.stringify(b)}`,
  );
  return b;
}

console.log("=".repeat(72));
console.log("computeTrueOop edge cases (all values in cents)");
console.log("=".repeat(72));

// --- 1. Mid-deductible: part of the gross is eaten by the deductible ---------
{
  const b = run("(1) mid-deductible, 80% reimbursement", {
    gross_cents: 100000, // $1000
    deductible_remaining_cents: 20000, // $200 left to meet
    reimbursement_rate: 0.8,
    annual_max_remaining_cents: null,
  });
  assert(b.applied_deductible_cents === 20000, "deductible fully applied ($200)");
  assert(b.reimbursement_eligible_cents === 80000, "eligible = gross - deductible ($800)");
  assert(b.reimbursement_paid_cents === 64000, "reimbursement = 80% of $800 = $640");
  assert(b.true_oop_cents === 36000, "true oop = $1000 - $640 = $360");
  assert(b.hit_annual_max === false, "no annual max hit when uncapped");
}

// --- 2. Unmet deductible: gross smaller than deductible ----------------------
{
  const b = run("(2) unmet deductible (gross < deductible)", {
    gross_cents: 15000, // $150
    deductible_remaining_cents: 50000, // $500 deductible not yet met
    reimbursement_rate: 0.9,
    annual_max_remaining_cents: null,
  });
  assert(b.applied_deductible_cents === 15000, "deductible capped at gross ($150)");
  assert(b.reimbursement_eligible_cents === 0, "nothing eligible below the deductible");
  assert(b.reimbursement_paid_cents === 0, "no reimbursement below the deductible");
  assert(b.true_oop_cents === 15000, "owner pays the full gross ($150)");
}

// --- 3. Over annual limit: reimbursement capped by remaining annual max -------
{
  const b = run("(3) over annual limit (cap binds)", {
    gross_cents: 500000, // $5000
    deductible_remaining_cents: 0, // met
    reimbursement_rate: 0.9, // would pay $4500
    annual_max_remaining_cents: 100000, // only $1000 of benefit left
  });
  assert(b.reimbursement_paid_cents === 100000, "reimbursement capped at remaining max ($1000)");
  assert(b.hit_annual_max === true, "hit_annual_max flag set when cap binds");
  assert(b.true_oop_cents === 400000, "true oop = $5000 - $1000 = $4000");
}

// --- 4. Zero remaining limit: benefit exhausted ------------------------------
{
  const b = run("(4) zero remaining annual max (benefit exhausted)", {
    gross_cents: 80000,
    deductible_remaining_cents: 0,
    reimbursement_rate: 0.8,
    annual_max_remaining_cents: 0,
  });
  assert(b.reimbursement_paid_cents === 0, "no reimbursement when max is exhausted");
  assert(b.hit_annual_max === true, "hit_annual_max set when cap is zero and would-be reimbursement > 0");
  assert(b.true_oop_cents === 80000, "owner pays everything");
}

// --- 5. Deductible met exactly at the cap boundary (reimbursement == cap) -----
{
  const b = run("(5) reimbursement exactly equals remaining max", {
    gross_cents: 100000,
    deductible_remaining_cents: 0,
    reimbursement_rate: 0.5, // $500 reimbursement
    annual_max_remaining_cents: 50000, // exactly $500 left
  });
  assert(b.reimbursement_paid_cents === 50000, "reimbursement lands at exactly the cap ($500)");
  assert(b.hit_annual_max === false, "reimbursement == cap is NOT flagged as hitting the max");
  assert(b.true_oop_cents === 50000, "true oop = $500");
}

// --- 6. Null reimbursement rate: degrade to no reimbursement -----------------
{
  const b = run("(6) unknown reimbursement rate (null)", {
    gross_cents: 40000,
    deductible_remaining_cents: 0,
    reimbursement_rate: null,
    annual_max_remaining_cents: null,
  });
  assert(b.reimbursement_rate === 0, "null rate degrades to 0");
  assert(b.reimbursement_paid_cents === 0, "no reimbursement without a known rate");
  assert(b.true_oop_cents === 40000, "true oop = gross when rate unknown");
}

// --- 7. Null deductible: assume already met ----------------------------------
{
  const b = run("(7) unknown deductible (null → assume met)", {
    gross_cents: 100000,
    deductible_remaining_cents: null,
    reimbursement_rate: 0.8,
    annual_max_remaining_cents: null,
  });
  assert(b.applied_deductible_cents === 0, "null deductible applies 0 (assume met)");
  assert(b.reimbursement_eligible_cents === 100000, "full gross eligible");
  assert(b.reimbursement_paid_cents === 80000, "reimburses 80% of full gross ($800)");
  assert(b.true_oop_cents === 20000, "true oop = $200");
}

// --- 8. Out-of-range rate is clamped to [0,1] --------------------------------
{
  const over = computeTrueOop({
    gross_cents: 10000,
    deductible_remaining_cents: 0,
    reimbursement_rate: 1.5,
    annual_max_remaining_cents: null,
  });
  const under = computeTrueOop({
    gross_cents: 10000,
    deductible_remaining_cents: 0,
    reimbursement_rate: -0.5,
    annual_max_remaining_cents: null,
  });
  console.log(`\n(8) rate clamping\n  over(1.5)=${over.reimbursement_rate} under(-0.5)=${under.reimbursement_rate}`);
  assert(over.reimbursement_rate === 1, "rate > 1 clamps to 1");
  assert(over.reimbursement_paid_cents === 10000, "clamped-to-1 reimburses the full eligible");
  assert(under.reimbursement_rate === 0, "rate < 0 clamps to 0");
}

// --- 9. Non-finite / garbage inputs degrade safely ---------------------------
{
  const b = computeTrueOop({
    gross_cents: Number.NaN,
    deductible_remaining_cents: null,
    reimbursement_rate: Number.POSITIVE_INFINITY,
    annual_max_remaining_cents: null,
  });
  console.log(`\n(9) garbage inputs\n  out=${JSON.stringify(b)}`);
  assert(b.gross_cents === 0, "NaN gross degrades to 0");
  assert(b.reimbursement_rate === 0, "non-finite rate degrades to 0");
  assert(b.true_oop_cents === 0, "no negative or NaN oop");
}

// --- 10. Negative gross is floored at 0 --------------------------------------
{
  const b = computeTrueOop({
    gross_cents: -5000,
    deductible_remaining_cents: 1000,
    reimbursement_rate: 0.8,
    annual_max_remaining_cents: null,
  });
  console.log(`\n(10) negative gross\n  out=${JSON.stringify(b)}`);
  assert(b.gross_cents === 0, "negative gross floored to 0");
  assert(b.true_oop_cents === 0, "true oop floored to 0");
}

console.log("\n" + "=".repeat(72));
if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
} else {
  console.log("RESULT: PASS");
}
