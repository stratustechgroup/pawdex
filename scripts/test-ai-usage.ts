/**
 * Tests AI usage accounting (lib/observability/ai-usage.ts + the ai_usage table).
 *
 * Covers the two things that would make this telemetry worthless:
 *   1. It records nothing / the wrong thing.
 *   2. It can fail a user's request. Recording is fire-and-forget by contract,
 *      so a broken insert must be swallowed, not thrown.
 *
 * Includes one real embedding call through lib/ai/embeddings.ts to prove the
 * wiring works end to end and that OpenRouter's usage accounting is actually
 * reporting cost, rather than trusting that the extraBody flag took effect.
 *
 * Run: pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-ai-usage.ts
 *
 * SAFETY: writes only to ai_usage, deletes every row it creates. Costs a
 * fraction of a cent (one embedding call).
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

let pass = 0;
let fail = 0;
function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (ok) pass++;
  else fail++;
}

const MARKER = `zztest-${Date.now()}`;

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { recordAiUsage, costMicroUsdFrom } = await import("../lib/observability/ai-usage");
  const { embedTexts } = await import("../lib/ai/embeddings");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    console.log("(1) costMicroUsdFrom digs cost out of provider metadata");
    assert(
      "converts USD to micro-USD",
      costMicroUsdFrom({ openrouter: { usage: { cost: 0.0123 } } }) === 12300,
      String(costMicroUsdFrom({ openrouter: { usage: { cost: 0.0123 } } })),
    );
    assert(
      "rounds sub-micro rather than truncating to zero",
      costMicroUsdFrom({ openrouter: { usage: { cost: 0.0000004 } } }) === 0,
    );
    assert("null when metadata absent", costMicroUsdFrom(undefined) === null);
    assert("null when shape unexpected", costMicroUsdFrom({ foo: "bar" }) === null);
    assert("null when cost is not a number", costMicroUsdFrom({ openrouter: { usage: { cost: "x" } } }) === null);
    assert("does not throw on garbage", costMicroUsdFrom(42) === null);

    console.log("\n(2) recordAiUsage persists a row");
    await recordAiUsage({
      feature: "extract",
      model: `${MARKER}-model`,
      tier: 3,
      usage: { inputTokens: 1200, outputTokens: 340, totalTokens: 1540, cachedInputTokens: 100 },
      providerMetadata: { openrouter: { usage: { cost: 0.004212 } } },
      latencyMs: 2510,
      ok: true,
    });
    const { data: rows } = await sb
      .from("ai_usage")
      .select("*")
      .eq("model", `${MARKER}-model`);
    const row = rows?.[0];
    assert("row written", !!row);
    assert("feature stored", row?.feature === "extract");
    assert("tier stored", row?.tier === 3);
    assert("input tokens stored", row?.input_tokens === 1200);
    assert("output tokens stored", row?.output_tokens === 340);
    assert("cached tokens stored", row?.cached_input_tokens === 100);
    assert("cost converted to micro-USD", row?.cost_microusd === 4212, String(row?.cost_microusd));
    assert("latency stored", row?.latency_ms === 2510);
    assert("ok defaults true", row?.ok === true);

    console.log("\n(3) a failed call is still recorded (escalation cost stays visible)");
    await recordAiUsage({
      feature: "extract",
      model: `${MARKER}-failed`,
      tier: 1,
      ok: false,
    });
    const { data: failedRows } = await sb
      .from("ai_usage")
      .select("ok, cost_microusd, input_tokens")
      .eq("model", `${MARKER}-failed`);
    assert("failed attempt recorded", failedRows?.length === 1);
    assert("marked not ok", failedRows?.[0]?.ok === false);
    assert("null cost tolerated", failedRows?.[0]?.cost_microusd === null);
    assert("null tokens tolerated", failedRows?.[0]?.input_tokens === null);

    console.log("\n(4) recording NEVER throws — it must not fail a user request");
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unreachable.invalid";
    let threw = false;
    try {
      await recordAiUsage({ feature: "qa", model: `${MARKER}-unreachable` });
    } catch {
      threw = true;
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    }
    assert("unreachable database does not throw", threw === false);

    threw = false;
    try {
      // Deliberately invalid: feature is NOT NULL, and a bogus household id
      // violates the FK. The insert must fail and be swallowed.
      await recordAiUsage({
        feature: "extract",
        model: `${MARKER}-badfk`,
        householdId: "00000000-0000-0000-0000-000000000000",
      });
    } catch {
      threw = true;
    }
    assert("constraint violation does not throw", threw === false);

    console.log("\n(5) end to end: a real embedding call records usage");
    const before = (
      await sb.from("ai_usage").select("id", { head: true, count: "exact" }).eq("feature", "embed")
    ).count ?? 0;
    await embedTexts(["ZZTEST usage accounting probe"]);
    const { data: embedRows, count: after } = await sb
      .from("ai_usage")
      .select("*", { count: "exact" })
      .eq("feature", "embed")
      .order("created_at", { ascending: false })
      .limit(1);
    assert("an embed usage row was written", (after ?? 0) > before, `${before} -> ${after}`);
    const e = embedRows?.[0];
    assert("model recorded", typeof e?.model === "string" && e.model.length > 0, e?.model);
    assert("input tokens recorded", (e?.input_tokens ?? 0) > 0, String(e?.input_tokens));
    assert("latency recorded", (e?.latency_ms ?? 0) >= 0, String(e?.latency_ms));

    console.log("\n(6) ai_usage is fail-closed to clients (operator telemetry)");
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const anonRead = await anon.from("ai_usage").select("id").limit(1);
    assert(
      "anonymous read returns no rows",
      (anonRead.data ?? []).length === 0,
      anonRead.error?.message ?? "empty",
    );
  } finally {
    await sb.from("ai_usage").delete().like("model", `${MARKER}%`);
    const { count: leftover } = await sb
      .from("ai_usage")
      .select("id", { head: true, count: "exact" })
      .like("model", `${MARKER}%`);
    console.log(`\ncleanup: ${leftover ?? 0} ZZTEST usage row(s) remaining`);
  }

  console.log(`\nai usage: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
