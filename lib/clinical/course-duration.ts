/**
 * Pure course-duration estimator — NO I/O, NO database, NO side effects.
 *
 * A dispensed short course ("give 1 tablet twice daily for 7 days", "6 doses
 * over the next two weeks", "#20, 1 PO BID") has a knowable end date even when
 * the document never prints one. This computes that estimated end so the meds
 * page can roll the course off "Active" once it's likely finished — always with
 * the estimate marked, always overridable ("still taking it"). We NEVER expire a
 * med without the estimated flag set.
 *
 * Inputs, in priority order:
 *   1. duration_days — an explicit span ("x 7 days", "for 14 days"). Most
 *      reliable; used verbatim.
 *   2. total_doses + frequency — a dispensed count ("dispense 6 doses", "#30")
 *      plus how often it's taken. days = ceil(total_doses / doses_per_day).
 *
 * frequency parsing covers the vet-sig shorthand the extractor emits: SID/BID/
 * TID/QID, q24h/q12h/q8h/q6h, "once/twice/three times daily", and "every N-M
 * hours" (uses the SHORTER interval → more doses/day → the course finishes
 * SOONER, the conservative direction for an auto-roll-off: we'd rather show a
 * finished course as active a bit longer than hide one that's still running).
 */

export type CourseDurationInput = {
  /** ISO YYYY-MM-DD. Required — no start, no estimable end. */
  started_on: string | null | undefined;
  duration_days?: number | null;
  total_doses?: number | null;
  frequency?: string | null;
};

export type CourseDurationResult = {
  /** ISO YYYY-MM-DD estimated end date. */
  ended_on: string;
  /** How the estimate was derived — for UI copy / debugging. */
  basis: "duration_days" | "doses_and_frequency";
  /** The day span used (start + this many days = ended_on). */
  duration_days: number;
};

/**
 * Doses per day implied by a frequency string, or null when it can't be parsed.
 * Exported for the behavioral test.
 */
export function dosesPerDayFromFrequency(
  frequency: string | null | undefined,
): number | null {
  if (!frequency) return null;
  const f = frequency.toLowerCase();

  // "every other day" first — it contains "day" and must not be caught by the
  // daily→1 rule below.
  if (/\bevery\s+other\s+day\b/.test(f) || /\bqod\b/.test(f)) return 0.5;

  // "every N-M hours" / "q8-12h" — a range. Use the shorter interval (more
  // doses/day). Matches "every 8-12 hours", "q 6-8 h", "every 8 to 12 hrs".
  const range = f.match(
    /(?:every|q)\s*(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:hours?|hrs?|h)\b/,
  );
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    const shorter = Math.min(lo, hi);
    if (shorter > 0) return 24 / shorter;
  }

  // "every N hours" / "qNh" / "q N h"
  const everyH = f.match(/(?:every|q)\s*(\d+)\s*(?:hours?|hrs?|h)\b/);
  if (everyH) {
    const h = Number(everyH[1]);
    if (h > 0) return 24 / h;
  }

  // Spelled-out multi-dose counts — checked BEFORE the generic "daily" rule so
  // "twice daily" isn't misread as once-daily by the trailing "daily" token.
  if (/\b(twice|two\s+times)\s+(?:a\s+)?(?:day|daily)\b/.test(f)) return 2;
  if (/\b(three\s+times|thrice)\s+(?:a\s+)?(?:day|daily)\b/.test(f)) return 3;
  if (/\b(four\s+times)\s+(?:a\s+)?(?:day|daily)\b/.test(f)) return 4;

  // Latin dosing abbreviations + generic once-daily. Check longer/higher-freq
  // tokens first.
  if (/\bqid\b/.test(f) || /\bq6h?\b/.test(f)) return 4;
  if (/\btid\b/.test(f) || /\bq8h?\b/.test(f)) return 3;
  if (/\bbid\b/.test(f) || /\bq12h?\b/.test(f)) return 2;
  if (
    /\b(sid|qd|q24h?|once\s+(?:a\s+)?daily|once\s+(?:a\s+)?day|daily)\b/.test(f)
  )
    return 1;

  return null;
}

function addDaysIso(startIso: string, days: number): string | null {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute an estimated course end. Returns null when there isn't enough
 * structured information to estimate one (no start date, or neither a duration
 * nor a dose-count-plus-frequency). A null result means "leave ended_on as the
 * document stated it (possibly null / ongoing)" — never a silent expiry.
 */
export function estimateCourseEnd(
  input: CourseDurationInput,
): CourseDurationResult | null {
  const start = input.started_on;
  if (!start || typeof start !== "string") return null;
  if (Number.isNaN(new Date(start).getTime())) return null;

  // 1) Explicit day span wins.
  if (
    input.duration_days != null &&
    Number.isFinite(input.duration_days) &&
    input.duration_days > 0
  ) {
    const days = Math.round(input.duration_days);
    const ended = addDaysIso(start, days);
    if (!ended) return null;
    return { ended_on: ended, basis: "duration_days", duration_days: days };
  }

  // 2) Dose count + frequency.
  if (
    input.total_doses != null &&
    Number.isFinite(input.total_doses) &&
    input.total_doses > 0
  ) {
    const perDay = dosesPerDayFromFrequency(input.frequency);
    if (perDay && perDay > 0) {
      const days = Math.ceil(input.total_doses / perDay);
      if (days > 0) {
        const ended = addDaysIso(start, days);
        if (!ended) return null;
        return {
          ended_on: ended,
          basis: "doses_and_frequency",
          duration_days: days,
        };
      }
    }
  }

  return null;
}
