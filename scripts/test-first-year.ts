/**
 * Behavioral tests for the pure first-year plan projection.
 *
 * Run:  pnpm dlx tsx scripts/test-first-year.ts
 *
 * buildFirstYearPlan drives real product decisions, which milestones show,
 * which dates they land on, and (critically) which ones become scheduled
 * reminders that email real owners. A wrong cutoff or an off-by-one on the
 * date math type-checks fine and silently schedules a misleading email or
 * strands a milestone, so the behavior is proven here against fixed dates.
 *
 * Every fixture pins `asOf` so the past/upcoming split is deterministic.
 * No test framework, plain check(cond, msg) + counters, nonzero exit on fail.
 */

import {
  buildFirstYearPlan,
  remindableItems,
  SERIES_COMPLETE_WEEKS,
  type FirstYearPlan,
} from "../lib/clinical/first-year";

// ── tiny harness ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(cond: boolean, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function itemByKey(plan: FirstYearPlan, key: string) {
  const it = plan.items.find((i) => i.key === key);
  if (!it) throw new Error(`fixture expected item '${key}' to exist`);
  return it;
}

// Add N weeks of days to a yyyy-mm-dd string, returning yyyy-mm-dd. Used to
// build fixtures whose asOf is a known age.
function bornWeeksBefore(asOf: string, weeks: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

// ── Fixture 1: newborn puppy, everything is in the future ───────────
{
  const asOf = new Date("2026-07-10T12:00:00Z");
  const plan = buildFirstYearPlan({
    species: "dog",
    birthDate: "2026-07-08", // 2 days old
    asOf,
  })!;

  check(plan !== null, "newborn puppy: plan is produced");
  check(plan.ageWeeks === 0, "newborn puppy: age is 0 weeks");
  check(!plan.isMinimal, "newborn puppy: plan is NOT minimal");
  check(
    plan.items.every((i) => !i.isPast),
    "newborn puppy: no milestone is in the past",
  );

  // DHPP dose 1 anchored at 6 weeks → birth + 42 days.
  const dhpp1 = itemByKey(plan, "dhpp_1");
  check(dhpp1.dueOn === "2026-08-19", `newborn puppy: DHPP#1 date (got ${dhpp1.dueOn})`);
  check(dhpp1.remindable, "newborn puppy: DHPP#1 is remindable (future vaccine)");

  // Rabies at 16 weeks → birth + 112 days, legally sensitive.
  const rabies = itemByKey(plan, "rabies_1");
  check(rabies.dueOn === "2026-10-28", `newborn puppy: rabies date (got ${rabies.dueOn})`);
  check(rabies.legallySensitive, "newborn puppy: rabies is legally sensitive");
  check(rabies.remindable, "newborn puppy: rabies is remindable");

  // Non-vaccine items are never remindable even when future-dated.
  const spay = itemByKey(plan, "spay_neuter_discussion");
  check(spay.category === "procedure", "newborn puppy: spay item is a procedure");
  check(!spay.remindable, "newborn puppy: spay discussion is NOT remindable");
  const heartworm = itemByKey(plan, "heartworm_start");
  check(!heartworm.remindable, "newborn puppy: heartworm start is NOT remindable");

  // Lifestyle vaccines (lepto/bordetella) are wellness, not remindable.
  const lepto = itemByKey(plan, "lepto_lifestyle");
  check(lepto.category === "wellness", "newborn puppy: lepto is a wellness/lifestyle note");
  check(!lepto.remindable, "newborn puppy: lepto is NOT remindable");

  // Every remindable item is a future-dated vaccine.
  const rem = remindableItems(plan);
  check(rem.length > 0, "newborn puppy: has remindable items");
  check(
    rem.every((i) => i.category === "vaccine" && !i.isPast),
    "newborn puppy: all remindable items are future vaccines",
  );
}

// ── Fixture 2: 12-week kitten, mid-series split ─────────────────────
{
  const asOf = new Date("2026-07-10T12:00:00Z");
  const birth = bornWeeksBefore("2026-07-10", 12); // exactly 12 weeks
  const plan = buildFirstYearPlan({ species: "cat", birthDate: birth, asOf })!;

  check(plan.species === "cat", "12wk kitten: species is cat");
  check(plan.ageWeeks === 12, `12wk kitten: age is 12 weeks (got ${plan.ageWeeks})`);
  check(!plan.isMinimal, "12wk kitten: NOT minimal (still under 20 weeks)");

  // FVRCP#1 (6wk) and #2 (10wk) are past; #3 (14wk) and rabies (16wk) upcoming.
  check(itemByKey(plan, "fvrcp_1").isPast, "12wk kitten: FVRCP#1 (6wk) is past");
  check(itemByKey(plan, "fvrcp_2").isPast, "12wk kitten: FVRCP#2 (10wk) is past");
  check(!itemByKey(plan, "fvrcp_3").isPast, "12wk kitten: FVRCP#3 (14wk) is upcoming");
  check(!itemByKey(plan, "rabies_1").isPast, "12wk kitten: rabies (16wk) is upcoming");

  // Past vaccines are NOT remindable (would email immediately + retroactively).
  check(!itemByKey(plan, "fvrcp_1").remindable, "12wk kitten: past FVRCP#1 NOT remindable");
  check(itemByKey(plan, "fvrcp_3").remindable, "12wk kitten: upcoming FVRCP#3 remindable");

  // FeLV kitten series present (feline-specific).
  check(
    plan.items.some((i) => i.key === "felv_1"),
    "12wk kitten: FeLV series present for kittens",
  );
  // No dog-only families leaked in.
  check(
    !plan.items.some((i) => i.vaccineFamily === "dhpp"),
    "12wk kitten: no DHPP (dog-only) in a cat plan",
  );

  const rem = remindableItems(plan);
  check(
    rem.every((i) => !i.isPast && i.category === "vaccine"),
    "12wk kitten: remindable set is future vaccines only",
  );
}

// ── Fixture 3: adult dog, minimal plan ──────────────────────────────
{
  const asOf = new Date("2026-07-10T12:00:00Z");
  const plan = buildFirstYearPlan({
    species: "dog",
    birthDate: "2022-01-01", // ~4.5 years old
    asOf,
  })!;

  check(plan.isMinimal, "adult dog: plan is minimal");
  check(plan.ageWeeks >= SERIES_COMPLETE_WEEKS, "adult dog: age past series-complete cutoff");
  check(
    plan.items.every((i) => i.isPast),
    "adult dog: every first-year milestone is in the past",
  );
  check(
    remindableItems(plan).length === 0,
    "adult dog: nothing remindable (all milestones past)",
  );
}

// ── Fixture 4: boundary exactly at the series-complete cutoff ────────
{
  const asOf = new Date("2026-07-10T12:00:00Z");

  // Exactly 20 weeks old → minimal by the >= cutoff.
  const at20 = buildFirstYearPlan({
    species: "dog",
    birthDate: bornWeeksBefore("2026-07-10", SERIES_COMPLETE_WEEKS),
    asOf,
  })!;
  check(at20.ageWeeks === SERIES_COMPLETE_WEEKS, "boundary: age is exactly 20 weeks");
  check(at20.isMinimal, "boundary: exactly 20 weeks is minimal");

  // One day under 20 weeks → NOT minimal, and still has upcoming annual boosters.
  const justUnder = buildFirstYearPlan({
    species: "dog",
    birthDate: bornWeeksBefore("2026-07-11", SERIES_COMPLETE_WEEKS), // 20wk tomorrow
    asOf,
  })!;
  check(justUnder.ageWeeks === SERIES_COMPLETE_WEEKS - 1, "boundary: 19 weeks just under cutoff");
  check(!justUnder.isMinimal, "boundary: 19 weeks is NOT minimal");
  check(
    remindableItems(justUnder).some((i) => i.key === "dhpp_booster_1yr"),
    "boundary: 1-year DHPP booster remains remindable near cutoff",
  );
}

// ── Fixture 5: boundary at a single dose cutoff (dose becomes past) ──
{
  const asOf = new Date("2026-07-10T12:00:00Z");

  // Born so that DHPP#1 (6wk) lands exactly today → not past (dueOn == asOf).
  const dueToday = buildFirstYearPlan({
    species: "dog",
    birthDate: bornWeeksBefore("2026-07-10", 6),
    asOf,
  })!;
  check(itemByKey(dueToday, "dhpp_1").dueOn === "2026-07-10", "dose boundary: DHPP#1 due today");
  check(!itemByKey(dueToday, "dhpp_1").isPast, "dose boundary: due-today is NOT past");
  check(itemByKey(dueToday, "dhpp_1").remindable, "dose boundary: due-today is remindable");

  // Born one more week ago → DHPP#1 was yesterday-ish → past, not remindable.
  const duePast = buildFirstYearPlan({
    species: "dog",
    birthDate: bornWeeksBefore("2026-07-03", 6), // DHPP#1 landed a week ago
    asOf,
  })!;
  check(itemByKey(duePast, "dhpp_1").isPast, "dose boundary: elapsed DHPP#1 is past");
  check(!itemByKey(duePast, "dhpp_1").remindable, "dose boundary: elapsed DHPP#1 NOT remindable");
}

// ── Fixture 6: species 'other' and bad input → no plan ───────────────
{
  const asOf = new Date("2026-07-10T12:00:00Z");
  check(
    buildFirstYearPlan({ species: "other", birthDate: "2026-06-01", asOf }) === null,
    "other species: returns null (no species-correct schedule)",
  );
  check(
    buildFirstYearPlan({ species: "dog", birthDate: "not-a-date", asOf }) === null,
    "bad birthDate: returns null",
  );
  check(
    buildFirstYearPlan({ species: "dog", birthDate: "2027-01-01", asOf }) === null,
    "future birthDate: returns null",
  );
}

// ── report ──────────────────────────────────────────────────────────
console.log(`\nfirst-year plan: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
