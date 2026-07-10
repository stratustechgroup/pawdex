import "server-only";

import { generateObject } from "ai";
import { Resend } from "resend";
import { z } from "zod";

import {
  AuthorizationMissingError,
  requireAuthorization,
} from "@/lib/auth/authorizations";
import { getOpenRouter, MODEL_TIER3 } from "@/lib/ai/openrouter";
import { recordAudit } from "@/lib/db/audit";
import { inboxAddressFor } from "@/lib/db/inbound-addresses";
import { createServiceClient } from "@/lib/supabase/service";

const draftSchema = z.object({
  subject: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "Subject line. Plain and factual — start with 'Policy clarification request' or similar. No exclamation marks, no 'urgent' framing.",
    ),
  body: z
    .string()
    .min(40)
    .describe(
      "Body of the email. Plain language. Quote the relevant policy section if helpful. End with a clear specific question. Sign off as 'On behalf of {owner_name_or_email}'.",
    ),
});

export type ClarificationDraft = z.infer<typeof draftSchema>;

const DRAFT_SYSTEM_PROMPT = `You draft policy-clarification emails to pet insurers on behalf of policyholders. Output ONE JSON object: {subject, body}.

Rules of writing — these are non-negotiable:

- NEUTRAL. The owner is asking for information. You are NOT advocating, demanding, threatening, or arguing. No "I deserve", "this is unfair", "I expect", "I demand".
- FACTUAL. State the question precisely. Quote relevant policy language when the user provided it.
- NO ADMISSIONS. Never admit anything about the pet's condition that the user didn't explicitly state. Never speculate about diagnosis or coverage on the owner's behalf.
- NO MEDICAL OPINIONS. The email is about policy language, not medical interpretation.
- BRIEF. 4–6 sentences in the body. No filler. No "I hope this finds you well".
- SPECIFIC ASK. The body MUST end with a single, narrowly-scoped question. If the user's question is broad, ask the most actionable clarifying piece.
- SIGN-OFF. End with "Best regards," and then the owner's name or email on its own line. Pawdex's role is the messenger — the policyholder is the signatory.
- ATTRIBUTION. Add one closing line acknowledging the email was drafted via Pawdex on the owner's behalf.

Subject formula: "Policy clarification request — [topic]". Topic is 2-5 words pulled from the user's question.

Example body shape (for reference, do not copy verbatim):
"I am writing to request clarification on policy [policy_number] regarding [topic]. Specifically, [the precise question, quoting policy text if available]. Could you confirm [the narrow ask]?

Best regards,
[Owner name]

This message was drafted via Pawdex on the owner's behalf under documented authorization. Replies will be received at the owner's inbox and retained for their reference."`;

export async function draftInsurerClarification(input: {
  policy: {
    insurer_name: string;
    plan_name: string | null;
    policy_number: string | null;
  };
  ownerName: string | null;
  ownerEmail: string | null;
  question: string;
  policyContext: string | null;
}): Promise<ClarificationDraft> {
  const openrouter = getOpenRouter();
  const promptUser = `Insurer: ${input.policy.insurer_name}
Plan: ${input.policy.plan_name ?? "(unknown)"}
Policy number: ${input.policy.policy_number ?? "(unknown)"}
Owner: ${input.ownerName ?? input.ownerEmail ?? "the policyholder"}

Owner's question:
${input.question.trim()}

${input.policyContext ? `Policy language to quote (if helpful):\n${input.policyContext}\n` : ""}`;

  const { object } = await generateObject({
    model: openrouter(MODEL_TIER3),
    schema: draftSchema,
    system: DRAFT_SYSTEM_PROMPT,
    prompt: promptUser,
  });
  return object;
}

export type SendClarificationResult =
  | { ok: true; outbound_email_id: string; resend_message_id: string | null }
  | { ok: false; error: string; code: "authorization_missing" | "send_failed" };

export async function sendInsurerClarification(input: {
  householdId: string;
  userId: string;
  insurancePolicyId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}): Promise<SendClarificationResult> {
  const supabase = createServiceClient();

  let authorizationId: string;
  try {
    const auth = await requireAuthorization(
      input.householdId,
      "insurer_clarification_emails",
    );
    authorizationId = auth.id;
  } catch (err) {
    if (err instanceof AuthorizationMissingError) {
      return {
        ok: false,
        error:
          "Grant the 'Draft clarification emails to my insurer' authorization in Settings before sending.",
        code: "authorization_missing",
      };
    }
    throw err;
  }

  // Load the policy + reply-to.
  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id, household_id, insurer_name, pet_id")
    .eq("id", input.insurancePolicyId)
    .maybeSingle();
  if (!policy || policy.household_id !== input.householdId) {
    return { ok: false, error: "Policy not found.", code: "send_failed" };
  }

  const { data: inboundAddress } = await supabase
    .from("household_inbound_addresses")
    .select("slug")
    .eq("household_id", input.householdId)
    .maybeSingle();
  const replyTo = inboundAddress?.slug
    ? inboxAddressFor(inboundAddress.slug)
    : null;

  // Insert outbound row in 'queued' status first.
  const { data: outbound, error: insErr } = await supabase
    .from("outbound_emails")
    .insert({
      household_id: input.householdId,
      pet_id: policy.pet_id,
      recipient_email: input.recipientEmail,
      recipient_name: policy.insurer_name,
      recipient_type: "insurer",
      authorization_id: authorizationId,
      template_id: "insurer-clarification.v1",
      subject: input.subject,
      body_text: input.body,
      body_html: null,
      status: "queued",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (insErr || !outbound) {
    return {
      ok: false,
      error: insErr?.message ?? "Failed to record outbound email.",
      code: "send_failed",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "insurance@pawdex.app";

  if (!apiKey) {
    console.warn(
      "[insurer-clarification] RESEND_API_KEY not set — recording email but skipping send",
    );
    await supabase
      .from("outbound_emails")
      .update({
        status: "drafted",
        error_message: "RESEND_API_KEY not configured (dev mode)",
      })
      .eq("id", outbound.id);
    return { ok: true, outbound_email_id: outbound.id, resend_message_id: null };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.recipientEmail,
      subject: input.subject,
      text: input.body,
      replyTo: replyTo ?? undefined,
    });
    const messageId = result.data?.id ?? null;
    await supabase
      .from("outbound_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_message_id: messageId,
      })
      .eq("id", outbound.id);

    await recordAudit({
      householdId: input.householdId,
      actorId: input.userId,
      action: "create",
      entityType: "outbound_email",
      entityId: outbound.id,
      diff: {
        after: {
          kind: "insurer_clarification",
          recipient_email: input.recipientEmail,
          insurer_name: policy.insurer_name,
        },
      },
    });

    return {
      ok: true,
      outbound_email_id: outbound.id,
      resend_message_id: messageId,
    };
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "send failed";
    await supabase
      .from("outbound_emails")
      .update({ status: "failed", error_message: errMessage })
      .eq("id", outbound.id);
    return { ok: false, error: errMessage, code: "send_failed" };
  }
}
