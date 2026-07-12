/**
 * Behavioral tests for the pure course-duration estimator.
 *
 * Run:  pnpm dlx tsx scripts/test-course-duration.ts
 *
 * The estimator turns a sig ("1 tablet BID x 7 days", "6 doses over two weeks")
 * into an estimated ended_on so short courses roll off "Active". A wrong end
 * date silently hides an active med or shows a finished one forever, so every
 * realistic sig shape gets a pinned expectation here. No framework: check()
 * + counters, nonzero exit on failure so CI can gate.
 */

import {
  estimateCourseEnd,
  dosesPerDayFromFrequency,
} from "../lib/clinical/course-duration";

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("  FAIL:", msg);
  }
}

// ── doses-per-day parsing ───────────────────────────────────────────
console.log("dosesPerDayFromFrequency");
check(dosesPerDayFromFrequency("BID") === 2, "BID → 2/day");
check(dosesPerDayFromFrequency("bid") === 2, "lowercase bid → 2/day");
check(dosesPerDayFromFrequency("1 tablet PO TID") === 3, "TID → 3/day");
check(dosesPerDayFromFrequency("QID") === 4, "QID → 4/day");
check(dosesPerDayFromFrequency("SID") === 1, "SID → 1/day");
check(dosesPerDayFromFrequency("once daily") === 1, "once daily → 1/day");
check(dosesPerDayFromFrequency("twice daily") === 2, "twice daily → 2/day");
check(
  dosesPerDayFromFrequency("three times daily") === 3,
  "three times daily → 3/day",
);
check(dosesPerDayFromFrequency("q12h") === 2, "q12h → 2/day");
check(dosesPerDayFromFrequency("q8h") === 3, "q8h → 3/day");
check(dosesPerDayFromFrequency("q24h") === 1, "q24h → 1/day");
check(
  dosesPerDayFromFrequency("every 8 hours") === 3,
  "every 8 hours → 3/day",
);
check(
  dosesPerDayFromFrequency("every 8-12 hours") === 3,
  "every 8-12 hours → shorter interval (8h) → 3/day",
);
check(
  dosesPerDayFromFrequency("every other day") === 0.5,
  "every other day → 0.5/day",
);
check(dosesPerDayFromFrequency(null) === null, "null frequency → null");
check(
  dosesPerDayFromFrequency("as needed") === null,
  "unparseable (as needed) → null",
);

// ── explicit duration_days ──────────────────────────────────────────
console.log("estimateCourseEnd — explicit duration_days");
{
  // "Robenacoxib 6mg PO SID x 7 days" starting 2025-10-02.
  const r = estimateCourseEnd({
    started_on: "2025-10-02",
    duration_days: 7,
    frequency: "SID",
  });
  check(r?.ended_on === "2025-10-09", `x7d from 10-02 → 10-09, got ${r?.ended_on}`);
  check(r?.basis === "duration_days", "basis = duration_days");
}
{
  // "Amoxicillin BID for 14 days" from 2025-01-01.
  const r = estimateCourseEnd({
    started_on: "2025-01-01",
    duration_days: 14,
    frequency: "BID",
  });
  check(r?.ended_on === "2025-01-15", `x14d from 01-01 → 01-15, got ${r?.ended_on}`);
}
{
  // duration_days beats total_doses when both present.
  const r = estimateCourseEnd({
    started_on: "2025-01-01",
    duration_days: 5,
    total_doses: 30,
    frequency: "BID",
  });
  check(
    r?.ended_on === "2025-01-06" && r?.basis === "duration_days",
    "duration_days takes priority over total_doses",
  );
}

// ── total_doses + frequency ─────────────────────────────────────────
console.log("estimateCourseEnd — total_doses + frequency");
{
  // The founder's own sig: "6 doses over the next two weeks". If the extractor
  // parsed the count but not the span, fall back on frequency. Dosed every
  // other day (qod), 6 doses = 12 days.
  const r = estimateCourseEnd({
    started_on: "2025-07-21",
    total_doses: 6,
    frequency: "every other day",
  });
  check(
    r?.ended_on === "2025-08-02",
    `6 doses qod from 07-21 → 08-02 (12d), got ${r?.ended_on}`,
  );
  check(r?.basis === "doses_and_frequency", "basis = doses_and_frequency");
}
{
  // "6 doses over the next two weeks" where the extractor DID resolve the span
  // to duration_days=14 — the reliable path.
  const r = estimateCourseEnd({
    started_on: "2025-07-21",
    duration_days: 14,
    total_doses: 6,
  });
  check(r?.ended_on === "2025-08-04", `two weeks from 07-21 → 08-04, got ${r?.ended_on}`);
}
{
  // "#20, 1 PO BID" — 20 tablets, twice daily → 10 days.
  const r = estimateCourseEnd({
    started_on: "2025-03-01",
    total_doses: 20,
    frequency: "1 PO BID",
  });
  check(r?.ended_on === "2025-03-11", `20 doses BID from 03-01 → 03-11, got ${r?.ended_on}`);
}
{
  // "#30 TID" → 10 days.
  const r = estimateCourseEnd({
    started_on: "2025-03-01",
    total_doses: 30,
    frequency: "TID",
  });
  check(r?.ended_on === "2025-03-11", `30 doses TID → 03-11, got ${r?.ended_on}`);
}
{
  // Odd count rounds UP (ceil): 7 doses BID → 4 days (3.5 → 4).
  const r = estimateCourseEnd({
    started_on: "2025-03-01",
    total_doses: 7,
    frequency: "BID",
  });
  check(r?.ended_on === "2025-03-05", `7 doses BID ceil→4d → 03-05, got ${r?.ended_on}`);
}

// ── no estimate possible ────────────────────────────────────────────
console.log("estimateCourseEnd — null (ongoing / not enough info)");
check(
  estimateCourseEnd({ started_on: "2025-01-01", frequency: "once daily" }) ===
    null,
  "frequency but no duration/count → null (ongoing)",
);
check(
  estimateCourseEnd({
    started_on: "2025-01-01",
    total_doses: 30,
    frequency: "as needed",
  }) === null,
  "count but unparseable frequency → null",
);
check(
  estimateCourseEnd({ started_on: null, duration_days: 7 }) === null,
  "no start date → null",
);
check(
  estimateCourseEnd({ started_on: "not-a-date", duration_days: 7 }) === null,
  "invalid start date → null",
);
check(
  estimateCourseEnd({ started_on: "2025-01-01", duration_days: 0 }) === null,
  "zero duration → null",
);

console.log(`\ncourse-duration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
