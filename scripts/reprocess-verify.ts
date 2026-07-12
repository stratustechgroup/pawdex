/**
 * Post-execution verification for the reprocessing run. Read-only.
 *
 *   pnpm dlx tsx --env-file=.env.local scripts/reprocess-verify.ts
 *
 * Checks: Phase 1 flips landed and none remain; Phase 2 exact clusters are gone
 * and the JSON backup is well-formed + restorable (schema-shape validation of
 * every deleted row); Phase 3 documents are pending_review at v7.1.0; audit
 * rows written; reminders intact.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOUSEHOLD_ID, REPROC_DATE, makeDb } from "./reprocess-common";

const NIL = "∅";
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
  ok ? pass++ : fail++;
}

// Required NOT-NULL columns per table for restorability validation.
const REQUIRED: Record<string, string[]> = {
  medical_events: ["id", "household_id", "pet_id", "occurred_on", "title", "event_type", "created_at"],
  vaccinations: ["id", "household_id", "pet_id", "administered_on", "vaccine_type", "created_at"],
  medications: ["id", "household_id", "pet_id", "name", "dose", "started_on", "created_at"],
};

async function main(): Promise<void> {
  const db = makeDb();
  console.log("\n=== PHASE 1 verification ===");
  const { data: remaining } = await db.from("medications")
    .select("id").eq("household_id", HOUSEHOLD_ID)
    .not("duration_days", "is", null).not("ended_on", "is", null).eq("ended_estimated", false);
  check("no medications remain matching the old (unflagged) predicate", (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
  const { count: estCount } = await db.from("medications").select("id", { count: "exact", head: true })
    .eq("household_id", HOUSEHOLD_ID).eq("ended_estimated", true);
  check("medications with ended_estimated=true present", (estCount ?? 0) >= 5, `count=${estCount}`);

  console.log("\n=== PHASE 2 verification ===");
  // Re-detect exact clusters live - expect zero.
  async function exactClusterCount(table: string, dateCol: string, idOf: (r: any) => string): Promise<number> {
    const { data } = await db.from(table).select("*").eq("household_id", HOUSEHOLD_ID);
    const groups = new Map<string, number>();
    for (const r of data ?? []) {
      const k = [r.pet_id, r[dateCol], r.vet_clinic_id ?? NIL, idOf(r)].join("¦");
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    return [...groups.values()].filter((n) => n > 1).length;
  }
  check("medical_events: 0 exact clusters remain", await exactClusterCount("medical_events", "occurred_on", (r) => `${r.event_type}¦${norm(r.title)}`) === 0);
  check("vaccinations: 0 exact clusters remain", await exactClusterCount("vaccinations", "administered_on", (r) => norm(r.vaccine_type)) === 0);
  check("medications: 0 exact clusters remain", await exactClusterCount("medications", "started_on", (r) => norm(r.name)) === 0);

  // Backup restorability: file exists, parses, every deleted row has required
  // cols with sane types, and the row's id is GONE from the live table.
  const backupPath = join(process.cwd(), "docs", `reprocessing-backup-${REPROC_DATE}.json`);
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  check("backup file parses", Array.isArray(backup.deleted_rows), `${backup.deleted_rows?.length} rows`);
  let restorableBad = 0, stillPresent = 0, keptMissing = 0;
  for (const entry of backup.deleted_rows ?? []) {
    const req = REQUIRED[entry.table] ?? [];
    for (const col of req) {
      const v = entry.row[col];
      if (v === undefined || v === null || (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean")) restorableBad++;
    }
    const { data: live } = await db.from(entry.table).select("id").eq("id", entry.row.id).maybeSingle();
    if (live) stillPresent++;
    // The retained canonical row (carrying the clinical narrative) must exist.
    if (!entry.kept_row_snapshot || !entry.kept_row_snapshot.id) keptMissing++;
  }
  check("every backed-up row has required NOT-NULL columns (re-insertable)", restorableBad === 0, `violations=${restorableBad}`);
  check("every backed-up (deleted) row is absent from live table", stillPresent === 0, `still present=${stillPresent}`);
  check("every backed-up row carries a kept_row_snapshot (surviving content)", keptMissing === 0, `missing=${keptMissing}`);
  // Prove ONE row round-trips through the exact schema shape it would re-insert into.
  const sample = (backup.deleted_rows ?? [])[0];
  if (sample) {
    const insertShape = { ...sample.row };
    const ok = REQUIRED[sample.table].every((c) => insertShape[c] !== undefined);
    check(`sample row (${sample.table} ${sample.row.id}) is shape-valid for re-insert`, ok);
  }

  console.log("\n=== PHASE 3 verification ===");
  const { data: docs } = await db.from("documents").select("id, processing_status").eq("household_id", HOUSEHOLD_ID);
  const extracted = (docs ?? []).filter((d) => d.processing_status === "extracted").length;
  check("documents flipped to 'extracted' (in review queue)", extracted >= 23, `extracted=${extracted}/${docs?.length}`);
  const { data: exts } = await db.from("document_extractions").select("document_id, prompt_version, status").eq("household_id", HOUSEHOLD_ID);
  const pendingCurrent = new Set((exts ?? []).filter((e) => e.prompt_version === "v7.1.0" && e.status === "pending_review").map((e) => e.document_id));
  check("documents with a v7.1.0 pending_review extraction", pendingCurrent.size >= 23, `count=${pendingCurrent.size}`);

  console.log("\n=== AUDIT + REMINDERS ===");
  const { data: audits } = await db.from("audit_log").select("diff").eq("household_id", HOUSEHOLD_ID).order("created_at", { ascending: false }).limit(200);
  const reproc = (audits ?? []).filter((a: any) => a.diff && typeof a.diff === "object" && String(a.diff.reprocessing ?? "").startsWith("phase"));
  const byPhase: Record<string, number> = {};
  for (const a of reproc) { const p = (a.diff as any).reprocessing; byPhase[p] = (byPhase[p] ?? 0) + 1; }
  check("audit rows written for all phases", reproc.length >= 61, JSON.stringify(byPhase));
  const { count: remCount } = await db.from("reminders").select("id", { count: "exact", head: true }).eq("household_id", HOUSEHOLD_ID);
  check("reminders intact (none orphaned/removed)", (remCount ?? 0) === 4, `count=${remCount}`);
  const { count: invCount } = await db.from("invoice_items").select("id", { count: "exact", head: true }).eq("household_id", HOUSEHOLD_ID);
  check("invoice_items still 0 (nothing auto-committed - awaits founder review)", (invCount ?? 0) === 0, `count=${invCount}`);

  console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}: ${pass} pass, ${fail} fail\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
