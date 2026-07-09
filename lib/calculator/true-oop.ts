/**
 * True out-of-pocket calculator. Pure function — given a gross estimate +
 * policy terms, compute what the owner actually pays after insurance.
 *
 * Math (all values in cents):
 *   eligible       = max(0, gross - applied_deductible)
 *   reimbursement  = eligible × reimbursement_rate, capped at remaining_annual_max
 *   true_oop       = gross - reimbursement
 *
 * Inputs accept null to mean "unknown" — in that case we degrade gracefully:
 *   - missing reimbursement_rate → no reimbursement, true_oop = gross
 *   - missing deductible → assume already met (apply 0)
 *   - missing annual_max → no cap
 */

export type TrueOopInputs = {
  gross_cents: number;
  deductible_remaining_cents: number | null;
  reimbursement_rate: number | null; // 0..1
  annual_max_remaining_cents: number | null;
};

export type TrueOopBreakdown = {
  gross_cents: number;
  applied_deductible_cents: number;
  reimbursement_eligible_cents: number;
  reimbursement_rate: number;
  reimbursement_paid_cents: number;
  true_oop_cents: number;
  hit_annual_max: boolean;
};

export function computeTrueOop(inputs: TrueOopInputs): TrueOopBreakdown {
  const gross = Math.max(0, Math.round(inputs.gross_cents || 0));
  const rate = clamp01(inputs.reimbursement_rate ?? 0);
  const deductible = Math.max(0, inputs.deductible_remaining_cents ?? 0);

  const applied = Math.min(deductible, gross);
  const eligible = Math.max(0, gross - applied);

  let reimbursement = Math.round(eligible * rate);
  let hitMax = false;
  if (
    inputs.annual_max_remaining_cents !== null &&
    inputs.annual_max_remaining_cents !== undefined
  ) {
    const cap = Math.max(0, inputs.annual_max_remaining_cents);
    if (reimbursement > cap) {
      reimbursement = cap;
      hitMax = true;
    }
  }

  const oop = gross - reimbursement;

  return {
    gross_cents: gross,
    applied_deductible_cents: applied,
    reimbursement_eligible_cents: eligible,
    reimbursement_rate: rate,
    reimbursement_paid_cents: reimbursement,
    true_oop_cents: oop,
    hit_annual_max: hitMax,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
