import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { InsurancePolicy } from "@/lib/supabase/types";

export type PolicyYearWindow = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exclusive)
};

/**
 * Determine the current policy year window for a policy. The window starts
 * on `effective_on` (or its anniversary) and runs for 365 days. When
 * effective_on is missing we fall back to calendar year.
 */
export function currentPolicyYear(
  policy: Pick<InsurancePolicy, "effective_on" | "renews_on">,
  today: Date = new Date(),
): PolicyYearWindow {
  const fallbackYear = today.getUTCFullYear();
  const fallback: PolicyYearWindow = {
    start: `${fallbackYear}-01-01`,
    end: `${fallbackYear + 1}-01-01`,
  };

  if (!policy.effective_on) return fallback;

  // Anniversary: shift effective_on to the most recent anniversary <= today.
  const eff = new Date(policy.effective_on);
  if (Number.isNaN(eff.getTime())) return fallback;

  let anniversaryYear = today.getUTCFullYear();
  // If we haven't reached this year's anniversary yet, last year's is current.
  const thisYearAnniv = new Date(
    Date.UTC(anniversaryYear, eff.getUTCMonth(), eff.getUTCDate()),
  );
  if (thisYearAnniv > today) anniversaryYear -= 1;

  const start = new Date(
    Date.UTC(anniversaryYear, eff.getUTCMonth(), eff.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export type PolicyYtdTotals = {
  approved_cents: number;
  reimbursed_cents: number;
  claim_count: number;
  window: PolicyYearWindow;
};

/**
 * Total approved + reimbursed amounts for claims with service_date inside the
 * current policy year. Used by the OOP calculator to estimate
 * deductible-remaining and annual-max-remaining.
 */
export async function getPolicyYtdTotals(
  householdId: string,
  policy: InsurancePolicy,
): Promise<PolicyYtdTotals> {
  const window = currentPolicyYear(policy);
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("amount_approved_cents, amount_reimbursed_cents, service_date, status")
    .eq("household_id", householdId)
    .eq("insurance_policy_id", policy.id)
    .gte("service_date", window.start)
    .lt("service_date", window.end);

  type Row = {
    amount_approved_cents: number | null;
    amount_reimbursed_cents: number | null;
    status: string;
  };
  const rows = (data ?? []) as Row[];

  let approved = 0;
  let reimbursed = 0;
  for (const r of rows) {
    // Approved counts when an insurer accepted any portion of the claim, even
    // if reimbursement hasn't landed yet — used to estimate remaining cap.
    if (r.status === "approved" || r.status === "partially_approved" || r.status === "closed") {
      approved += r.amount_approved_cents ?? 0;
      reimbursed += r.amount_reimbursed_cents ?? 0;
    }
  }

  return {
    approved_cents: approved,
    reimbursed_cents: reimbursed,
    claim_count: rows.length,
    window,
  };
}
