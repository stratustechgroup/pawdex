"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { getEffectiveAuthorization } from "@/lib/auth/authorizations";
import {
  draftInsurerClarification,
  sendInsurerClarification,
} from "@/lib/outbound/insurer-clarification";
import { createServiceClient } from "@/lib/supabase/service";

export type ClarifyState =
  | { status: "idle" }
  | {
      status: "drafted";
      question: string;
      subject: string;
      body: string;
      authorizationGranted: boolean;
    }
  | { status: "sent"; outboundEmailId: string }
  | { status: "error"; message: string; code?: string };

const initial: ClarifyState = { status: "idle" };

export async function draftClarificationAction(
  _prev: ClarifyState,
  formData: FormData,
): Promise<ClarifyState> {
  void initial;
  const policyId = String(formData.get("policy_id") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const policyContext = String(formData.get("policy_context") ?? "").trim();
  if (!policyId) return { status: "error", message: "Missing policy id." };
  if (!question)
    return { status: "error", message: "Type a question for the insurer." };

  const session = await requireSession();
  if (session.role === "viewer") {
    return { status: "error", message: "Viewers can't draft insurer emails." };
  }
  const supabase = createServiceClient();
  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id, household_id, insurer_name, plan_name, policy_number")
    .eq("id", policyId)
    .maybeSingle();
  if (!policy || policy.household_id !== session.householdId) {
    return { status: "error", message: "Policy not found." };
  }

  // For ownerName/email we use the session's email and any metadata.
  const { data: userRes } = await supabase.auth.admin.getUserById(session.userId);
  const ownerEmail = userRes?.user?.email ?? session.email ?? null;
  const ownerName =
    (userRes?.user?.user_metadata?.full_name as string | undefined) ?? null;

  let draft;
  try {
    draft = await draftInsurerClarification({
      policy: {
        insurer_name: policy.insurer_name,
        plan_name: policy.plan_name,
        policy_number: policy.policy_number,
      },
      ownerName,
      ownerEmail,
      question,
      policyContext: policyContext || null,
    });
  } catch (err) {
    return {
      status: "error",
      message: `Draft failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  const auth = await getEffectiveAuthorization(
    session.householdId,
    "insurer_clarification_emails",
  );

  return {
    status: "drafted",
    question,
    subject: draft.subject,
    body: draft.body,
    authorizationGranted: auth !== null,
  };
}

export async function sendClarificationAction(
  _prev: ClarifyState,
  formData: FormData,
): Promise<ClarifyState> {
  const policyId = String(formData.get("policy_id") ?? "");
  const recipient = String(formData.get("recipient_email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!policyId || !recipient || !subject || !body) {
    return { status: "error", message: "All fields are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { status: "error", message: "Recipient email doesn't look valid." };
  }

  const session = await requireSession();
  if (session.role === "viewer") {
    return { status: "error", message: "Viewers can't send insurer emails." };
  }
  const result = await sendInsurerClarification({
    householdId: session.householdId,
    userId: session.userId,
    insurancePolicyId: policyId,
    recipientEmail: recipient,
    subject,
    body,
  });

  if (!result.ok) {
    return { status: "error", message: result.error, code: result.code };
  }

  revalidatePath("/settings/activity");
  revalidatePath(`/insurance/${policyId}/clarify`);
  return { status: "sent", outboundEmailId: result.outbound_email_id };
}
