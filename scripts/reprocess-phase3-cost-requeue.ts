/**
 * PHASE 3 - cost re-extraction queue.
 *
 * The founder's documents were all committed by a pre-v7.1 prompt that threw
 * the billing block away (invoice_items is empty). This re-runs the REAL
 * ingestion pipeline (the same processDocumentExtraction a fresh upload uses -
 * NOT forceTier3, so oversized phone-photo receipts cap at tier 2 rather than
 * hard-failing) on each committed document. Each run inserts a FRESH
 * pending_review extraction and flips the document to 'extracted', landing it
 * in the founder's normal review screen. The committed rows are untouched;
 * same-visit dedup will pre-skip existing records so only NEW invoice line
 * items surface. Nothing is auto-committed.
 *
 *   Dry run:  pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env.local scripts/reprocess-phase3-cost-requeue.ts
 *   Execute:  pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env.local scripts/reprocess-phase3-cost-requeue.ts --execute
 *
 * Idempotent: a document that already has an extraction at the current prompt
 * version (v7.1.0) is skipped, so a re-run never re-spends on it.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { processDocumentExtraction } from "@/lib/ai/extraction-trigger";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/ai/prompts/v1";

import {
  HOUSEHOLD_ID,
  SCRATCHPAD,
  auditInsert,
  banner,
  getActorId,
  isExecute,
  makeDb,
} from "./reprocess-common";

const QUEUE_CAP = 40;

// Approximate OpenRouter list prices ($ per 1M tokens) for the spend estimate
// ONLY. Not billing-accurate - a conservative order-of-magnitude guide.
const PRICE = {
  tier1_in: 0.1, tier1_out: 0.4, // gemini-2.5-flash-lite
  tier2_in: 0.3, tier2_out: 2.5, // gemini-2.5-flash
  tier3_in: 3.0, tier3_out: 15.0, // claude-sonnet-4.5
};

function estInputTokens(mime: string | null, bytes: number): number {
  // Rough: images ~1.5k vision tokens; PDFs ~ text-layer heavy, scale with size.
  if ((mime ?? "").startsWith("image/")) return 1500;
  if (mime === "application/pdf") return Math.min(20000, Math.max(2000, Math.round(bytes / 1024 / 3)));
  return 3000;
}

async function main(): Promise<void> {
  banner("PHASE 3 · cost re-extraction queue");
  const db = makeDb();
  const actorId = await getActorId(db);

  const { data: docs, error } = await db.from("documents")
    .select("id, doc_type, processing_status, mime_type, byte_size, original_filename")
    .eq("household_id", HOUSEHOLD_ID)
    .order("uploaded_at");
  if (error) throw new Error(`fetch docs: ${error.message}`);

  const { data: exts } = await db.from("document_extractions")
    .select("document_id, prompt_version, status").eq("household_id", HOUSEHOLD_ID);
  const currentByDoc = new Map<string, boolean>();
  for (const e of exts ?? []) {
    if (e.prompt_version === EXTRACTION_PROMPT_VERSION) currentByDoc.set(e.document_id, true);
  }

  // Queue = confirmed documents without an extraction at the current prompt
  // version. All 23 of the founder's docs are doc_type 'unknown' (classification
  // never populated) yet each may carry billing the old prompt discarded, so
  // the operative filter is "committed doc lacking current-version extraction".
  const queue = (docs ?? []).filter(
    (d) => d.processing_status === "confirmed" && !currentByDoc.get(d.id),
  );
  const skipped = (docs ?? []).filter((d) => currentByDoc.get(d.id));

  // Spend estimate.
  let estLow = 0, estHigh = 0;
  for (const d of queue) {
    const inTok = estInputTokens(d.mime_type, d.byte_size ?? 0);
    const outTok = 2000;
    // Low: resolves at tier 1. High ceiling: escalates 1→2→3 (pays all three).
    estLow += (inTok * PRICE.tier1_in + outTok * PRICE.tier1_out) / 1e6;
    const t1 = (inTok * PRICE.tier1_in + outTok * PRICE.tier1_out) / 1e6;
    const t2 = (inTok * PRICE.tier2_in + outTok * PRICE.tier2_out) / 1e6;
    const t3 = (inTok * PRICE.tier3_in + outTok * PRICE.tier3_out) / 1e6;
    estHigh += t1 + t2 + t3;
  }

  console.log(`\nDocuments total: ${docs?.length}`);
  console.log(`Already at ${EXTRACTION_PROMPT_VERSION} (skip): ${skipped.length}`);
  console.log(`Queue (confirmed, needs re-extraction): ${queue.length}`);
  console.log(`\nEstimated OpenRouter spend: $${estLow.toFixed(2)} (all resolve tier 1) ` +
    `.. $${estHigh.toFixed(2)} (worst case: every doc escalates through Sonnet)`);
  console.log(`Realistic expectation: most docs resolve at tier 1-2, so roughly $${(estLow * 1.6).toFixed(2)}-$${(estHigh * 0.4).toFixed(2)}.\n`);
  for (const d of queue) {
    console.log(`  ${d.id} | ${d.mime_type} | ${((d.byte_size ?? 0) / 1048576).toFixed(2)}MB | ${JSON.stringify(d.original_filename)}`);
  }

  if (queue.length > QUEUE_CAP) {
    console.error(`\nQueue ${queue.length} exceeds cap ${QUEUE_CAP}. Aborting - narrow the selection.`);
    process.exit(1);
  }

  if (!isExecute()) {
    console.log(`\n[DRY-RUN] Would re-extract ${queue.length} documents through the real pipeline. Re-run with --execute.`);
    return;
  }

  // ── EXECUTE ─────────────────────────────────────────────────────────
  const outcomes: any[] = [];
  for (const d of queue) {
    process.stdout.write(`  re-extracting ${d.id} (${d.original_filename}) ... `);
    try {
      await processDocumentExtraction({ documentId: d.id });
    } catch (e) {
      console.log(`THREW: ${(e as Error).message}`);
      outcomes.push({ id: d.id, filename: d.original_filename, result: "threw", error: (e as Error).message });
      continue;
    }
    // Verify a fresh current-version pending_review extraction landed.
    const { data: latest } = await db.from("document_extractions")
      .select("id, prompt_version, status, extracted_at").eq("household_id", HOUSEHOLD_ID)
      .eq("document_id", d.id).order("extracted_at", { ascending: false }).limit(1).maybeSingle();
    const { data: docRow } = await db.from("documents")
      .select("processing_status, error_message").eq("id", d.id).maybeSingle();
    const ok = latest?.prompt_version === EXTRACTION_PROMPT_VERSION && latest?.status === "pending_review";
    console.log(ok ? `ok (status=${docRow?.processing_status})` : `status=${docRow?.processing_status} ext=${latest?.status ?? "none"}${docRow?.error_message ? " err=" + docRow.error_message : ""}`);
    outcomes.push({
      id: d.id, filename: d.original_filename,
      result: ok ? "pending_review" : docRow?.processing_status ?? "unknown",
      extraction_id: latest?.id ?? null, doc_status: docRow?.processing_status ?? null,
      error: docRow?.error_message ?? null,
    });
    await auditInsert(db, {
      actorId, action: "update", entityType: "document", entityId: d.id,
      diff: { reprocessing: "phase3_cost_reextract", prompt_version: EXTRACTION_PROMPT_VERSION,
        new_extraction_id: latest?.id ?? null, result: ok ? "pending_review" : docRow?.processing_status },
    });
  }

  const pending = outcomes.filter((o) => o.result === "pending_review").length;
  const failed = outcomes.filter((o) => o.result !== "pending_review").length;
  writeFileSync(join(SCRATCHPAD, "phase3-summary.json"), JSON.stringify({ phase: 3, generated_at: new Date().toISOString(), queued: queue.length, pending, failed, outcomes }, null, 2));
  console.log(`\n[EXECUTE] Re-extracted ${queue.length}: ${pending} now pending_review, ${failed} not. ${outcomes.length} audit rows.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
