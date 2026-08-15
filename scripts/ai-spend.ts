/**
 * AI spend report. Read-only.
 *
 *   pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ai-spend.ts [days]
 *
 * Defaults to the last 30 days. Answers the questions that decide whether the
 * unit economics work:
 *   - what are we spending, and on what
 *   - what does one document actually cost to process
 *   - how often does tier 1 escalate to tier 3 (Sonnet), which is where the
 *     money goes
 *   - which household is the heaviest user
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

type Row = {
  feature: string;
  tier: number | null;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_microusd: number | null;
  latency_ms: number | null;
  ok: boolean;
  household_id: string | null;
  document_id: string | null;
};

const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(4)}`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const padL = (s: string | number, n: number) => String(s).padStart(n);

async function main() {
  const days = Number.parseInt(process.argv[2] ?? "30", 10) || 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await sb
    .from("ai_usage")
    .select(
      "feature, tier, model, input_tokens, output_tokens, total_tokens, cost_microusd, latency_ms, ok, household_id, document_id",
    )
    .gte("created_at", since)
    .limit(50_000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  console.log(`\nAI spend, last ${days} day(s) — ${rows.length} call(s)\n`);
  if (rows.length === 0) {
    console.log("  No usage recorded yet.\n");
    return;
  }

  const sum = (f: (r: Row) => number | null | undefined) =>
    rows.reduce((a, r) => a + (f(r) ?? 0), 0);

  const totalCost = sum((r) => r.cost_microusd);
  const totalTokens = sum((r) => r.total_tokens);
  const failed = rows.filter((r) => !r.ok).length;
  const missingCost = rows.filter((r) => r.cost_microusd == null).length;

  console.log(`  total cost      ${usd(totalCost)}`);
  console.log(`  total tokens    ${totalTokens.toLocaleString()}`);
  console.log(`  failed calls    ${failed}${failed ? "  (still billed if the model ran)" : ""}`);
  if (missingCost) {
    console.log(`  no cost data    ${missingCost} call(s) — provider didn't report one`);
  }

  // ── by feature ──────────────────────────────────────────────────────────
  console.log(`\n  ${pad("feature", 12)}${padL("calls", 7)}${padL("tokens", 12)}${padL("cost", 12)}${padL("avg", 11)}`);
  console.log(`  ${"-".repeat(53)}`);
  const byFeature = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byFeature.get(r.feature) ?? [];
    list.push(r);
    byFeature.set(r.feature, list);
  }
  for (const [feature, list] of [...byFeature.entries()].sort(
    (a, b) =>
      b[1].reduce((s, r) => s + (r.cost_microusd ?? 0), 0) -
      a[1].reduce((s, r) => s + (r.cost_microusd ?? 0), 0),
  )) {
    const cost = list.reduce((s, r) => s + (r.cost_microusd ?? 0), 0);
    const toks = list.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
    console.log(
      `  ${pad(feature, 12)}${padL(list.length, 7)}${padL(toks.toLocaleString(), 12)}${padL(usd(cost), 12)}${padL(usd(cost / list.length), 11)}`,
    );
  }

  // ── extraction ladder ───────────────────────────────────────────────────
  const extract = rows.filter((r) => r.feature === "extract");
  if (extract.length > 0) {
    console.log(`\n  extraction ladder`);
    for (const tier of [1, 2, 3]) {
      const t = extract.filter((r) => r.tier === tier);
      if (t.length === 0) continue;
      const cost = t.reduce((s, r) => s + (r.cost_microusd ?? 0), 0);
      const share = ((t.length / extract.length) * 100).toFixed(0);
      console.log(
        `    tier ${tier}  ${padL(t.length, 5)} call(s)  ${padL(`${share}%`, 5)}  ${padL(usd(cost), 11)}  ${t[0].model}`,
      );
    }
    const docs = new Set(extract.map((r) => r.document_id).filter(Boolean));
    if (docs.size > 0) {
      const cost = extract.reduce((s, r) => s + (r.cost_microusd ?? 0), 0);
      console.log(
        `\n    ${docs.size} document(s) processed — ${usd(cost / docs.size)} per document, ${(extract.length / docs.size).toFixed(2)} model call(s) each`,
      );
    }
  }

  // ── heaviest households ─────────────────────────────────────────────────
  const byHousehold = new Map<string, number>();
  for (const r of rows) {
    if (!r.household_id) continue;
    byHousehold.set(r.household_id, (byHousehold.get(r.household_id) ?? 0) + (r.cost_microusd ?? 0));
  }
  if (byHousehold.size > 0) {
    console.log(`\n  top households by spend`);
    for (const [id, cost] of [...byHousehold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ${id.slice(0, 8)}…  ${padL(usd(cost), 11)}`);
    }
  }

  console.log("");
}

void main();
