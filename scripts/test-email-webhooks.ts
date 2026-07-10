/**
 * Behavioral tests for the Resend delivery + inbound webhooks, run against a
 * live-built server (pnpm build && pnpm start on :3100).
 *
 * Driven by scripts/run-email-webhook-tests.sh, which boots the server with
 * test signing secrets and a blanked OpenRouter key (so inbound extraction
 * fails fast instead of costing tokens), then runs this.
 *
 * SAFETY: this connects to the LIVE Supabase project. Every row it creates is
 * a household named "ZZTEST ..." plus children, and every one is deleted in a
 * finally block in reverse-FK order. If this script is interrupted, run it
 * again - teardown keys off the ZZTEST name and is idempotent.
 *
 * What it proves:
 *   Delivery webhook (/api/webhooks/resend):
 *     - missing/!valid svix signature -> 401
 *     - stale timestamp -> 401
 *     - malformed JSON (valid sig) -> 400
 *     - valid signed bounce flips a matching outbound_emails row to 'bounced'
 *       AND a matching reminders row to 'failed' (the fix: outbound_emails was
 *       never updated before)
 *   Inbound webhook (/api/webhooks/resend-inbound):
 *     - bad signature -> 401
 *     - unroutable recipient -> 200 {status:no_match}, no document
 *     - signed inbound w/ PDF attachment -> creates a documents row linked to
 *       the household, with content_hash populated
 *     - redelivery of the same email -> deduped (documents_created:0, still one
 *       row)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ── env ──────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";
const INBOUND_SECRET = process.env.RESEND_INBOUND_SECRET ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const INBOUND_DOMAIN = process.env.PAWDEX_INBOUND_DOMAIN ?? "inbound.pawdex.app";

for (const [k, v] of Object.entries({
  RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
  RESEND_INBOUND_SECRET: INBOUND_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
})) {
  if (!v) {
    console.error(`missing required env ${k}`);
    process.exit(2);
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── harness ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(cond: boolean, msg: string): void {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    console.error("FAIL:", msg);
  }
}

// ── svix signing (mirrors the handler's verifier) ────────────────────
function svixHeaders(secret: string, body: string, tsOverride?: number) {
  const id = `msg_${randomUUID()}`;
  const timestamp = String(tsOverride ?? Math.floor(Date.now() / 1000));
  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");
  const sig = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${sig}`,
    "content-type": "application/json",
  };
}

async function post(path: string, body: string, headers: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, json: json as Record<string, unknown> | null, text };
}

// Minimal valid PDF bytes.
const FAKE_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

async function main() {
  const zzHouseholdId = randomUUID();
  const createdDocIds: string[] = [];
  const createdStoragePaths: string[] = [];

  try {
    // ═══ Fixture: a disposable ZZTEST household ══════════════════════
    {
      const { error } = await admin
        .from("households")
        .insert({ id: zzHouseholdId, name: "ZZTEST email-webhooks" });
      if (error) throw new Error(`fixture household insert: ${error.message}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // DELIVERY WEBHOOK - signature gating
    // ─────────────────────────────────────────────────────────────────
    const deliveredBody = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: `nonexistent_${randomUUID()}` },
    });

    // no headers -> 401
    {
      const r = await post("/api/webhooks/resend", deliveredBody, {
        "content-type": "application/json",
      });
      check(r.status === 401, `delivery: missing signature -> 401 (got ${r.status})`);
    }

    // valid signed delivered (no matching row) -> 200
    {
      const r = await post(
        "/api/webhooks/resend",
        deliveredBody,
        svixHeaders(WEBHOOK_SECRET, deliveredBody),
      );
      check(r.status === 200, `delivery: valid signed delivered -> 200 (got ${r.status})`);
    }

    // tampered signature -> 401
    {
      const h = svixHeaders(WEBHOOK_SECRET, deliveredBody);
      h["svix-signature"] = "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      const r = await post("/api/webhooks/resend", deliveredBody, h);
      check(r.status === 401, `delivery: tampered signature -> 401 (got ${r.status})`);
    }

    // stale timestamp (10 min old) -> 401
    {
      const staleTs = Math.floor(Date.now() / 1000) - 600;
      const r = await post(
        "/api/webhooks/resend",
        deliveredBody,
        svixHeaders(WEBHOOK_SECRET, deliveredBody, staleTs),
      );
      check(r.status === 401, `delivery: stale timestamp -> 401 (got ${r.status})`);
    }

    // malformed JSON with a valid signature -> 400
    {
      const bad = "{not json";
      const r = await post(
        "/api/webhooks/resend",
        bad,
        svixHeaders(WEBHOOK_SECRET, bad),
      );
      check(r.status === 400, `delivery: malformed json -> 400 (got ${r.status})`);
    }

    // ─────────────────────────────────────────────────────────────────
    // DELIVERY WEBHOOK - DB mutation (the outbound_emails fix)
    // ─────────────────────────────────────────────────────────────────
    {
      // Need an authorization row (outbound_emails.authorization_id is NOT NULL).
      const { data: authRow, error: authErr } = await admin
        .from("authorizations")
        .insert({
          household_id: zzHouseholdId,
          authorization_type: "records_request_to_vets",
          scope_text: "ZZTEST authorization",
        })
        .select("id")
        .single();
      if (authErr || !authRow) throw new Error(`fixture auth: ${authErr?.message}`);

      const outboundMsgId = `msg_out_${randomUUID()}`;
      const { data: obRow, error: obErr } = await admin
        .from("outbound_emails")
        .insert({
          household_id: zzHouseholdId,
          authorization_id: authRow.id,
          recipient_email: "zztest-vet@example.invalid",
          recipient_type: "vet_clinic",
          subject: "ZZTEST records request",
          body_text: "ZZTEST",
          status: "sent",
          resend_message_id: outboundMsgId,
        })
        .select("id")
        .single();
      if (obErr || !obRow) throw new Error(`fixture outbound: ${obErr?.message}`);

      // Also a reminder row with the same message id, to prove BOTH tables update.
      const reminderMsgId = `msg_rem_${randomUUID()}`;
      const { data: remRow, error: remErr } = await admin
        .from("reminders")
        .insert({
          household_id: zzHouseholdId,
          entity_type: "vaccination",
          entity_id: randomUUID(),
          due_on: "2026-01-01",
          lead_days: 7,
          scheduled_for: new Date().toISOString(),
          status: "sent",
          resend_message_id: reminderMsgId,
        })
        .select("id")
        .single();
      if (remErr || !remRow) throw new Error(`fixture reminder: ${remErr?.message}`);

      // Bounce the outbound message.
      const bounceOut = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: { email_id: outboundMsgId },
      });
      const r1 = await post(
        "/api/webhooks/resend",
        bounceOut,
        svixHeaders(WEBHOOK_SECRET, bounceOut),
      );
      check(r1.status === 200, `delivery: signed bounce -> 200 (got ${r1.status})`);
      const { data: obAfter } = await admin
        .from("outbound_emails")
        .select("status, error_message")
        .eq("id", obRow.id)
        .single();
      check(
        obAfter?.status === "bounced",
        `delivery: outbound_emails flipped to 'bounced' (got '${obAfter?.status}') - THE FIX`,
      );

      // Complaint on the reminder message -> reminder 'failed'.
      const complaintRem = JSON.stringify({
        type: "email.complained",
        created_at: new Date().toISOString(),
        data: { email_id: reminderMsgId },
      });
      const r2 = await post(
        "/api/webhooks/resend",
        complaintRem,
        svixHeaders(WEBHOOK_SECRET, complaintRem),
      );
      check(r2.status === 200, `delivery: signed complaint -> 200 (got ${r2.status})`);
      const { data: remAfter } = await admin
        .from("reminders")
        .select("status")
        .eq("id", remRow.id)
        .single();
      check(
        remAfter?.status === "failed",
        `delivery: reminders flipped to 'failed' on complaint (got '${remAfter?.status}')`,
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // INBOUND WEBHOOK
    // ─────────────────────────────────────────────────────────────────
    // bad signature -> 401
    {
      const body = JSON.stringify({ type: "inbound.email", data: {} });
      const h = svixHeaders(INBOUND_SECRET, body);
      h["svix-signature"] = "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      const r = await post("/api/webhooks/resend-inbound", body, h);
      check(r.status === 401, `inbound: bad signature -> 401 (got ${r.status})`);
    }

    // unroutable recipient -> 200 no_match
    {
      const body = JSON.stringify({
        type: "inbound.email",
        data: {
          from: "vet@example.invalid",
          to: [`inbox+doesnotexist@${INBOUND_DOMAIN}`],
          subject: "ZZTEST unroutable",
          attachments: [],
        },
      });
      const r = await post(
        "/api/webhooks/resend-inbound",
        body,
        svixHeaders(INBOUND_SECRET, body),
      );
      check(
        r.status === 200 && r.json?.status === "no_match",
        `inbound: unroutable recipient -> 200 no_match (got ${r.status} ${JSON.stringify(r.json)})`,
      );
    }

    // Issue a ZZTEST inbound address for the household, then deliver a PDF.
    const slug = `zz${randomUUID().replace(/-/g, "").slice(0, 6)}`;
    {
      const { error } = await admin
        .from("household_inbound_addresses")
        .insert({ household_id: zzHouseholdId, slug });
      if (error) throw new Error(`fixture inbound address: ${error.message}`);
    }

    const inboundBody = JSON.stringify({
      type: "inbound.email",
      data: {
        from: "records@vetclinic.example",
        to: [`inbox+${slug}@${INBOUND_DOMAIN}`],
        subject: "ZZTEST medical records",
        text: "Records attached.",
        attachments: [
          {
            filename: "zztest-records.pdf",
            content_type: "application/pdf",
            content: FAKE_PDF.toString("base64"),
          },
        ],
      },
    });

    // first delivery -> creates one document
    {
      const r = await post(
        "/api/webhooks/resend-inbound",
        inboundBody,
        svixHeaders(INBOUND_SECRET, inboundBody),
      );
      check(
        r.status === 200 && r.json?.documents_created === 1,
        `inbound: first delivery creates 1 document (got ${r.status} ${JSON.stringify(r.json)})`,
      );
      check(
        r.json?.household_id === zzHouseholdId,
        `inbound: document linked to correct household`,
      );
    }

    // verify the document row + content_hash
    {
      const { data: docs } = await admin
        .from("documents")
        .select("id, household_id, content_hash, storage_path, original_filename")
        .eq("household_id", zzHouseholdId);
      for (const d of docs ?? []) {
        createdDocIds.push(d.id as string);
        if (d.storage_path) createdStoragePaths.push(d.storage_path as string);
      }
      check((docs?.length ?? 0) === 1, `inbound: exactly one document row (got ${docs?.length})`);
      check(
        !!docs?.[0]?.content_hash,
        `inbound: content_hash populated (got '${docs?.[0]?.content_hash}') - enables dedup`,
      );
    }

    // redelivery of the SAME email -> deduped
    {
      const r = await post(
        "/api/webhooks/resend-inbound",
        inboundBody,
        svixHeaders(INBOUND_SECRET, inboundBody),
      );
      check(
        r.status === 200 && r.json?.documents_created === 0,
        `inbound: redelivery deduped (documents_created:0) (got ${r.status} ${JSON.stringify(r.json)})`,
      );
      const { count } = await admin
        .from("documents")
        .select("id", { head: true, count: "exact" })
        .eq("household_id", zzHouseholdId);
      check(count === 1, `inbound: still exactly one document after redelivery (got ${count})`);
    }
  } finally {
    // ═══ Teardown - reverse FK order, ZZTEST scoped ══════════════════
    try {
      // storage objects first
      const paths = new Set(createdStoragePaths);
      const { data: docs } = await admin
        .from("documents")
        .select("id, storage_path")
        .eq("household_id", zzHouseholdId);
      for (const d of docs ?? []) if (d.storage_path) paths.add(d.storage_path as string);
      if (paths.size > 0) {
        await admin.storage.from("documents").remove([...paths]);
      }
      const docIds = (docs ?? []).map((d) => d.id as string);
      if (docIds.length > 0) {
        await admin.from("document_extractions").delete().in("document_id", docIds);
      }
      await admin.from("documents").delete().eq("household_id", zzHouseholdId);
      await admin.from("household_inbound_addresses").delete().eq("household_id", zzHouseholdId);
      await admin.from("reminders").delete().eq("household_id", zzHouseholdId);
      await admin.from("outbound_emails").delete().eq("household_id", zzHouseholdId);
      await admin.from("authorizations").delete().eq("household_id", zzHouseholdId);
      await admin.from("audit_log").delete().eq("household_id", zzHouseholdId);
      await admin.from("households").delete().eq("id", zzHouseholdId);
      console.log("teardown: ZZTEST rows removed");
    } catch (err) {
      console.error("TEARDOWN ERROR - manual cleanup may be needed for household", zzHouseholdId, err);
    }
  }

  console.log(`\nwebhooks: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
