/**
 * PHASE 2 - committed-duplicate sweep for the founder's household.
 *
 * Detects duplicate clusters among medical_events, vaccinations, and
 * medications sharing pet_id + date + vet_clinic (nullable-aware):
 *
 *   EXACT cluster  - IDENTICAL normalized title/type (or vaccine_type / med
 *                    name). These are auto-collapsed: keep the FIRST import
 *                    (earliest created_at, id tiebreak), delete the later
 *                    copies. A full-row JSON backup is written first and an
 *                    audit row is written per deletion.
 *   FUZZY cluster  - same-day/clinic same-category events worded differently
 *                    (exam-type), or same-day same-family vaccinations with
 *                    different vaccine_type strings. NEVER touched - surfaced
 *                    in the report for the founder to merge manually.
 *
 * Fuzzy candidate detection reuses the canonical stopword/family logic from
 * lib/db/extraction-dedup-match.ts. Reminders whose entity_id points at a
 * deleted row are re-pointed to the kept row (or flagged); none are expected
 * (the founder's reminders reference document ids).
 *
 *   Dry run:  pnpm dlx tsx --env-file=.env.local scripts/reprocess-phase2-dedup.ts
 *   Execute:  pnpm dlx tsx --env-file=.env.local scripts/reprocess-phase2-dedup.ts --execute
 *
 * Idempotent: after execution the exact clusters are gone, so a re-run finds
 * nothing to delete.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  tokens,
  sameClinic,
  canonicalVaccineFamily,
} from "@/lib/db/extraction-dedup-match";

import {
  HOUSEHOLD_ID,
  SCRATCHPAD,
  auditInsert,
  banner,
  getActorId,
  isExecute,
  makeDb,
  writeBackup,
} from "./reprocess-common";

const NIL = "∅";
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function clinicKey(id: string | null): string {
  return id ?? NIL;
}

type Row = Record<string, any>;

/** Sort a cluster deterministically: earliest created_at, then id. Keeper=[0]. */
function orderCluster(rows: Row[]): Row[] {
  return [...rows].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

async function main(): Promise<void> {
  banner("PHASE 2 · committed-duplicate sweep");
  const db = makeDb();
  const actorId = await getActorId(db);

  const { data: clinics } = await db.from("vet_clinics").select("id, name").eq("household_id", HOUSEHOLD_ID);
  const clinicName = new Map<string, string>((clinics ?? []).map((c: Row) => [c.id, c.name]));
  const clabel = (id: string | null) => (id ? clinicName.get(id) ?? id : "(no clinic)");

  // select("*") so the JSON backup captures the FULL row (every column,
  // including free-text clinical fields), making a deleted row re-insertable
  // verbatim. The subset needed for clustering is read off these full rows.
  const { data: events } = await db.from("medical_events").select("*").eq("household_id", HOUSEHOLD_ID);
  const { data: vaccines } = await db.from("vaccinations").select("*").eq("household_id", HOUSEHOLD_ID);
  const { data: meds } = await db.from("medications").select("*").eq("household_id", HOUSEHOLD_ID);

  // ── EXACT clusters ──────────────────────────────────────────────────
  type ExactCluster = { table: string; label: string; keep: Row; drop: Row[] };
  const exact: ExactCluster[] = [];

  function collectExact(table: string, rows: Row[], dateOf: (r: Row) => string, identityOf: (r: Row) => string, labelOf: (r: Row) => string) {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const k = [r.pet_id, dateOf(r), clinicKey(r.vet_clinic_id), identityOf(r)].join("¦");
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
    }
    for (const rowsIn of groups.values()) {
      if (rowsIn.length < 2) continue;
      const ordered = orderCluster(rowsIn);
      exact.push({ table, label: labelOf(ordered[0]), keep: ordered[0], drop: ordered.slice(1) });
    }
  }

  collectExact("medical_events", events ?? [],
    (r) => r.occurred_on,
    (r) => `${r.event_type}¦${norm(r.title)}`,
    (r) => `${r.occurred_on} ${clabel(r.vet_clinic_id)} · ${r.event_type} · ${JSON.stringify(r.title)}`);
  collectExact("vaccinations", vaccines ?? [],
    (r) => r.administered_on,
    (r) => norm(r.vaccine_type),
    (r) => `${r.administered_on} ${clabel(r.vet_clinic_id)} · ${JSON.stringify(r.vaccine_type)}`);
  collectExact("medications", meds ?? [],
    (r) => r.started_on,
    (r) => norm(r.name),
    (r) => `${r.started_on} ${clabel(r.vet_clinic_id)} · ${JSON.stringify(r.name)}`);

  const allDrops: { table: string; row: Row; keptId: string; label: string }[] = [];
  for (const c of exact) for (const d of c.drop) allDrops.push({ table: c.table, row: d, keptId: c.keep.id, label: c.label });

  console.log(`\nEXACT clusters (auto-collapse, keep earliest): ${exact.length}`);
  console.log(`Rows to delete: ${allDrops.length}\n`);
  for (const c of exact) {
    console.log(`  [${c.table}] ${c.label}`);
    console.log(`     KEEP  ${c.keep.id}  created=${c.keep.created_at} doc=${c.keep.document_id}`);
    for (const d of c.drop) console.log(`     DROP  ${d.id}  created=${d.created_at} doc=${d.document_id}`);
  }

  // ── Reminder orphan check ───────────────────────────────────────────
  const dropIds = new Set(allDrops.map((d) => d.row.id));
  const { data: rems } = await db.from("reminders")
    .select("id, entity_type, entity_id, status").eq("household_id", HOUSEHOLD_ID);
  const orphanReminders = (rems ?? []).filter((r: Row) => dropIds.has(r.entity_id));
  const remRepoints: { reminderId: string; from: string; to: string }[] = [];
  for (const r of orphanReminders) {
    const drop = allDrops.find((d) => d.row.id === r.entity_id)!;
    remRepoints.push({ reminderId: r.id, from: r.entity_id, to: drop.keptId });
  }
  console.log(`\nReminders pointing at a to-be-deleted row: ${orphanReminders.length}` +
    (orphanReminders.length ? ` (will re-point to kept row)` : ` (none - reminders reference document ids)`));

  // ── FUZZY clusters (report only) ────────────────────────────────────
  // Exam-type events: same pet+day+clinic, >1 distinct wording remaining.
  const fuzzyExam: any[] = [];
  {
    const groups = new Map<string, Row[]>();
    for (const r of (events ?? []).filter((e) => e.event_type === "exam")) {
      const k = [r.pet_id, r.occurred_on, clinicKey(r.vet_clinic_id)].join("¦");
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
    }
    for (const rowsIn of groups.values()) {
      const distinct = new Map<string, Row>();
      for (const r of rowsIn) if (!distinct.has(norm(r.title))) distinct.set(norm(r.title), r);
      if (distinct.size < 2) continue; // all identical → handled as EXACT
      const members = [...distinct.values()];
      // Same-clinic + same-day + exam-type is the same-visit signal; confirm
      // via sameClinic on the shared clinic (all share vet_clinic_id here).
      fuzzyExam.push({
        occurred_on: members[0].occurred_on,
        clinic: clabel(members[0].vet_clinic_id),
        same_visit_signal: sameClinic(clinicName.get(members[0].vet_clinic_id) ?? null, clinicName.get(members[0].vet_clinic_id) ?? null),
        members: members.map((m) => ({ id: m.id, title: m.title, tokens: tokens(m.title), document_id: m.document_id })),
      });
    }
  }
  // Vaccinations: same pet+day+clinic, same canonical family, >1 distinct vaccine_type.
  const fuzzyVax: any[] = [];
  {
    const groups = new Map<string, Row[]>();
    for (const r of vaccines ?? []) {
      const fam = canonicalVaccineFamily(r.vaccine_family ?? r.vaccine_type);
      const k = [r.pet_id, r.administered_on, clinicKey(r.vet_clinic_id), fam].join("¦");
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
    }
    for (const rowsIn of groups.values()) {
      const distinctTypes = new Map<string, Row[]>();
      for (const r of rowsIn) (distinctTypes.get(norm(r.vaccine_type)) ?? distinctTypes.set(norm(r.vaccine_type), []).get(norm(r.vaccine_type))!).push(r);
      if (distinctTypes.size < 2) continue; // identical strings → EXACT
      const fam = canonicalVaccineFamily(rowsIn[0].vaccine_family ?? rowsIn[0].vaccine_type);
      fuzzyVax.push({
        administered_on: rowsIn[0].administered_on,
        clinic: clabel(rowsIn[0].vet_clinic_id),
        family: fam,
        members: rowsIn.map((m) => ({ id: m.id, vaccine_type: m.vaccine_type, document_id: m.document_id })),
      });
    }
  }

  console.log(`\nFUZZY exam clusters (report only): ${fuzzyExam.length}`);
  console.log(`FUZZY vaccination-family clusters (report only): ${fuzzyVax.length}`);

  // ── Persist machine summary for the report writer (both modes) ──────
  const summary = {
    phase: 2,
    generated_at: new Date().toISOString(),
    mode: isExecute() ? "execute" : "dry-run",
    exact_clusters: exact.map((c) => ({
      table: c.table, label: c.label, kept_id: c.keep.id,
      dropped_ids: c.drop.map((d) => d.id),
    })),
    rows_deleted: allDrops.length,
    reminder_repoints: remRepoints,
    fuzzy_exam: fuzzyExam,
    fuzzy_vaccinations: fuzzyVax,
  };
  writeFileSync(join(SCRATCHPAD, "phase2-summary.json"), JSON.stringify(summary, null, 2));

  if (!isExecute()) {
    // Preview backup to scratchpad only (not docs) so a dry run never leaves a
    // committed backup implying deletions happened.
    writeFileSync(
      join(SCRATCHPAD, "phase2-would-delete-preview.json"),
      JSON.stringify(allDrops.map((d) => ({ table: d.table, kept_id: d.keptId, row: d.row })), null, 2),
    );
    console.log(`\n[DRY-RUN] Would delete ${allDrops.length} rows across ${exact.length} exact clusters. Re-run with --execute.`);
    console.log(`Preview: ${join(SCRATCHPAD, "phase2-would-delete-preview.json")}`);
    return;
  }

  // ── EXECUTE ─────────────────────────────────────────────────────────
  // 1) Backup FIRST (both scratchpad + docs), so nothing is deleted un-backed.
  const backup = {
    generated_at: new Date().toISOString(),
    household_id: HOUSEHOLD_ID,
    phase: 2,
    deleted_rows: allDrops.map((d) => ({ table: d.table, kept_id: d.keptId, cluster: d.label, row: d.row })),
    reminder_repoints: remRepoints,
  };
  const docsPath = writeBackup("phase2-deleted-backup.json", backup);
  console.log(`\nBackup written to docs/ + scratchpad (${allDrops.length} rows). docs path: ${docsPath}`);

  // 2) Re-point orphan reminders to the kept row.
  for (const rp of remRepoints) {
    const { error } = await db.from("reminders").update({ entity_id: rp.to }).eq("id", rp.reminderId).eq("household_id", HOUSEHOLD_ID);
    if (error) throw new Error(`reminder re-point ${rp.reminderId}: ${error.message}`);
    await auditInsert(db, { actorId, action: "update", entityType: "reminder", entityId: rp.reminderId,
      diff: { reprocessing: "phase2_reminder_repoint", before: { entity_id: rp.from }, after: { entity_id: rp.to } } });
  }

  // 3) Delete later copies, audit per deletion.
  let deleted = 0;
  for (const d of allDrops) {
    const { error } = await db.from(d.table).delete().eq("id", d.row.id).eq("household_id", HOUSEHOLD_ID);
    if (error) throw new Error(`delete ${d.table} ${d.row.id}: ${error.message}`);
    await auditInsert(db, {
      actorId, action: "delete", entityType: d.table.replace(/s$/, ""), entityId: d.row.id,
      diff: { reprocessing: "phase2_exact_duplicate", kept_id: d.keptId, cluster: d.label, deleted_row: d.row },
    });
    deleted++;
  }
  console.log(`\n[EXECUTE] Deleted ${deleted} rows; ${remRepoints.length} reminder re-points; ${deleted + remRepoints.length} audit rows.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
