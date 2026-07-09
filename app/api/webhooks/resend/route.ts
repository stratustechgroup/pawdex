import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Resend delivery webhook. Updates reminders.status when emails bounce or get
// flagged as spam complaints. After 2 hard bounces to the same household,
// flips email_enabled to false so we stop hammering a dead inbox.
//
// Resend signs requests with Svix headers when a signing secret is configured
// (RESEND_WEBHOOK_SECRET). We verify with svix-style HMAC over
// `${id}.${timestamp}.${body}` and reject anything older than 5 minutes.

type ResendEvent = {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.bounced"
    | "email.complained"
    | "email.opened"
    | "email.clicked"
    | (string & {});
  created_at: string;
  data: {
    email_id?: string;
    to?: string | string[];
    subject?: string;
  };
};

const TOLERANCE_SECONDS = 5 * 60;

function verifySvixSignature(
  body: string,
  headers: Headers,
  secret: string,
): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  // Secret format: "whsec_<base64>". The HMAC is computed over the raw secret bytes.
  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // Header is space-delimited list of "v1,<base64sig>" entries.
  const provided = signatureHeader
    .split(" ")
    .map((part) => part.split(","))
    .filter(([scheme]) => scheme === "v1")
    .map(([, sig]) => sig);

  for (const sig of provided) {
    if (!sig) continue;
    const a = Buffer.from(sig, "base64");
    const b = Buffer.from(expected, "base64");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const body = await request.text();

  // Signature is required when the secret is configured. If unconfigured in
  // dev, accept with a warning; in production, refuse so a missing-secret
  // deploy doesn't silently open the route.
  if (secret) {
    if (!verifySvixSignature(body, request.headers, secret)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error(
      "[resend webhook] RESEND_WEBHOOK_SECRET not configured in production — refusing request",
    );
    return NextResponse.json(
      { error: "webhook secret not configured" },
      { status: 500 },
    );
  } else {
    console.warn(
      "[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned event in dev mode",
    );
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const messageId = event.data.email_id;

  if (!messageId) {
    // Some event types don't carry an email id (eg engagement events scoped
    // differently). Acknowledge and move on.
    return NextResponse.json({ ok: true, note: "no email_id" });
  }

  switch (event.type) {
    case "email.delivered": {
      // Already-sent rows: no DB change needed (status is already 'sent').
      // We could timestamp a delivered_at column in the future if useful.
      break;
    }

    case "email.bounced":
    case "email.complained": {
      const errorMessage =
        event.type === "email.complained"
          ? "Recipient flagged the email as spam"
          : "Hard bounce — delivery permanently failed";

      // Flip the matching reminder rows to 'failed' for visibility, and find
      // the affected household so we can disable email after enough strikes.
      const { data: bounced } = await supabase
        .from("reminders")
        .update({ status: "failed", error_message: errorMessage })
        .eq("resend_message_id", messageId)
        .select("household_id");

      const householdIds = [
        ...new Set(
          (bounced ?? [])
            .map((r) => r.household_id)
            .filter((h): h is string => !!h),
        ),
      ];

      for (const householdId of householdIds) {
        // Count this household's hard-bounce reminders in the last 30 days.
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const { count } = await supabase
          .from("reminders")
          .select("id", { head: true, count: "exact" })
          .eq("household_id", householdId)
          .eq("status", "failed")
          .gte("created_at", cutoff.toISOString());

        if ((count ?? 0) >= 2) {
          await supabase
            .from("reminder_preferences")
            .upsert(
              { household_id: householdId, email_enabled: false },
              { onConflict: "household_id" },
            );
          console.warn(
            `[resend webhook] disabled email for household ${householdId} after ${count} bounces`,
          );
        }
      }
      break;
    }

    default:
      // Other event types (sent, delivery_delayed, opened, clicked) — ignore.
      break;
  }

  return NextResponse.json({ ok: true });
}
