/**
 * PHASE 1 - ended_estimated backfill.
 *
 * The pre-migration-0032 commit path derived medication end dates from
 * duration_days but had no ended_estimated column, so those rows carry the
 * post-migration DEFAULT (false) even though their end was COMPUTED, not
 * document-stated. This turns the marker ON so the meds UI shows "(est.)" and
 * offers the "still taking it" correction. It changes NO dates.
 *
 * Target: medications with duration_days IS NOT NULL AND ended_on IS NOT NULL
 *         AND ended_estimated = false (household-scoped).
 *
 *   Dry run:  pnpm dlx tsx --env-file=.env.local scripts/reprocess-phase1-ended-estimated.ts
 *   Execute:  pnpm dlx tsx --env-file=.env.local scripts/reprocess-phase1-ended-estimated.ts --execute
 *
 * Idempotent: an already-flipped row no longer matches the predicate.
 */

import {
  HOUSEHOLD_ID,
  auditInsert,
  banner,
  getActorId,
  isExecute,
  makeDb,
} from "./reprocess-common";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  banner("PHASE 1 · ended_estimated backfill");
  const db = makeDb();
  const actorId = await getActorId(db);

  const { data: rows, error } = await db
    .from("medications")
    .select("id, pet_id, name, started_on, ended_on, duration_days, ended_estimated")
    .eq("household_id", HOUSEHOLD_ID)
    .not("duration_days", "is", null)
    .not("ended_on", "is", null)
    .eq("ended_estimated", false)
    .order("started_on");
  if (error) throw new Error(`fetch: ${error.message}`);

  const targets = rows ?? [];
  console.log(`\nMatching rows (will flip ended_estimated → true): ${targets.length}\n`);
  for (const m of targets) {
    const derived = addDays(m.started_on, m.duration_days);
    const note = derived === m.ended_on ? "derived==ended_on" : `derived=${derived} (delta ${daysBetween(derived, m.ended_on)}d)`;
    console.log(
      `  ${m.id}  ${JSON.stringify(m.name)}  started=${m.started_on} dur=${m.duration_days} ended=${m.ended_on}  [${note}]`,
    );
  }
  // The derivation delta is INFORMATIONAL only. We flip every matching row:
  // the false value here is the migration-0032 backfilled default on a
  // pre-0032 computed end, which is exactly what Phase 1 exists to correct.

  if (!isExecute()) {
    console.log(`\n[DRY-RUN] Would flip ${targets.length} rows. Re-run with --execute.`);
    return;
  }

  let flipped = 0;
  for (const m of targets) {
    const { error: upErr } = await db
      .from("medications")
      .update({ ended_estimated: true })
      .eq("id", m.id)
      .eq("household_id", HOUSEHOLD_ID)
      .eq("ended_estimated", false); // guard: no-op if already flipped
    if (upErr) throw new Error(`update ${m.id}: ${upErr.message}`);
    await auditInsert(db, {
      actorId,
      action: "update",
      entityType: "medication",
      entityId: m.id,
      diff: {
        reprocessing: "phase1_ended_estimated",
        before: { ended_estimated: false },
        after: { ended_estimated: true },
        name: m.name,
        ended_on: m.ended_on,
        duration_days: m.duration_days,
      },
    });
    flipped++;
  }
  console.log(`\n[EXECUTE] Flipped ${flipped} medications; ${flipped} audit rows written.`);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
