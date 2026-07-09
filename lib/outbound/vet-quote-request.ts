import "server-only";

import { Resend } from "resend";

import {
  AuthorizationMissingError,
  requireAuthorization,
} from "@/lib/auth/authorizations";
import { recordAudit } from "@/lib/db/audit";
import { inboxAddressFor } from "@/lib/db/inbound-addresses";
import { createServiceClient } from "@/lib/supabase/service";

export type VetQuoteResult =
  | { ok: true; outbound_email_id: string; cost_estimate_id: string }
  | {
      ok: false;
      error: string;
      code:
        | "authorization_missing"
        | "no_clinic_email"
        | "send_failed"
        | "policy_not_found"
        | "pet_not_found";
    };

const TEMPLATE_ID = "vet-quote-request.v1";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function requestVetQuote(input: {
  householdId: string;
  userId: string;
  petId: string;
  insurancePolicyId: string | null;
  vetClinicId: string;
  procedureSummary: string;
}): Promise<VetQuoteResult> {
  const supabase = createServiceClient();

  let authorizationId: string;
  try {
    const auth = await requireAuthorization(
      input.householdId,
      "records_request_to_vets",
    );
    authorizationId = auth.id;
  } catch (err) {
    if (err instanceof AuthorizationMissingError) {
      return {
        ok: false,
        error:
          "Pawdex needs your authorization to email vet clinics on your behalf. Grant it in Settings → Authorizations.",
        code: "authorization_missing",
      };
    }
    throw err;
  }

  const [{ data: pet }, { data: clinic }, { data: owner }] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, species, household_id")
      .eq("id", input.petId)
      .maybeSingle(),
    supabase
      .from("vet_clinics")
      .select("id, name, email, household_id")
      .eq("id", input.vetClinicId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(input.userId),
  ]);

  if (!pet || pet.household_id !== input.householdId) {
    return { ok: false, error: "Pet not found.", code: "pet_not_found" };
  }
  if (!clinic || clinic.household_id !== input.householdId) {
    return { ok: false, error: "Clinic not found.", code: "no_clinic_email" };
  }
  if (!clinic.email) {
    return {
      ok: false,
      error: `No email on file for ${clinic.name}. Add one on the clinic detail page first.`,
      code: "no_clinic_email",
    };
  }

  const { data: inboundAddress } = await supabase
    .from("household_inbound_addresses")
    .select("slug")
    .eq("household_id", input.householdId)
    .maybeSingle();
  const replyTo = inboundAddress?.slug
    ? inboxAddressFor(inboundAddress.slug)
    : null;

  const ownerEmail = owner?.user?.email ?? null;
  const ownerName =
    (owner?.user?.user_metadata?.full_name as string | undefined) ?? null;
  const ownerLabel = ownerName ?? ownerEmail ?? "the owner";

  const subject = `Estimate request for ${pet.name} — sent on behalf of ${ownerLabel}`;
  const text = `Hello ${clinic.name} team,

${ownerLabel} is requesting a written cost estimate for the following procedure for ${pet.name} (${pet.species}):

${input.procedureSummary.trim()}

Please reply with itemized line items + a total estimate so we can plan with the pet insurance carrier. ${replyTo ? `Reply to ${replyTo} and a copy will be retained in the owner's Pawdex account.` : `Reply to ${ownerEmail ?? "the owner"}.`}

This message was sent through Pawdex (https://pawdex.app) under the owner's documented authorization to communicate with their veterinary providers.

Thank you,
Pawdex on behalf of ${ownerLabel}`;

  const html = `<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.55;">
<p>Hello ${escapeHtml(clinic.name)} team,</p>
<p><strong>${escapeHtml(ownerLabel)}</strong> is requesting a written cost estimate for the following procedure for <strong>${escapeHtml(pet.name)}</strong> (${escapeHtml(pet.species)}):</p>
<blockquote style="margin: 12px 0; padding: 10px 14px; border-left: 3px solid #2d5a3d; background: #f7f5ee; white-space: pre-wrap;">${escapeHtml(input.procedureSummary)}</blockquote>
<p>Please reply with itemized line items + a total estimate so we can plan with the pet insurance carrier. ${replyTo ? `Reply to <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a> and a copy will be retained in the owner's Pawdex account.` : `Reply to <a href="mailto:${escapeHtml(ownerEmail ?? "")}">${escapeHtml(ownerEmail ?? "the owner")}</a>.`}</p>
<p style="color:#666; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
This message was sent through <a href="https://pawdex.app" style="color:#2d5a3d;">Pawdex</a> under the owner's documented authorization to communicate with veterinary providers.
</p>
<p>Thank you,<br>Pawdex on behalf of ${escapeHtml(ownerLabel)}</p>
</body></html>`;

  const { data: outbound, error: outboundErr } = await supabase
    .from("outbound_emails")
    .insert({
      household_id: input.householdId,
      pet_id: pet.id,
      authorization_id: authorizationId,
      recipient_email: clinic.email,
      recipient_name: clinic.name,
      recipient_type: "vet_clinic",
      template_id: TEMPLATE_ID,
      subject,
      body_text: text,
      body_html: html,
      status: "queued",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (outboundErr || !outbound) {
    return {
      ok: false,
      error: outboundErr?.message ?? "Failed to record outbound email.",
      code: "send_failed",
    };
  }

  const { data: estimate, error: estErr } = await supabase
    .from("cost_estimates")
    .insert({
      household_id: input.householdId,
      pet_id: pet.id,
      insurance_policy_id: input.insurancePolicyId,
      procedure_summary: input.procedureSummary,
      status: "pending_vet_response",
      request_email_id: outbound.id,
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (estErr || !estimate) {
    return {
      ok: false,
      error: estErr?.message ?? "Failed to create estimate record.",
      code: "send_failed",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey) {
    console.warn(
      "[vet-quote-request] RESEND_API_KEY not set — recording email but skipping send",
    );
    await supabase
      .from("outbound_emails")
      .update({
        status: "drafted",
        error_message: "RESEND_API_KEY not configured (dev mode)",
      })
      .eq("id", outbound.id);
    return {
      ok: true,
      outbound_email_id: outbound.id,
      cost_estimate_id: estimate.id,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: clinic.email,
      subject,
      text,
      html,
      replyTo: replyTo ?? ownerEmail ?? undefined,
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
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "send failed";
    await supabase
      .from("outbound_emails")
      .update({ status: "failed", error_message: errMessage })
      .eq("id", outbound.id);
    return { ok: false, error: errMessage, code: "send_failed" };
  }

  await recordAudit({
    householdId: input.householdId,
    actorId: input.userId,
    action: "create",
    entityType: "outbound_email",
    entityId: outbound.id,
    diff: {
      after: {
        kind: "vet_quote_request",
        clinic_id: clinic.id,
        clinic_name: clinic.name,
        cost_estimate_id: estimate.id,
        pet_id: pet.id,
      },
    },
  });

  return {
    ok: true,
    outbound_email_id: outbound.id,
    cost_estimate_id: estimate.id,
  };
}
