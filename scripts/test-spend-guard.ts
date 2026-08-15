/**
 * Behavioral test for the AI extraction spend ceiling (lib/ai/spend-guard.ts).
 *
 * The guard counts rows in document_extractions, so this seeds real rows in a
 * throwaway ZZTEST household and walks the boundary: under the cap allows, at
 * the cap blocks, and one household's usage never blocks another. Also asserts
 * the fail-open behaviour, because a guard that fails closed would turn a
 * transient DB error into a total ingestion outage.
 *
 * Run: pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-spend-guard.ts
 *
 * SAFETY: every row is scoped to ZZTEST households created here and removed in
 * the finally block. No LLM calls — this exercises the counter, not extraction.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

// Small caps so the test seeds 5 rows instead of 50. Set before the module is
// imported, since limits are read per call from env.
process.env.PAWDEX_MAX_EXTRACTIONS_PER_HOUSEHOLD_PER_DAY = "5";
process.env.PAWDEX_MAX_EXTRACTIONS_PER_DAY = "100000";

let pass = 0;
let fail = 0;
function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { checkExtractionBudget, extractionLimits } = await import("../lib/ai/spend-guard");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const households: string[] = [];

  async function makeHousehold(name: string) {
    const { data: hh, error } = await sb
      .from("households")
      .insert({ name })
      .select("id")
      .single();
    if (error) throw new Error(`household insert: ${error.message}`);
    households.push(hh.id);
    const { data: pet } = await sb
      .from("pets")
      .insert({ household_id: hh.id, name: "ZZTEST SG", species: "dog" })
      .select("id")
      .single();
    const { data: doc } = await sb
      .from("documents")
      .insert({
        household_id: hh.id,
        pet_id: pet!.id,
        storage_path: `zztest/${hh.id}/sg.pdf`,
        doc_type: "vaccine_certificate",
        processing_status: "pending",
      })
      .select("id")
      .single();
    return { householdId: hh.id as string, documentId: doc!.id as string };
  }

  async function seedExtractions(householdId: string, documentId: string, n: number) {
    if (n === 0) return;
    const rows = Array.from({ length: n }, () => ({
      document_id: documentId,
      household_id: householdId,
      model: "zztest",
      prompt_version: "zztest",
      raw_response: {},
      status: "pending_review" as const,
    }));
    const { error } = await sb.from("document_extractions").insert(rows);
    if (error) throw new Error(`extraction seed: ${error.message}`);
  }

  try {
    const limits = extractionLimits();
    console.log(`limits in force: household=${limits.perHousehold}/day global=${limits.global}/day\n`);
    assert("env override applied to household cap", limits.perHousehold === 5, `got ${limits.perHousehold}`);

    console.log("\n(1) a fresh household is allowed");
    const a = await makeHousehold("ZZTEST spend-guard A");
    let v = await checkExtractionBudget({ householdId: a.householdId });
    assert("allowed at 0 used", v.allowed === true, `used=${v.used}`);
    assert("reports zero used", v.used === 0);

    console.log("\n(2) still allowed just under the cap");
    await seedExtractions(a.householdId, a.documentId, 4);
    v = await checkExtractionBudget({ householdId: a.householdId });
    assert("allowed at 4 of 5", v.allowed === true, `used=${v.used}`);
    assert("counts the seeded rows", v.used === 4, `used=${v.used}`);

    console.log("\n(3) blocked at the cap");
    await seedExtractions(a.householdId, a.documentId, 1);
    v = await checkExtractionBudget({ householdId: a.householdId });
    assert("blocked at 5 of 5", v.allowed === false, `used=${v.used}`);
    assert("scope is household", v.scope === "household", String(v.scope));
    assert("carries a user-safe message", typeof v.message === "string" && v.message.length > 0);
    assert(
      "message reassures nothing was lost",
      /nothing was lost/i.test(v.message ?? ""),
      v.message?.slice(0, 60),
    );
    assert(
      "message does not leak internals",
      !/global|platform-wide|openrouter|sonnet/i.test(v.message ?? ""),
    );

    console.log("\n(4) one household's usage does not block another");
    const b = await makeHousehold("ZZTEST spend-guard B");
    v = await checkExtractionBudget({ householdId: b.householdId });
    assert("second household still allowed", v.allowed === true, `used=${v.used}`);
    assert("second household counted independently", v.used === 0, `used=${v.used}`);

    console.log("\n(5) fails OPEN when counting breaks");
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unreachable.invalid";
    let openVerdict;
    try {
      openVerdict = await checkExtractionBudget({ householdId: a.householdId });
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    }
    assert(
      "a broken counter allows the extraction through",
      openVerdict?.allowed === true,
      `allowed=${openVerdict?.allowed}`,
    );

    console.log("\n(6) the global ceiling is independently configurable");
    process.env.PAWDEX_MAX_EXTRACTIONS_PER_DAY = "1";
    process.env.PAWDEX_MAX_EXTRACTIONS_PER_HOUSEHOLD_PER_DAY = "100000";
    v = await checkExtractionBudget({ householdId: b.householdId });
    assert("global cap blocks even a fresh household", v.allowed === false, `used=${v.used}`);
    assert("scope is global", v.scope === "global", String(v.scope));
    assert(
      "global message stays vague to the user",
      /temporarily paused/i.test(v.message ?? ""),
      v.message?.slice(0, 50),
    );
  } finally {
    for (const id of households) {
      await sb.from("document_extractions").delete().eq("household_id", id);
      await sb.from("households").delete().eq("id", id);
    }
    console.log(`\ncleanup: ${households.length} ZZTEST household(s) removed`);
  }

  console.log(`\nspend guard: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
