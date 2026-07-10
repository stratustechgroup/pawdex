import "server-only";

import { Resend } from "resend";

import {
  AuthorizationMissingError,
  requireAuthorization,
} from "@/lib/auth/authorizations";
import { recordAudit } from "@/lib/db/audit";
import { inboxAddressFor } from "@/lib/db/inbound-addresses";
import { createServiceClient } from "@/lib/supabase/service";
import { renderRecordsRequestEmail } from "@/lib/outbound/records-request-template";

export type RecordsRequestResult =
  | { ok: true; outbound_email_id: string; pending_request_id: string }
  | { ok: false; error: string; code: RecordsRequestErrorCode };

export type RecordsRequestErrorCode =
  | "authorization_missing"
  | "no_vet_email"
  | "vet_not_found"
  | "event_not_found"
  | "pet_not_found"
  | "household_address_missing"
  | "send_failed"
  | "unknown";

/**
 * Compose + send a records-request email for a specific medical event. Used
 * by both the user-triggered "Request records" button and (later) the auto
 * cron that fires N days after a logged visit. Idempotency is the caller's
 * responsibility — each call inserts a fresh outbound row.
 */
export async function sendRecordsRequestForEvent(input: {
  householdId: string;
  userId: string;
  medicalEventId: string;
}): Promise<RecordsRequestResult> {
  const supabase = createServiceClient();

  // 1. Authorization gate — no auth, no email.
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

  // 2. Load event + pet + clinic + owner contact.
  const { data: event } = await supabase
    .from("medical_events")
    .select(
      "id, household_id, pet_id, vet_clinic_id, occurred_on, title, event_type",
    )
    .eq("id", input.medicalEventId)
    .eq("household_id", input.householdId)
    .maybeSingle();
  if (!event) return { ok: false, error: "Medical event not found.", code: "event_not_found" };
  if (!event.vet_clinic_id) {
    return {
      ok: false,
      error: "This visit has no vet clinic on file. Edit the visit to set the clinic first.",
      code: "vet_not_found",
    };
  }

  const [{ data: pet }, { data: clinic }, { data: owner }] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, species")
      .eq("id", event.pet_id)
      .maybeSingle(),
    supabase
      .from("vet_clinics")
      .select("id, name, email")
      .eq("id", event.vet_clinic_id)
      .maybeSingle(),
    supabase.auth.admin.getUserById(input.userId),
  ]);

  if (!pet) return { ok: false, error: "Pet not found.", code: "pet_not_found" };
  if (!clinic) return { ok: false, error: "Vet clinic not found.", code: "vet_not_found" };
  if (!clinic.email) {
    return {
      ok: false,
      error: `No email on file for ${clinic.name}. Add one on the clinic detail page first.`,
      code: "no_vet_email",
    };
  }

  // 3. Owner's inbound address — let the clinic reply directly into Pawdex.
  const { data: inboundAddress } = await supabase
    .from("household_inbound_addresses")
    .select("slug")
    .eq("household_id", input.householdId)
    .maybeSingle();
  const replyTo = inboundAddress?.slug ? inboxAddressFor(inboundAddress.slug) : null;

  const ownerEmail = owner?.user?.email ?? null;
  const ownerName = (owner?.user?.user_metadata?.full_name as string | undefined) ?? null;

  // 4. Render the email.
  const { subject, text, html } = renderRecordsRequestEmail({
    ownerName,
    ownerEmail,
    petName: pet.name,
    petSpecies: pet.species,
    visitDate: event.occurred_on,
    visitTitle: event.title,
    clinicName: clinic.name,
  });

  // 5. Create the outbound_emails row up-front in 'queued' status so that if
  // Resend fails we still have a record of the attempt with all the context.
  const { data: outbound, error: insertErr } = await supabase
    .from("outbound_emails")
    .insert({
      household_id: input.householdId,
      pet_id: pet.id,
      recipient_email: clinic.email,
      recipient_name: clinic.name,
      recipient_type: "vet_clinic",
      authorization_id: authorizationId,
      template_id: "records-request.v1",
      subject,
      body_text: text,
      body_html: html,
      status: "queued",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (insertErr || !outbound) {
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to record outbound email.",
      code: "unknown",
    };
  }

  // 6. Also queue a pending_records_requests row that ties this to the event.
  const { data: pending } = await supabase
    .from("pending_records_requests")
    .insert({
      household_id: input.householdId,
      pet_id: pet.id,
      vet_clinic_id: clinic.id,
      medical_event_id: event.id,
      outbound_email_id: outbound.id,
      request_summary: `${pet.name} — ${event.title}`,
      scheduled_for: new Date().toISOString().slice(0, 10),
      status: "scheduled",
      created_by: input.userId,
    })
    .select("id")
    .single();

  // 7. Actually send via Resend.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "records@pawdex.app";

  if (!apiKey) {
    console.warn(
      "[records-request] RESEND_API_KEY not set — recording email but skipping send",
    );
    await supabase
      .from("outbound_emails")
      .update({
        status: "drafted",
        error_message: "RESEND_API_KEY not configured (dev mode)",
      })
      .eq("id", outbound.id);
    // Cancel the pending row this call created. Left on 'scheduled', the daily
    // cron would re-pick it every run (its query is status='scheduled' AND
    // scheduled_for<=today), spawning a fresh drafted outbound + pending row
    // each day: an unbounded loop precisely in the no-key state we ship in.
    if (pending?.id) {
      await supabase
        .from("pending_records_requests")
        .update({
          status: "cancelled",
          error_message: "RESEND_API_KEY not configured (dev mode)",
        })
        .eq("id", pending.id);
    }
    return {
      ok: true,
      outbound_email_id: outbound.id,
      pending_request_id: pending?.id ?? "",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const sendResult = await resend.emails.send({
      from,
      to: clinic.email,
      subject,
      text,
      html,
      replyTo: replyTo ?? ownerEmail ?? undefined,
    });
    const messageId = sendResult.data?.id ?? null;

    await supabase
      .from("outbound_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_message_id: messageId,
      })
      .eq("id", outbound.id);

    if (pending?.id) {
      await supabase
        .from("pending_records_requests")
        .update({ status: "sent" })
        .eq("id", pending.id);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "send failed";
    await supabase
      .from("outbound_emails")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", outbound.id);
    if (pending?.id) {
      await supabase
        .from("pending_records_requests")
        .update({ status: "failed", error_message: errorMessage })
        .eq("id", pending.id);
    }
    return { ok: false, error: errorMessage, code: "send_failed" };
  }

  await recordAudit({
    householdId: input.householdId,
    actorId: input.userId,
    action: "create",
    entityType: "outbound_email",
    entityId: outbound.id,
    diff: {
      after: {
        kind: "records_request",
        recipient_email: clinic.email,
        recipient_name: clinic.name,
        pet_id: pet.id,
        medical_event_id: event.id,
      },
    },
  });

  return {
    ok: true,
    outbound_email_id: outbound.id,
    pending_request_id: pending?.id ?? "",
  };
}
