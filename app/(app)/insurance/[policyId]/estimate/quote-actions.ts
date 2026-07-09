"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { requestVetQuote } from "@/lib/outbound/vet-quote-request";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "sent"; outboundEmailId: string }
  | { status: "error"; message: string; code?: string };

export async function requestQuoteAction(
  _prev: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const policyId = String(formData.get("policy_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  const clinicId = String(formData.get("clinic_id") ?? "");
  const procedure = String(formData.get("procedure") ?? "").trim();

  if (!policyId || !petId || !clinicId) {
    return { status: "error", message: "Pick a pet + clinic." };
  }
  if (!procedure) {
    return {
      status: "error",
      message: "Describe the procedure so the vet knows what to quote.",
    };
  }

  const session = await requireSession();
  const result = await requestVetQuote({
    householdId: session.householdId,
    userId: session.userId,
    petId,
    insurancePolicyId: policyId,
    vetClinicId: clinicId,
    procedureSummary: procedure,
  });

  if (!result.ok) {
    return { status: "error", message: result.error, code: result.code };
  }

  revalidatePath(`/insurance/${policyId}/estimate`);
  return { status: "sent", outboundEmailId: result.outbound_email_id };
}
