"use server";

import { requireSession } from "@/lib/auth/household";
import { refinePECAnalysis, type RefinedVerdict } from "@/lib/ai/pec-refine";
import { analyzePECForHousehold } from "@/lib/db/pec-analysis";

export type RefineState =
  | { status: "idle" }
  | { status: "refined"; verdicts: RefinedVerdict[] }
  | { status: "error"; message: string };

export async function refineAction(
  _prev: RefineState,
  formData: FormData,
): Promise<RefineState> {
  const policyId = String(formData.get("policy_id") ?? "");
  if (!policyId) return { status: "error", message: "Missing policy id." };
  const session = await requireSession();
  try {
    const all = await analyzePECForHousehold(session.householdId);
    const policy = all.find((p) => p.policy_id === policyId);
    if (!policy) return { status: "error", message: "Policy not found." };
    const verdicts = await refinePECAnalysis(policy);
    return { status: "refined", verdicts };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Refine failed.",
    };
  }
}
