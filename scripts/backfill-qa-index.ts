/**
 * Backfill the doc Q&A index for extractions committed before embeddings were
 * working.
 *
 * Doc Q&A indexing never ran in production: it required OPENAI_API_KEY, which
 * was never set, so `indexExtractionForQa` bailed on every commit. Now that
 * embeddings route through OpenRouter (the key that IS set), new commits index
 * themselves. Already-committed documents have no chunks and stay invisible to
 * Ask until this runs.
 *
 *   Dry run:  pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/backfill-qa-index.ts
 *   Execute:  pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/backfill-qa-index.ts --execute
 *
 * SAFETY
 *   - Dry run is the default and touches nothing.
 *   - Only writes to extraction_chunks. Never modifies documents, extractions,
 *     or any clinical record.
 *   - Idempotent: indexExtractionForQa deletes prior chunks for the same
 *     (household, document) before inserting, so a re-run replaces rather than
 *     duplicates. Extractions that already have chunks are skipped by default
 *     so a re-run doesn't re-spend on embeddings; pass --force to reindex.
 *   - Sequential with a small delay, to stay clear of embedding rate limits.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

const EXECUTE = process.argv.includes("--execute");
const FORCE = process.argv.includes("--force");

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { indexExtractionForQa } = await import("../lib/ai/extraction-indexer");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // pet_id lives on documents, not on the extraction row, so join through it.
  const { data: rows, error } = await sb
    .from("document_extractions")
    .select("id, household_id, document_id, raw_response, documents!inner(pet_id)")
    .eq("status", "committed")
    .order("extracted_at", { ascending: true });
  if (error) throw new Error(`query failed: ${error.message}`);

  type Row = {
    id: string;
    household_id: string;
    document_id: string;
    raw_response: unknown;
    documents: { pet_id: string | null } | { pet_id: string | null }[];
  };
  const candidates = ((rows ?? []) as Row[]).map((r) => ({
    id: r.id,
    household_id: r.household_id,
    document_id: r.document_id,
    raw_response: r.raw_response,
    pet_id: (Array.isArray(r.documents) ? r.documents[0]?.pet_id : r.documents?.pet_id) ?? null,
  }));
  console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${candidates.length} committed extraction(s)\n`);

  let indexed = 0,
    skipped = 0,
    failed = 0,
    chunksTotal = 0;

  for (const row of candidates) {
    const label = `doc=${row.document_id.slice(0, 8)} ext=${row.id.slice(0, 8)}`;

    if (!row.raw_response) {
      console.log(`  SKIP  ${label} — no raw_response`);
      skipped++;
      continue;
    }
    if (!row.pet_id) {
      console.log(`  SKIP  ${label} — no pet_id`);
      skipped++;
      continue;
    }

    const { count: existing } = await sb
      .from("extraction_chunks")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", row.household_id)
      .eq("document_id", row.document_id);
    if ((existing ?? 0) > 0 && !FORCE) {
      console.log(`  SKIP  ${label} — already has ${existing} chunk(s), pass --force to reindex`);
      skipped++;
      continue;
    }

    if (!EXECUTE) {
      console.log(`  WOULD INDEX  ${label}`);
      indexed++;
      continue;
    }

    try {
      const { chunks_written } = await indexExtractionForQa({
        householdId: row.household_id,
        documentId: row.document_id,
        extractionId: row.id,
        petId: row.pet_id,
        rawResponse: row.raw_response as never,
      });
      if (chunks_written === 0) {
        console.log(`  WARN  ${label} — wrote 0 chunks`);
        failed++;
      } else {
        console.log(`  OK    ${label} — ${chunks_written} chunk(s)`);
        indexed++;
        chunksTotal += chunks_written;
      }
    } catch (err) {
      console.log(`  FAIL  ${label} — ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(
    `\n${EXECUTE ? "indexed" : "would index"}: ${indexed}  skipped: ${skipped}  failed: ${failed}` +
      (EXECUTE ? `  chunks written: ${chunksTotal}` : ""),
  );
  if (!EXECUTE && indexed > 0) {
    console.log("\nRe-run with --execute to write.");
  }
  process.exit(failed > 0 ? 1 : 0);
}

void main();
