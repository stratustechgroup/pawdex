import { NextResponse, type NextRequest } from "next/server";

import { sendRecordsRequestForEvent } from "@/lib/outbound/records-request";
import { secretsEqual } from "@/lib/security/compare";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron — finds pending_records_requests scheduled for today or earlier
// (status = scheduled) and sends each via sendRecordsRequestForEvent. The
// individual sender:
//   - re-validates the records_request_to_vets authorization (revoked since
//     enqueue → skip)
//   - inserts an outbound_emails row and flips the pending row to 'sent' or
//     'failed' as appropriate
//
// pg_cron schedules a POST to this route once a day; we authenticate via the
// CRON_SECRET shared with Supabase Vault (same secret used by reminders-cron).

const MAX_PER_RUN = 100;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[records-requests-cron] CRON_SECRET not configured in production — refusing request",
      );
      return NextResponse.json(
        { error: "cron secret not configured" },
        { status: 500 },
      );
    }
    console.warn(
      "[records-requests-cron] CRON_SECRET not set — accepting unsigned request in dev mode",
    );
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (!secretsEqual(auth, `Bearer ${secret}`)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Pick scheduled rows due today or earlier. Cap per run so a misbehaving
  // household can't blow the function's wall time.
  const { data: due, error } = await supabase
    .from("pending_records_requests")
    .select("id, household_id, medical_event_id, created_by, households(deleted_at)")
    .eq("status", "scheduled")
    .lte("scheduled_for", today)
    .limit(MAX_PER_RUN);

  if (error) {
    return NextResponse.json(
      { error: `query failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Never send on behalf of a soft-deleted household: it is on its way to being
  // purged, so cancel any queued outbound instead of mailing a vet clinic.
  const rows = (due ?? []).filter((r) => {
    const hh = (r as { households?: { deleted_at: string | null } | null }).households;
    return !hh?.deleted_at;
  });
  const summary = {
    triggered_at: new Date().toISOString(),
    scanned: rows.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    skipped_reasons: {} as Record<string, number>,
  };

  for (const row of rows) {
    if (!row.medical_event_id) {
      summary.skipped++;
      summary.skipped_reasons.no_event =
        (summary.skipped_reasons.no_event ?? 0) + 1;
      await supabase
        .from("pending_records_requests")
        .update({
          status: "cancelled",
          error_message: "medical_event_id missing on scheduled row",
        })
        .eq("id", row.id);
      continue;
    }

    // Default to the row's creator as the actor. If null (system-enqueued
    // for some reason), find a household owner to attribute to.
    let actorId = row.created_by;
    if (!actorId) {
      const { data: owner } = await supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", row.household_id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();
      actorId = owner?.user_id ?? null;
    }
    if (!actorId) {
      summary.skipped++;
      summary.skipped_reasons.no_actor =
        (summary.skipped_reasons.no_actor ?? 0) + 1;
      await supabase
        .from("pending_records_requests")
        .update({
          status: "cancelled",
          error_message: "no actor available to attribute the send to",
        })
        .eq("id", row.id);
      continue;
    }

    const result = await sendRecordsRequestForEvent({
      householdId: row.household_id,
      userId: actorId,
      medicalEventId: row.medical_event_id,
    });

    if (result.ok) {
      // sendRecordsRequestForEvent inserts its own pending_records_requests
      // row + flips it to sent. The pre-existing scheduled row needs to be
      // marked sent too so it doesn't fire again tomorrow.
      await supabase
        .from("pending_records_requests")
        .update({ status: "sent", outbound_email_id: result.outbound_email_id })
        .eq("id", row.id);
      summary.sent++;
    } else if (result.code === "authorization_missing") {
      await supabase
        .from("pending_records_requests")
        .update({ status: "cancelled", error_message: result.error })
        .eq("id", row.id);
      summary.skipped++;
      summary.skipped_reasons.authorization_missing =
        (summary.skipped_reasons.authorization_missing ?? 0) + 1;
    } else {
      await supabase
        .from("pending_records_requests")
        .update({ status: "failed", error_message: result.error })
        .eq("id", row.id);
      summary.failed++;
    }
  }

  return NextResponse.json(summary);
}

// GET is allowed for dev-mode manual invocation only.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "use POST" }, { status: 405 });
  }
  return POST(request);
}
