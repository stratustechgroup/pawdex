import "server-only";

import { addDays, formatISO } from "date-fns";

import { getEffectiveAuthorization } from "@/lib/auth/authorizations";
import { createServiceClient } from "@/lib/supabase/service";

export type EnqueueAttempt = {
  scheduled: boolean;
  reason?:
    | "auto_disabled"
    | "no_clinic"
    | "no_clinic_email"
    | "no_authorization"
    | "already_scheduled"
    | "event_not_found";
  pendingRequestId?: string;
};

/**
 * Idempotent — when the household has auto_request_records enabled and the
 * event has a vet_clinic with email + the authorization is in place, insert
 * a pending_records_requests row scheduled for occurred_on + lead_days.
 *
 * Safe to call repeatedly: a unique-ish key (household_id, medical_event_id,
 * status='scheduled') is checked before insert so duplicates don't pile up.
 */
export async function maybeScheduleRecordsRequest(input: {
  householdId: string;
  medicalEventId: string;
  createdBy?: string | null;
}): Promise<EnqueueAttempt> {
  const supabase = createServiceClient();

  // Load preferences. If reminder_preferences row is missing, treat as default
  // (auto_request_records=false → don't auto-schedule).
  const { data: prefs } = await supabase
    .from("reminder_preferences")
    .select("auto_request_records, auto_request_lead_days")
    .eq("household_id", input.householdId)
    .maybeSingle();
  if (!prefs || !prefs.auto_request_records) {
    return { scheduled: false, reason: "auto_disabled" };
  }

  // Load event + clinic.
  const { data: event } = await supabase
    .from("medical_events")
    .select(
      "id, household_id, pet_id, vet_clinic_id, occurred_on, title",
    )
    .eq("id", input.medicalEventId)
    .eq("household_id", input.householdId)
    .maybeSingle();
  if (!event) return { scheduled: false, reason: "event_not_found" };
  if (!event.vet_clinic_id) return { scheduled: false, reason: "no_clinic" };

  const { data: clinic } = await supabase
    .from("vet_clinics")
    .select("id, email")
    .eq("id", event.vet_clinic_id)
    .maybeSingle();
  if (!clinic?.email) return { scheduled: false, reason: "no_clinic_email" };

  // Authorization gate — no auth, no enqueue.
  const auth = await getEffectiveAuthorization(
    input.householdId,
    "records_request_to_vets",
  );
  if (!auth) return { scheduled: false, reason: "no_authorization" };

  // Dedupe by (household_id, medical_event_id) — never enqueue twice for the
  // same event, regardless of status. A user-triggered manual send is also a
  // pending_records_requests row, so this prevents the cron from firing on
  // top of a manual send.
  const { data: existing } = await supabase
    .from("pending_records_requests")
    .select("id")
    .eq("household_id", input.householdId)
    .eq("medical_event_id", input.medicalEventId)
    .limit(1);
  if (existing && existing.length > 0) {
    return {
      scheduled: false,
      reason: "already_scheduled",
      pendingRequestId: existing[0].id,
    };
  }

  const scheduledFor = formatISO(
    addDays(new Date(event.occurred_on), prefs.auto_request_lead_days),
    { representation: "date" },
  );

  const { data: pending, error: insErr } = await supabase
    .from("pending_records_requests")
    .insert({
      household_id: input.householdId,
      pet_id: event.pet_id,
      vet_clinic_id: clinic.id,
      medical_event_id: event.id,
      request_summary: event.title,
      scheduled_for: scheduledFor,
      status: "scheduled",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (insErr || !pending) {
    throw new Error(
      `maybeScheduleRecordsRequest insert: ${insErr?.message ?? "no row"}`,
    );
  }

  return { scheduled: true, pendingRequestId: pending.id };
}
