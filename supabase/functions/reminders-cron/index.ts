// Pawdex — daily reminders runner.
//
// Triggered by pg_cron via pg_net.http_post (see migration
// schedule_reminders_cron). Authenticates the Bearer header against the
// CRON_SECRET project secret, then:
//   1. For each vaccination expiring in the next 35 days, computes per-lead-day
//      windows and inserts `reminders` rows. Idempotent via the UNIQUE
//      (entity_type, entity_id, lead_days) constraint.
//   2. Picks the reminders due to send today (scheduled_for <= now,
//      sent_at IS NULL, status = 'scheduled'), groups them by household + pet,
//      and sends one email per (household, pet) via Resend.
//
// Designed to be safe to re-run within a day — already-sent reminders are
// not re-sent.

// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — Deno runtime; types resolve at deploy time.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "reminders@pawdex.app";
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
const UNSUBSCRIBE_SECRET = Deno.env.get("REMINDER_UNSUBSCRIBE_SECRET");

type ReminderRow = {
  id: string;
  household_id: string;
  pet_id: string | null;
  entity_id: string;
  due_on: string;
  lead_days: number;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
};

type VaccinationRow = {
  id: string;
  household_id: string;
  pet_id: string;
  vaccine_type: string;
  expires_on: string;
};

type PetRow = { id: string; name: string };
type HouseholdPrefs = {
  household_id: string;
  email_enabled: boolean;
  email_address: string | null;
  vaccine_lead_days: number[];
  timezone: string;
};

Deno.serve(async (req) => {
  // Auth — only pg_cron + manual ops with the secret can hit this.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: "Missing Supabase env" });
  }
  if (!RESEND_API_KEY) {
    return jsonResponse(500, { error: "Missing RESEND_API_KEY" });
  }
  if (!UNSUBSCRIBE_SECRET) {
    return jsonResponse(500, { error: "Missing REMINDER_UNSUBSCRIBE_SECRET" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resend = new Resend(RESEND_API_KEY);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(today.getDate() + 35);
  const horizonISO = horizon.toISOString().slice(0, 10);

  // ---------- Step 1: compute + insert reminder rows ----------
  const computed = await computeReminders({
    supabase,
    todayISO,
    horizonISO,
  });

  // ---------- Step 2: send reminders scheduled for today ----------
  const sent = await sendDueReminders({ supabase, resend, today });

  return jsonResponse(200, {
    triggered_at: today.toISOString(),
    reminders_computed: computed.inserted,
    reminders_skipped_existing: computed.skipped,
    emails_sent: sent.count,
    emails_failed: sent.failures,
  });
});

// ============================================================
// Step 1 — compute reminders for vaccinations expiring soon
// ============================================================

async function computeReminders(args: {
  supabase: any;
  todayISO: string;
  horizonISO: string;
}): Promise<{ inserted: number; skipped: number }> {
  const { supabase, todayISO, horizonISO } = args;

  // Pull all vaccinations expiring in the next 35 days (any household).
  // Also include already-overdue ones (expires_on < today) up to ~7 days back
  // so newly-uploaded historical records still trigger "overdue" reminders.
  const overdueWindowStart = new Date(todayISO);
  overdueWindowStart.setDate(overdueWindowStart.getDate() - 7);
  const overdueWindowStartISO = overdueWindowStart.toISOString().slice(0, 10);

  const { data: vaccRows, error } = await supabase
    .from("vaccinations")
    .select("id, household_id, pet_id, vaccine_type, expires_on, reminder_lead_days")
    .not("expires_on", "is", null)
    .gte("expires_on", overdueWindowStartISO)
    .lte("expires_on", horizonISO);

  if (error) {
    console.error("computeReminders fetch failed:", error.message);
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (const v of (vaccRows ?? []) as (VaccinationRow & { reminder_lead_days: number[] })[]) {
    // Use the per-row lead days if set, otherwise the household default.
    const leads = v.reminder_lead_days?.length
      ? v.reminder_lead_days
      : [30, 14, 7, 1];

    for (const lead of leads) {
      const dueDate = new Date(v.expires_on);
      const scheduledFor = new Date(dueDate);
      scheduledFor.setDate(scheduledFor.getDate() - lead);

      // Skip windows in the future — we only compute up to "today's reminder
      // window" per the design.
      if (scheduledFor > new Date()) continue;

      const { error: insErr } = await supabase.from("reminders").insert({
        household_id: v.household_id,
        entity_type: "vaccination",
        entity_id: v.id,
        pet_id: v.pet_id,
        due_on: v.expires_on,
        lead_days: lead,
        channel: "email",
        scheduled_for: scheduledFor.toISOString(),
        status: "scheduled",
      });

      if (insErr) {
        // 23505 = unique constraint violation — already computed for this
        // (entity, lead) combination. Expected; counts as skipped.
        if ((insErr as any).code === "23505") {
          skipped++;
        } else {
          console.error("reminder insert failed:", insErr.message);
        }
      } else {
        inserted++;
      }
    }
  }

  return { inserted, skipped };
}

// ============================================================
// Step 2 — send reminders scheduled for today
// ============================================================

async function sendDueReminders(args: {
  supabase: any;
  resend: Resend;
  today: Date;
}): Promise<{ count: number; failures: number }> {
  const { supabase, resend, today } = args;

  const { data: dueRows, error } = await supabase
    .from("reminders")
    .select(
      "id, household_id, pet_id, entity_id, due_on, lead_days, scheduled_for, status, sent_at",
    )
    .eq("status", "scheduled")
    .is("sent_at", null)
    .lte("scheduled_for", today.toISOString());

  if (error) {
    console.error("sendDueReminders fetch failed:", error.message);
    return { count: 0, failures: 0 };
  }

  const due = (dueRows ?? []) as ReminderRow[];
  if (due.length === 0) return { count: 0, failures: 0 };

  // Group by (household, pet) so one pet's reminders go in one email.
  type GroupKey = string;
  const groups = new Map<GroupKey, ReminderRow[]>();
  for (const r of due) {
    const key = `${r.household_id}::${r.pet_id ?? "no-pet"}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  // Pull all referenced households, pets, and vaccines in one shot.
  const householdIds = [...new Set(due.map((r) => r.household_id))];
  const petIds = [...new Set(due.map((r) => r.pet_id).filter((x): x is string => !!x))];
  const vacIds = [...new Set(due.map((r) => r.entity_id))];

  const [prefsRes, petsRes, vacRes, ownersRes] = await Promise.all([
    supabase
      .from("reminder_preferences")
      .select("household_id, email_enabled, email_address, vaccine_lead_days, timezone")
      .in("household_id", householdIds),
    supabase
      .from("pets")
      .select("id, name")
      .in("id", petIds.length > 0 ? petIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("vaccinations")
      .select("id, vaccine_type, expires_on")
      .in("id", vacIds),
    // owners — first owner of each household, used as fallback email when
    // reminder_preferences.email_address is null.
    supabase
      .from("household_members")
      .select("household_id, user_id, role")
      .in("household_id", householdIds)
      .eq("role", "owner"),
  ]);

  const prefsByHh = new Map<string, HouseholdPrefs>();
  for (const p of (prefsRes.data ?? []) as HouseholdPrefs[]) {
    prefsByHh.set(p.household_id, p);
  }
  const petById = new Map<string, PetRow>();
  for (const p of (petsRes.data ?? []) as PetRow[]) petById.set(p.id, p);
  const vacById = new Map<string, { id: string; vaccine_type: string; expires_on: string }>();
  for (const v of (vacRes.data ?? []) as Array<{ id: string; vaccine_type: string; expires_on: string }>) {
    vacById.set(v.id, v);
  }
  const ownerIdByHh = new Map<string, string>();
  for (const m of (ownersRes.data ?? []) as Array<{ household_id: string; user_id: string }>) {
    if (!ownerIdByHh.has(m.household_id)) ownerIdByHh.set(m.household_id, m.user_id);
  }

  // Resolve owner emails via auth.users in one query.
  const ownerUserIds = [...new Set([...ownerIdByHh.values()])];
  const ownerEmailById = new Map<string, string>();
  if (ownerUserIds.length > 0) {
    const { data: usersList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersList?.users ?? []) {
      if (ownerUserIds.includes(u.id) && u.email) {
        ownerEmailById.set(u.id, u.email);
      }
    }
  }

  let count = 0;
  let failures = 0;

  for (const [key, reminders] of groups) {
    const [householdId, petKey] = key.split("::");
    const pet = petKey === "no-pet" ? null : petById.get(petKey) ?? null;
    const prefs = prefsByHh.get(householdId);

    if (prefs && !prefs.email_enabled) {
      // Email disabled for this household — mark as skipped to keep the table
      // clean and avoid re-attempt next run.
      await markReminders(supabase, reminders, {
        status: "skipped",
        error_message: "Email disabled in household preferences",
      });
      continue;
    }

    const recipient =
      prefs?.email_address ??
      (() => {
        const ownerId = ownerIdByHh.get(householdId);
        return ownerId ? ownerEmailById.get(ownerId) : undefined;
      })();

    if (!recipient) {
      await markReminders(supabase, reminders, {
        status: "failed",
        error_message: "No recipient email on file",
      });
      failures += reminders.length;
      continue;
    }

    const lines = reminders
      .map((r) => {
        const vac = vacById.get(r.entity_id);
        const expires = vac?.expires_on ?? r.due_on;
        const days = daysBetween(new Date(), new Date(expires));
        return {
          type: vac?.vaccine_type ?? "Vaccine",
          expires,
          daysUntil: days,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const petName = pet?.name ?? "Your pet";
    const subject = buildSubject(petName, lines);
    const unsubToken = await signUnsubToken(householdId);
    const unsubUrl = `${APP_URL}/api/unsubscribe/${unsubToken}`;
    const petUrl = pet
      ? `${APP_URL}/pets/${pet.id}/vaccines`
      : `${APP_URL}/reminders`;
    const settingsUrl = `${APP_URL}/settings`;
    const html = renderHtml({ petName, lines, petUrl, unsubUrl, settingsUrl });
    const text = renderText({ petName, lines, petUrl, unsubUrl, settingsUrl });

    try {
      const sendResult = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: recipient,
        subject,
        html,
        text,
      });

      if (sendResult.error) {
        console.error("resend send failed:", sendResult.error);
        await markReminders(supabase, reminders, {
          status: "failed",
          error_message: sendResult.error.message ?? "unknown",
        });
        failures += reminders.length;
      } else {
        await markReminders(supabase, reminders, {
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_message_id: sendResult.data?.id ?? null,
        });
        count += reminders.length;
      }
    } catch (err) {
      console.error("send threw:", err);
      await markReminders(supabase, reminders, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
      failures += reminders.length;
    }
  }

  return { count, failures };
}

async function markReminders(
  supabase: any,
  rows: ReminderRow[],
  patch: Record<string, unknown>,
): Promise<void> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from("reminders").update(patch).in("id", ids);
  if (error) console.error("markReminders failed:", error.message);
}

// ============================================================
// Helpers
// ============================================================

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function buildSubject(
  petName: string,
  lines: Array<{ type: string; daysUntil: number }>,
): string {
  if (lines.length === 0) return `${petName} — vaccine reminder`;
  const overdue = lines.filter((l) => l.daysUntil < 0);
  if (overdue.length > 0) {
    const item = overdue[0];
    return `${petName}'s ${item.type} is ${Math.abs(item.daysUntil)} day${Math.abs(item.daysUntil) === 1 ? "" : "s"} overdue`;
  }
  if (lines.length === 1) {
    const item = lines[0];
    if (item.daysUntil === 0) return `${petName}'s ${item.type} is due today`;
    return `${petName}'s ${item.type} expires in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`;
  }
  return `${petName} has ${lines.length} vaccines coming due`;
}

// base64url: the token rides in a URL path segment (/api/unsubscribe/<token>)
// so it MUST be URL-safe. Standard base64 emits `/` and `+`; a `/` splits the
// path and the [token] segment never matches. Must stay byte-for-byte
// compatible with lib/reminders/unsubscribe-token.ts on the verifying side.
function b64url(s: string): string {
  return s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signUnsubToken(householdId: string): Promise<string> {
  const payload = { h: householdId, t: Date.now() };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64url(btoa(payloadJson));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(UNSUBSCRIBE_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // Sign over the URL-safe payload string so the verifier, which HMACs the
  // exact string it receives, reproduces the same digest.
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = b64url(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return `${payloadB64}.${sigB64}`;
}

// ============================================================
// Email rendering — minimal inline HTML, no React deps in the
// edge runtime to keep the bundle tiny.
// ============================================================

type EmailVars = {
  petName: string;
  lines: Array<{ type: string; expires: string; daysUntil: number }>;
  petUrl: string;
  unsubUrl: string;
  settingsUrl: string;
};

function renderHtml(v: EmailVars): string {
  const rows = v.lines
    .map((l) => {
      const dueLabel =
        l.daysUntil < 0
          ? `<span style="color:#862C28;font-weight:600;">Overdue by ${Math.abs(l.daysUntil)} day${Math.abs(l.daysUntil) === 1 ? "" : "s"}</span>`
          : l.daysUntil === 0
            ? `<span style="color:#74511A;font-weight:600;">Due today</span>`
            : l.daysUntil <= 14
              ? `<span style="color:#74511A;font-weight:600;">Due in ${l.daysUntil} day${l.daysUntil === 1 ? "" : "s"}</span>`
              : `Due in ${l.daysUntil} days`;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E8E4DA;">
            <div style="font:500 14px Inter,Helvetica,Arial,sans-serif;color:#14181B;">${escapeHtml(l.type)}</div>
            <div style="font:400 12px Inter,Helvetica,Arial,sans-serif;color:#6A7079;margin-top:2px;">expires ${escapeHtml(formatDate(l.expires))} · ${dueLabel}</div>
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#FAF9F6;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14181B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #E8E4DA;border-radius:14px;padding:28px;">
        <tr><td>
          <div style="display:inline-block;padding:6px 12px;background:#E2EDE5;color:#1F4E33;border-radius:999px;font:600 11px Inter,sans-serif;letter-spacing:0.04em;text-transform:uppercase;">Pawdex reminder</div>
          <h1 style="margin:14px 0 6px;font:500 24px Georgia,serif;color:#14181B;letter-spacing:-0.015em;">${escapeHtml(v.petName)} has ${v.lines.length} ${v.lines.length === 1 ? "vaccine" : "vaccines"} coming due</h1>
          <p style="margin:0;font:400 14px Inter,sans-serif;color:#404750;line-height:1.55;">A quick heads-up so nothing lapses. Schedule the visit (or update the dates if your vet already gave the booster) and we'll quiet down.</p>
          <table role="presentation" width="100%" style="margin:18px 0 8px;">
            ${rows}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
            <tr><td>
              <a href="${escapeHtml(v.petUrl)}" style="display:inline-block;background:#2F6F4E;color:#FFFFFF;padding:11px 18px;border-radius:8px;font:500 14px Inter,sans-serif;text-decoration:none;">Open ${escapeHtml(v.petName)}&rsquo;s vaccines &rarr;</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" style="max-width:560px;margin-top:18px;">
        <tr><td align="center" style="font:400 11.5px Inter,sans-serif;color:#95999F;line-height:1.6;">
          Sent by Pawdex on your behalf.<br/>
          <a href="${escapeHtml(v.settingsUrl)}" style="color:#6A7079;text-decoration:underline;">Manage reminder preferences</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(v.unsubUrl)}" style="color:#6A7079;text-decoration:underline;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderText(v: EmailVars): string {
  const lines = v.lines
    .map((l) => {
      const dueLabel =
        l.daysUntil < 0
          ? `OVERDUE by ${Math.abs(l.daysUntil)} day${Math.abs(l.daysUntil) === 1 ? "" : "s"}`
          : l.daysUntil === 0
            ? "due today"
            : `due in ${l.daysUntil} day${l.daysUntil === 1 ? "" : "s"}`;
      return `  • ${l.type} — expires ${formatDate(l.expires)} (${dueLabel})`;
    })
    .join("\n");
  return [
    `${v.petName} has ${v.lines.length} ${v.lines.length === 1 ? "vaccine" : "vaccines"} coming due:`,
    "",
    lines,
    "",
    `View vaccines: ${v.petUrl}`,
    "",
    "—",
    "Sent by Pawdex on your behalf.",
    `Manage preferences: ${v.settingsUrl}`,
    `Unsubscribe: ${v.unsubUrl}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
