/**
 * Behavioral test for the Stripe subscription webhook
 * (/api/webhooks/stripe), run against a live-built server on :3110.
 *
 * Driven by scripts/run-billing-webhook-tests.sh, which boots the server with a
 * fake STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (Phase 2), and also asserts the
 * fail-closed 503 when those keys are absent (Phase 1) before this runs.
 *
 * SAFETY: connects to the LIVE Supabase project. Every row it creates is a
 * household named "zztest-billing ..." plus its billing children, and every one
 * is deleted in a finally block. Teardown keys off the household id and cascades;
 * safe to re-run if interrupted.
 *
 * What it proves (Phase 2, keys present):
 *   - POST with no stripe-signature header -> 400
 *   - POST with a bad signature -> 400
 *   - a validly-signed customer.subscription.updated event upserts a
 *     subscriptions row (plan+status) AND sets households.plan to match
 *   - redelivery of the same event is idempotent (still one row)
 *
 * Usage (via the shell runner):
 *   bash scripts/run-billing-webhook-tests.sh
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3110";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

for (const [k, v] of Object.entries({
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
})) {
  if (!v) {
    console.error(`missing required env ${k}`);
    process.exit(2);
  }
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A dummy key is fine, generateTestHeaderString only uses the secret, not the
// key, and we never call the Stripe API here.
const stripe = new Stripe("sk_test_dummy_for_signing");

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL  ${msg}`);
  }
}

const WEBHOOK_URL = `${BASE}/api/webhooks/stripe`;

// Build a customer.subscription.updated event whose subscription object carries
// exactly the fields the handler reads. This path never calls the Stripe API.
function buildSubscriptionEvent(opts: {
  subscriptionId: string;
  customerId: string;
  plan: string;
  status: string;
  periodEndEpoch: number;
}) {
  return {
    id: `evt_${randomUUID().replace(/-/g, "")}`,
    object: "event",
    type: "customer.subscription.updated",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: opts.subscriptionId,
        object: "subscription",
        customer: opts.customerId,
        status: opts.status,
        cancel_at_period_end: false,
        current_period_end: opts.periodEndEpoch,
        metadata: { plan: opts.plan },
        items: {
          object: "list",
          data: [
            {
              id: `si_${randomUUID().replace(/-/g, "")}`,
              object: "subscription_item",
              current_period_end: opts.periodEndEpoch,
              price: {
                id: `price_${randomUUID().replace(/-/g, "")}`,
                object: "price",
                lookup_key: `${opts.plan}_monthly`,
                nickname: null,
              },
            },
          ],
        },
      },
    },
  };
}

async function postSigned(payloadObj: unknown, secret: string) {
  const payload = JSON.stringify(payloadObj);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

async function main() {
  // ── signature-verification checks (no schema needed) ──────────────
  // These prove the security boundary regardless of whether migration 0031 has
  // been applied to the DB yet.

  // 1. no signature -> 400
  {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    assert(res.status === 400, `no signature -> 400 (got ${res.status})`);
  }

  // 2. bad signature -> 400
  {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef",
      },
      body: JSON.stringify({ hello: "world" }),
    });
    assert(res.status === 400, `bad signature -> 400 (got ${res.status})`);
  }

  // ── DB-upsert checks, require the 0031 schema to be applied to the linked
  // DB. Migration 0031 is intentionally NOT pushed by this agent (the
  // integration agent owns applying it), so probe for the column and skip the
  // DB assertions cleanly when it isn't there yet. Re-running this test after
  // 0031 lands exercises the full path. We never apply schema from a test.
  const probe = await sb.from("households").select("plan").limit(1);
  const schemaReady = !probe.error;

  if (!schemaReady) {
    console.log(
      "\n  SKIP  DB-upsert assertions, households.plan not present yet.\n" +
        "        Apply migration 0031_billing.sql to the linked DB, then re-run\n" +
        "        this test to prove the subscription upsert + plan reconciliation.",
    );
    console.log(`\nbilling webhook: ${passed} passed, ${failed} failed (DB assertions skipped)`);
    process.exit(failed > 0 ? 1 : 0);
  }

  // ── fixtures (schema present) ─────────────────────────────────────
  const householdName = `zztest-billing ${randomUUID().slice(0, 8)}`;
  const customerId = `zztest-billing-cus-${randomUUID().slice(0, 12)}`;
  const subscriptionId = `zztest-billing-sub-${randomUUID().slice(0, 12)}`;
  const periodEndEpoch = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

  const { data: household, error: hErr } = await sb
    .from("households")
    .insert({ name: householdName })
    .select("id, plan")
    .single();
  if (hErr || !household) {
    console.error(`could not create test household: ${hErr?.message}`);
    process.exit(2);
  }
  const householdId = household.id;
  assert(
    household.plan === "early_access",
    "new household defaults to early_access plan",
  );

  try {
    // Map the Stripe customer to our test household so the webhook's reverse
    // lookup can attribute the subscription.
    await sb
      .from("billing_customers")
      .insert({ household_id: householdId, stripe_customer_id: customerId });

    // 3. valid signed subscription.updated -> upsert + plan set
    const event = buildSubscriptionEvent({
      subscriptionId,
      customerId,
      plan: "household",
      status: "active",
      periodEndEpoch,
    });
    {
      const res = await postSigned(event, WEBHOOK_SECRET);
      const body = await res.json().catch(() => ({}));
      assert(res.status === 200, `valid event -> 200 (got ${res.status})`);
      assert(body?.received === true, "valid event -> {received:true}");

      const { data: subs } = await sb
        .from("subscriptions")
        .select("stripe_subscription_id, plan, status, cancel_at_period_end")
        .eq("household_id", householdId);
      assert((subs?.length ?? 0) === 1, `one subscription row (got ${subs?.length ?? 0})`);
      assert(subs?.[0]?.plan === "household", "subscription plan = household");
      assert(subs?.[0]?.status === "active", "subscription status = active");
      assert(
        subs?.[0]?.stripe_subscription_id === subscriptionId,
        "subscription id persisted",
      );

      const { data: hh } = await sb
        .from("households")
        .select("plan")
        .eq("id", householdId)
        .single();
      assert(hh?.plan === "household", `household.plan reconciled to household (got ${hh?.plan})`);
    }

    // 4. redelivery is idempotent
    {
      const res = await postSigned(event, WEBHOOK_SECRET);
      assert(res.status === 200, `redelivery -> 200 (got ${res.status})`);
      const { data: subs } = await sb
        .from("subscriptions")
        .select("id")
        .eq("household_id", householdId);
      assert(
        (subs?.length ?? 0) === 1,
        `redelivery stays idempotent, one row (got ${subs?.length ?? 0})`,
      );
    }
  } finally {
    // Cascade cleanup: deleting the household removes billing_customers +
    // subscriptions via ON DELETE CASCADE. Explicit child deletes too, in case
    // a constraint ever changes.
    await sb.from("subscriptions").delete().eq("household_id", householdId);
    await sb.from("billing_customers").delete().eq("household_id", householdId);
    await sb.from("households").delete().eq("id", householdId);
    console.log("  cleanup: removed zztest-billing household + billing rows");
  }

  console.log(`\nbilling webhook: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
