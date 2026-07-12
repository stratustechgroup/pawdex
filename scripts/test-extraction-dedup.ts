/**
 * Behavioral unit tests for the pure entity-dedup matchers.
 *
 * Run:  pnpm dlx tsx scripts/test-extraction-dedup.ts
 *
 * These matchers are the heart of "don't re-ingest records we already have".
 * A broken matcher type-checks perfectly but silently returns zero matches,
 * so SPEC-conformance checking is useless — only behavioral assertions with
 * synthetic known-overlap data prove the logic works.
 *
 * No test framework. Plain check(cond, msg) + pass/fail counters. Exits
 * nonzero on any failure so CI can gate on it.
 */

import {
  matchVaccines,
  matchMedicalEvents,
  matchMedications,
  matchWeights,
  matchLabValues,
  findIntraBatchDuplicateEvents,
  sameClinic,
  isHighConfidence,
  canonicalVaccineFamily,
  VACCINE_DATE_WINDOW_DAYS,
  EVENT_DATE_WINDOW_DAYS,
  MIN_TITLE_TOKEN_OVERLAP,
  type VaccineCandidate,
  type ExistingVaccine,
  type MedicalEventCandidate,
  type ExistingMedicalEvent,
  type MedicationCandidate,
  type ExistingMedication,
  type MatchStrength,
} from "../lib/db/extraction-dedup-match";
import { inferFamilyFromType } from "../lib/clinical/vaccine-catalog";

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

// ── factories (keep tsc happy + fixtures readable) ──────────────────
let idCounter = 0;
function nextId(): string {
  return `id-${++idCounter}`;
}

function existingVaccine(
  o: Partial<ExistingVaccine> & {
    vaccine_type: string;
    vaccine_family: string | null;
    administered_on: string;
  },
): ExistingVaccine {
  return {
    id: nextId(),
    expires_on: null,
    vet_clinic_id: null,
    vet_clinic_name: null,
    document_id: null,
    ...o,
  };
}

function existingEvent(
  o: Partial<ExistingMedicalEvent> & {
    event_type: string;
    title: string;
    occurred_on: string;
  },
): ExistingMedicalEvent {
  return {
    id: nextId(),
    vet_clinic_id: null,
    vet_clinic_name: null,
    document_id: null,
    ...o,
  };
}

function existingMed(
  o: Partial<ExistingMedication> & {
    name: string;
    started_on: string;
  },
): ExistingMedication {
  return {
    id: nextId(),
    generic_name: null,
    dose: "",
    frequency: null,
    ended_on: null,
    medication_context: "",
    ...o,
  };
}

// Sanity: assert the constants are what the tests assume.
check(
  VACCINE_DATE_WINDOW_DAYS === 3,
  `VACCINE_DATE_WINDOW_DAYS expected 3, got ${VACCINE_DATE_WINDOW_DAYS}`,
);
check(
  EVENT_DATE_WINDOW_DAYS === 1,
  `EVENT_DATE_WINDOW_DAYS expected 1, got ${EVENT_DATE_WINDOW_DAYS}`,
);
check(
  MIN_TITLE_TOKEN_OVERLAP === 2,
  `MIN_TITLE_TOKEN_OVERLAP expected 2, got ${MIN_TITLE_TOKEN_OVERLAP}`,
);

// ════════════════════════════════════════════════════════════════════
// VACCINES
// ════════════════════════════════════════════════════════════════════

// Scenario 1 — the real fixture (Hillcrest PIMS vs Cleveland Park SOAP).
{
  const existing: ExistingVaccine[] = [
    existingVaccine({
      vaccine_type: "Canine Rabies Annual Vaccine",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    }),
  ];
  const candidates: VaccineCandidate[] = [
    {
      vaccine_type: "Rabies sq right hip",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    },
  ];
  const res = matchVaccines(candidates, existing);
  const m = res.get(0);
  check(res.size === 1, `S1: expected 1 candidate matched, got ${res.size}`);
  check(!!m && m.length === 1, `S1: expected exactly 1 match, got ${m?.length}`);
  check(
    m?.[0]?.match_strength === "exact",
    `S1: expected strength "exact", got "${m?.[0]?.match_strength}"`,
  );
  check(
    !!m && isHighConfidence(m[0].match_strength),
    `S1: expected isHighConfidence true for the match`,
  );
}

// Scenario 2 — same family, 2 days apart (within 3-day window) → strong.
{
  const existing = [
    existingVaccine({
      vaccine_type: "Rabies Vaccine",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    }),
  ];
  const candidates: VaccineCandidate[] = [
    {
      vaccine_type: "Rabies",
      vaccine_family: "rabies",
      administered_on: "2025-01-11",
    },
  ];
  const res = matchVaccines(candidates, existing);
  const m = res.get(0);
  check(m?.length === 1, `S2: expected exactly 1 match, got ${m?.length}`);
  check(
    m?.[0]?.match_strength === "strong",
    `S2: expected strength "strong", got "${m?.[0]?.match_strength}"`,
  );
}

// Scenario 3 — same family, 5 days apart (outside window) → no match.
{
  const existing = [
    existingVaccine({
      vaccine_type: "Rabies Vaccine",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    }),
  ];
  const candidates: VaccineCandidate[] = [
    {
      vaccine_type: "Rabies",
      vaccine_family: "rabies",
      administered_on: "2025-01-14",
    },
  ];
  const res = matchVaccines(candidates, existing);
  check(res.size === 0, `S3: expected 0 matches (outside window), got ${res.size}`);
}

// Scenario 4 — different families, same day → no match.
// vaccine_type strings have no substring relationship either direction.
{
  const existing = [
    existingVaccine({
      vaccine_type: "Distemper/Parvo",
      vaccine_family: "dhpp",
      administered_on: "2025-01-09",
    }),
  ];
  const candidates: VaccineCandidate[] = [
    {
      vaccine_type: "Rabies",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    },
  ];
  const res = matchVaccines(candidates, existing);
  check(
    res.size === 0,
    `S4: expected 0 matches (different families, no type overlap), got ${res.size}`,
  );
}

// Scenario 5 — family null on both, vaccine_type substring overlap, same day → loose.
{
  const existing = [
    existingVaccine({
      vaccine_type: "Bordetella Oral",
      vaccine_family: null,
      administered_on: "2025-01-09",
    }),
  ];
  const candidates: VaccineCandidate[] = [
    {
      vaccine_type: "Bordetella",
      vaccine_family: null,
      administered_on: "2025-01-09",
    },
  ];
  const res = matchVaccines(candidates, existing);
  const m = res.get(0);
  check(m?.length === 1, `S5: expected exactly 1 match, got ${m?.length}`);
  check(
    m?.[0]?.match_strength === "loose",
    `S5: expected strength "loose", got "${m?.[0]?.match_strength}"`,
  );
  check(
    !!m && !isHighConfidence(m[0].match_strength),
    `S5: expected isHighConfidence false for loose match`,
  );
}

// Scenario 6 — empty inputs.
{
  const existing = [
    existingVaccine({
      vaccine_type: "Rabies",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    }),
  ];
  const candidate: VaccineCandidate[] = [
    {
      vaccine_type: "Rabies",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    },
  ];
  const emptyExisting = matchVaccines(candidate, []);
  const emptyCandidates = matchVaccines([], existing);
  check(emptyExisting.size === 0, `S6: empty existing → empty map, got ${emptyExisting.size}`);
  check(
    emptyCandidates.size === 0,
    `S6: empty candidates → empty map, got ${emptyCandidates.size}`,
  );
}

// ════════════════════════════════════════════════════════════════════
// MEDICAL EVENTS
// ════════════════════════════════════════════════════════════════════

// Scenario 7 — same day, near-synonym titles → match on intestinal+parasite.
// "Check"/"Examination" are stopwords → only 2 non-stopword tokens overlap →
// exact needs >=3, so this is "strong".
{
  const existing = [
    existingEvent({
      event_type: "exam",
      title: "Intestinal Parasite Examination",
      occurred_on: "2025-03-01",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "exam",
      title: "Intestinal Parasite Check",
      occurred_on: "2025-03-01",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  const m = res.get(0);
  check(m?.length === 1, `S7: expected exactly 1 match, got ${m?.length}`);
  check(
    !!m && m[0].token_overlap.length === 2,
    `S7: expected 2 overlapping tokens, got ${m?.[0]?.token_overlap.length} (${m?.[0]?.token_overlap})`,
  );
  check(
    m?.[0]?.match_strength === "strong",
    `S7: expected strength "strong" (same day, 2 tokens), got "${m?.[0]?.match_strength}"`,
  );
}

// Scenario 8 — same day, unrelated titles → no token overlap → no match.
{
  const existing = [
    existingEvent({
      event_type: "procedure",
      title: "Nail Trim",
      occurred_on: "2025-03-01",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "procedure",
      title: "Dental Cleaning",
      occurred_on: "2025-03-01",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  check(res.size === 0, `S8: expected 0 matches (0 token overlap), got ${res.size}`);
}

// Scenario 9 — 2 days apart (outside 1-day event window), identical title → no match.
{
  const existing = [
    existingEvent({
      event_type: "exam",
      title: "Intestinal Parasite Examination",
      occurred_on: "2025-03-01",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "exam",
      title: "Intestinal Parasite Examination",
      occurred_on: "2025-03-03",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  check(
    res.size === 0,
    `S9: expected 0 matches (outside 1-day event window), got ${res.size}`,
  );
}

// Scenario 10 — stopword-only overlap → all tokens filtered → no match.
{
  const existing = [
    existingEvent({
      event_type: "exam",
      title: "Annual Wellness Visit",
      occurred_on: "2025-03-01",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "exam",
      title: "Annual Wellness Exam",
      occurred_on: "2025-03-01",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  check(
    res.size === 0,
    `S10: expected 0 matches (all tokens are stopwords), got ${res.size}`,
  );
}

// ── ingestion v2: same-visit awareness (SOAP note + itemized invoice) ──
//
// The founder's real 2025-08-15 duplication: the same visit arrived as a SOAP
// note AND an itemized invoice, both at Hillcrest Animal Hospital. The exam is
// worded "Office Visit - Professional Consultation" on one and "Annual physical"
// on the other — zero shared non-stopword tokens — so token overlap alone
// missed it. Same day + same clinic + exam type now makes it "strong".

// Scenario 10a — same wording gap as S10, but now WITH a matching clinic on
// both sides → same-visit → strong (was 0 in S10).
{
  const existing = [
    existingEvent({
      event_type: "exam",
      title: "Office Visit - Professional Consultation",
      occurred_on: "2025-08-15",
      vet_clinic_name: "Hillcrest Animal Hospital",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "exam",
      title: "Annual Wellness Exam",
      occurred_on: "2025-08-15",
      clinic_name: "Hillcrest Animal Hospital",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  const m = res.get(0);
  check(m?.length === 1, `S10a: expected 1 same-visit match, got ${m?.length}`);
  check(
    m?.[0]?.match_strength === "strong",
    `S10a: expected "strong" (clinic+day+exam), got "${m?.[0]?.match_strength}"`,
  );
  check(
    !!m && isHighConfidence(m[0].match_strength),
    `S10a: same-visit match should be high-confidence (pre-skipped)`,
  );
}

// Scenario 10b — GUARD: distinct lab panels the same day at the same clinic
// (IDEXX CBC vs 4Dx) are NOT duplicates. lab_result is not singleton-per-visit,
// and titles don't overlap → no match. This is the over-collapse we must avoid.
{
  const existing = [
    existingEvent({
      event_type: "lab_result",
      title: "IDEXX CBC",
      occurred_on: "2025-08-15",
      vet_clinic_name: "Hillcrest Animal Hospital",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "lab_result",
      title: "LAB 4Dx PLUS",
      occurred_on: "2025-08-15",
      clinic_name: "Hillcrest Animal Hospital",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  check(
    res.size === 0,
    `S10b: distinct same-day labs must NOT collapse, got ${res.size}`,
  );
}

// Scenario 10c — GUARD: a neuter and a dental extraction the same day at the
// same clinic are distinct procedures. Different types + no token overlap → no
// match even with same clinic + same day.
{
  const existing = [
    existingEvent({
      event_type: "surgery",
      title: "Neuter Canine",
      occurred_on: "2025-10-01",
      vet_clinic_name: "Hillcrest Animal Hospital",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "dental",
      title: "Dental Extractions",
      occurred_on: "2025-10-01",
      clinic_name: "Hillcrest Animal Hospital",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  check(
    res.size === 0,
    `S10c: distinct same-day procedures must NOT collapse, got ${res.size}`,
  );
}

// Scenario 10d — same-visit requires the SAME clinic. Same day, exam type, no
// token overlap, but DIFFERENT clinics → no match (a second-opinion visit).
{
  const existing = [
    existingEvent({
      event_type: "exam",
      title: "Office Visit - Professional Consultation",
      occurred_on: "2025-08-15",
      vet_clinic_name: "Hillcrest Animal Hospital",
    }),
  ];
  const candidates: MedicalEventCandidate[] = [
    {
      event_type: "exam",
      title: "Annual Wellness Exam",
      occurred_on: "2025-08-15",
      clinic_name: "Cleveland Park Animal Hospital",
    },
  ];
  const res = matchMedicalEvents(candidates, existing);
  check(
    res.size === 0,
    `S10d: same-visit needs same clinic; different clinics → no match, got ${res.size}`,
  );
}

// sameClinic helper — substring tolerance for fuller clinic names.
check(
  sameClinic("Cleveland Park Animal Hospital", "Cleveland Park Animal Hospital Simpsonville"),
  `sameClinic: fuller name variant should match`,
);
check(
  !sameClinic("Hillcrest Animal Hospital", "Cleveland Park Animal Hospital"),
  `sameClinic: distinct clinics should not match`,
);
check(
  !sameClinic(null, "Hillcrest Animal Hospital"),
  `sameClinic: null clinic never matches`,
);

// ── ingestion v2: intra-batch dedup (one document repeats an event) ────
//
// Real failure: a single PIMS export emitted "Patient check-in" 5x and
// "DECIDUOUS TEETH, RETAINED" 3x. The cross-record matchers never compare
// candidates against each other, so all copies were inserted.

// IB1 — "Patient check-in" x5 (exam) → indices 1..4 all duplicate index 0.
{
  const candidates: MedicalEventCandidate[] = Array.from({ length: 5 }, () => ({
    event_type: "exam",
    title: "Patient check-in",
    occurred_on: "2025-08-15",
    clinic_name: "Hillcrest Animal Hospital",
  }));
  const dupes = findIntraBatchDuplicateEvents(candidates);
  check(dupes.size === 4, `IB1: expected 4 in-batch dupes, got ${dupes.size}`);
  check(
    dupes.get(1) === 0 && dupes.get(4) === 0,
    `IB1: later copies should chain to the first (index 0)`,
  );
  check(!dupes.has(0), `IB1: the first occurrence is kept (not a dupe)`);
}

// IB2 — "DECIDUOUS TEETH, RETAINED" x3 (dental), identical titles → dupes via
// title equality even though dental is not singleton-per-visit.
{
  const candidates: MedicalEventCandidate[] = Array.from({ length: 3 }, () => ({
    event_type: "dental",
    title: "DECIDUOUS TEETH, RETAINED",
    occurred_on: "2025-08-15",
    clinic_name: "Hillcrest Animal Hospital",
  }));
  const dupes = findIntraBatchDuplicateEvents(candidates);
  check(dupes.size === 2, `IB2: expected 2 in-batch dupes, got ${dupes.size}`);
}

// IB3 — GUARD: distinct lab panels in one batch (CBC, 4Dx, chem), same day +
// clinic, different titles → NO intra-batch dupes.
{
  const candidates: MedicalEventCandidate[] = [
    { event_type: "lab_result", title: "IDEXX CBC", occurred_on: "2025-08-15", clinic_name: "Hillcrest" },
    { event_type: "lab_result", title: "LAB 4Dx PLUS", occurred_on: "2025-08-15", clinic_name: "Hillcrest" },
    { event_type: "lab_result", title: "Pre-Anesthetic Chem Panel", occurred_on: "2025-08-15", clinic_name: "Hillcrest" },
  ];
  const dupes = findIntraBatchDuplicateEvents(candidates);
  check(dupes.size === 0, `IB3: distinct same-day labs must NOT collapse in-batch, got ${dupes.size}`);
}

// IB4 — two exams, one visit, worded differently (SOAP+invoice merged into one
// upload) → the later exam duplicates the earlier via the same-visit signal.
{
  const candidates: MedicalEventCandidate[] = [
    { event_type: "exam", title: "Office Visit - Professional Consultation", occurred_on: "2025-08-15", clinic_name: "Hillcrest Animal Hospital" },
    { event_type: "exam", title: "Annual physical", occurred_on: "2025-08-15", clinic_name: "Hillcrest Animal Hospital" },
  ];
  const dupes = findIntraBatchDuplicateEvents(candidates);
  check(dupes.get(1) === 0, `IB4: second exam should duplicate the first (same visit)`);
}

// ════════════════════════════════════════════════════════════════════
// MEDICATIONS
// ════════════════════════════════════════════════════════════════════

// Scenario 11 — "Apoquel (oclacitinib) 16mg tablet" vs "Apoquel", same start
// date → SPEC expects match, strength "exact" (normalizeMedName should strip
// parens + dose forms down to "apoquel").
{
  const existing = [
    existingMed({
      name: "Apoquel",
      started_on: "2025-02-01",
    }),
  ];
  const candidates: MedicationCandidate[] = [
    {
      name: "Apoquel (oclacitinib) 16mg tablet",
      generic_name: null,
      started_on: "2025-02-01",
    },
  ];
  const res = matchMedications(candidates, existing);
  const m = res.get(0);
  check(
    m?.length === 1,
    `S11: expected exactly 1 match (normalized "apoquel"), got ${m?.length}`,
  );
  check(
    m?.[0]?.match_strength === "exact",
    `S11: expected strength "exact", got "${m?.[0]?.match_strength}"`,
  );
}

// Scenario 12 — different drugs → no match.
{
  const existing = [
    existingMed({
      name: "Carprofen",
      started_on: "2025-02-01",
    }),
  ];
  const candidates: MedicationCandidate[] = [
    {
      name: "Apoquel",
      generic_name: null,
      started_on: "2025-02-01",
    },
  ];
  const res = matchMedications(candidates, existing);
  check(res.size === 0, `S12: expected 0 matches (different drugs), got ${res.size}`);
}

// Scenario 13 — same drug, started_on 5 days apart (outside 3-day window) → no match.
{
  const existing = [
    existingMed({
      name: "Apoquel",
      started_on: "2025-02-01",
    }),
  ];
  const candidates: MedicationCandidate[] = [
    {
      name: "Apoquel",
      generic_name: null,
      started_on: "2025-02-06",
    },
  ];
  const res = matchMedications(candidates, existing);
  check(
    res.size === 0,
    `S13: expected 0 matches (5 days apart, outside med window), got ${res.size}`,
  );
}

// Scenario 14 — candidate with null started_on, same drug name → match (no date constraint).
{
  const existing = [
    existingMed({
      name: "Apoquel",
      started_on: "2025-02-01",
    }),
  ];
  const candidates: MedicationCandidate[] = [
    {
      name: "Apoquel",
      generic_name: null,
      started_on: null,
    },
  ];
  const res = matchMedications(candidates, existing);
  const m = res.get(0);
  check(
    m?.length === 1,
    `S14: expected exactly 1 match (null start date, no date constraint), got ${m?.length}`,
  );
  check(
    m?.[0]?.match_strength === "loose",
    `S14: expected strength "loose" — a dateless name-match can't be confirmed as the same course vs a new one, so it surfaces a banner but must NOT pre-skip; got "${m?.[0]?.match_strength}"`,
  );
}

// ════════════════════════════════════════════════════════════════════
// CUMULATIVE-HISTORY SCALE TEST — the volume case
// ════════════════════════════════════════════════════════════════════

// Scenario 15 — 10 vaccine candidates: 4 exactly duplicate existing rows,
// 6 are genuinely new (distinct families AND no type-substring overlap with
// any existing row, all well outside any date window from existing rows).
{
  // The 4 existing rows that should be re-detected as duplicates.
  const existing: ExistingVaccine[] = [
    existingVaccine({
      vaccine_type: "Rabies Vaccine",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    }),
    existingVaccine({
      vaccine_type: "DHPP Booster",
      vaccine_family: "dhpp",
      administered_on: "2025-01-09",
    }),
    existingVaccine({
      vaccine_type: "Bordetella Oral",
      vaccine_family: "bordetella",
      administered_on: "2025-02-15",
    }),
    existingVaccine({
      vaccine_type: "Leptospirosis 4-way",
      vaccine_family: "lepto",
      administered_on: "2025-03-20",
    }),
  ];

  const candidates: VaccineCandidate[] = [
    // 4 duplicates — same family + same day → exact (high confidence).
    {
      vaccine_type: "Rabies",
      vaccine_family: "rabies",
      administered_on: "2025-01-09",
    },
    {
      vaccine_type: "DHPP",
      vaccine_family: "dhpp",
      administered_on: "2025-01-09",
    },
    {
      vaccine_type: "Bordetella",
      vaccine_family: "bordetella",
      administered_on: "2025-02-15",
    },
    {
      vaccine_type: "Lepto",
      vaccine_family: "lepto",
      administered_on: "2025-03-20",
    },
    // 6 genuinely new — distinct families, distinct non-overlapping types,
    // and dates far from any existing row.
    {
      vaccine_type: "Lyme Disease",
      vaccine_family: "lyme",
      administered_on: "2025-06-01",
    },
    {
      vaccine_type: "Canine Influenza H3N8",
      vaccine_family: "influenza",
      administered_on: "2025-06-01",
    },
    {
      vaccine_type: "Rattlesnake Toxoid",
      vaccine_family: "crotalus",
      administered_on: "2025-07-04",
    },
    {
      vaccine_type: "Coronavirus",
      vaccine_family: "ccv",
      administered_on: "2025-08-10",
    },
    {
      vaccine_type: "Giardia",
      vaccine_family: "giardia",
      administered_on: "2025-09-12",
    },
    {
      vaccine_type: "Feline Calicivirus",
      vaccine_family: "calici",
      administered_on: "2025-10-22",
    },
  ];

  const res = matchVaccines(candidates, existing);

  check(
    res.size === 4,
    `S15: expected exactly 4 candidates matched, got ${res.size}`,
  );

  // The 4 duplicates are candidate indices 0-3; all high confidence.
  for (const idx of [0, 1, 2, 3]) {
    const m = res.get(idx);
    check(
      !!m && m.length >= 1 && isHighConfidence(m[0].match_strength),
      `S15: candidate ${idx} expected a high-confidence match, got strength "${m?.[0]?.match_strength}"`,
    );
    check(
      m?.[0]?.match_strength === "exact",
      `S15: candidate ${idx} expected "exact", got "${m?.[0]?.match_strength}"`,
    );
  }

  // The 6 new ones are candidate indices 4-9; none should be present.
  for (const idx of [4, 5, 6, 7, 8, 9]) {
    check(
      !res.has(idx),
      `S15: candidate ${idx} is genuinely new but was matched (false positive)`,
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// S16 — THE MOTIVATING CASE: cross-clinic re-wording with NULL stored family.
// The production path infers family on BOTH sides (page.tsx for the candidate,
// the extraction-dedup wrapper for the existing row). This simulates that:
// the existing DB row has vaccine_family = null and a long-form type string;
// the wrapper resolves it via inferFamilyFromType. Neither type string
// contains the other, so ONLY family-match can link them. If the existing
// row's family weren't inferred, this silently re-ingests the duplicate —
// the exact failure the two uploaded test PDFs were meant to catch.
// ════════════════════════════════════════════════════════════════════
{
  // Existing row as stored: family null, cross-worded type.
  const storedType = "Canine Rabies Annual Vaccine";
  const existing = [
    existingVaccine({
      vaccine_type: storedType,
      // The wrapper does `vaccine_family ?? inferFamilyFromType(type)`; here
      // the stored family is null, so it resolves to the inferred value.
      vaccine_family: inferFamilyFromType(storedType),
      administered_on: "2025-01-09",
    }),
  ];
  // Candidate as built in page.tsx: family inferred from a differently-worded
  // type that shares NO substring with the stored type.
  const candType = "Rabies sq right hip";
  const candidates: VaccineCandidate[] = [
    {
      vaccine_family: inferFamilyFromType(candType),
      vaccine_type: candType,
      administered_on: "2025-01-09",
    },
  ];
  // Sanity: both strings must resolve to the same family, else the premise
  // is broken.
  check(
    inferFamilyFromType(storedType) === "rabies" &&
      inferFamilyFromType(candType) === "rabies",
    `S16: both type strings must infer family "rabies" (got "${inferFamilyFromType(storedType)}" / "${inferFamilyFromType(candType)}")`,
  );
  const res = matchVaccines(candidates, existing);
  const m = res.get(0);
  check(
    m?.length === 1,
    `S16: cross-clinic re-wording with null stored family must match, got ${m?.length}`,
  );
  check(
    m?.[0]?.match_strength === "exact" && isHighConfidence(m?.[0]?.match_strength),
    `S16: must be exact + high-confidence (same family + same day), got "${m?.[0]?.match_strength}"`,
  );
}

// ════════════════════════════════════════════════════════════════════
// S17 — TS-vs-SQL family divergence: the SQL generated column
// (vaccine_family_of, migration 0005) stamps 'canine_influenza' on stored
// rows, while a candidate may still carry the catalog label 'civ'. The
// matcher runs both through canonicalVaccineFamily (which mirrors SQL), so
// 'civ' → 'canine_influenza' on both sides and they family-match with no
// alias band-aid. Note the type strings share no substring, so — like the
// rabies S16 case — ONLY family-match can link them.
// ════════════════════════════════════════════════════════════════════
{
  const existing = [
    existingVaccine({
      vaccine_type: "Canine Influenza Bivalent H3N2/H3N8",
      vaccine_family: "canine_influenza", // as stamped by the SQL generated column
      administered_on: "2026-03-10",
    }),
  ];
  const candidates: VaccineCandidate[] = [
    {
      vaccine_family: "civ", // catalog-namespace label on the candidate side
      vaccine_type: "CIV vaccine sq",
      administered_on: "2026-03-10",
    },
  ];
  const res = matchVaccines(candidates, existing);
  const m = res.get(0);
  check(
    m?.length === 1,
    `S17: 'civ' vs 'canine_influenza' must family-match via canonicalVaccineFamily, got ${m?.length ?? 0} matches`,
  );
  check(
    m?.[0]?.match_strength === "exact",
    `S17: same family + same day must be exact, got "${m?.[0]?.match_strength}"`,
  );
}

// ════════════════════════════════════════════════════════════════════
// S17b — AGREEMENT: canonicalVaccineFamily(name) must equal exactly what the
// SQL generated column public.vaccine_family_of() (migration 0005) would
// produce for the same string. This is THE guard that keeps the single TS
// parser from drifting away from the DB's stored family values — any drift
// silently breaks dedup for the affected vaccine (the family-compare fails,
// the default-skip never fires, and a duplicate dose lands).
//
// The expected column below is hand-derived from the SQL CASE, honoring:
//   - first-LIKE-wins ordering (rabies before dhpp before …),
//   - literal substring matching (SQL is not a smart parser — "Distemper"
//     alone is NOT dhpp, "FLUVAC" is NOT canine_influenza, "Crotalus" is NOT
//     rattlesnake; each falls to the slug branch),
//   - the else slug: lower(regexp_replace(vt, '[^a-z0-9]+', '_', 'gi')) with
//     no trimming of leading/trailing separators.
// If you change either the SQL function or the TS parser, update this table.
// ════════════════════════════════════════════════════════════════════
{
  const AGREEMENT: Array<[input: string, sqlFamily: string]> = [
    // rabies (wins even when other families co-occur)
    ["Rabies", "rabies"],
    ["Canine Rabies Annual Vaccine", "rabies"],
    ["3-year rabies", "rabies"],
    ["Rabies DHPP combo", "rabies"], // ordering: rabies clause first
    // dhpp group — only the four literal substrings match
    ["DHPP", "dhpp"],
    ["DA2PP", "dhpp"],
    ["DHLPP", "dhpp"],
    ["DAPP", "dhpp"],
    ["Distemper DAPP", "dhpp"],
    ["DAPPv", "dhpp"], // contains "dapp"
    ["Distemper", "distemper"], // NO dhpp/dapp substring → slug, NOT dhpp
    // bordetella
    ["Bordetella", "bordetella"],
    ["Kennel Cough", "bordetella"],
    ["INBORD", "inbord"], // PIMS code, not "bordetella" → slug
    // leptospirosis
    ["Lepto", "leptospirosis"],
    ["Leptospirosis", "leptospirosis"],
    ["Lepto-4", "leptospirosis"],
    // canine influenza — SQL keys on 'influenza' or 'civ' only
    ["Canine Influenza", "canine_influenza"],
    ["CIV", "canine_influenza"],
    ["civ", "canine_influenza"], // catalog label round-trips into SQL namespace
    ["Bivalent Flu", "bivalent_flu"], // "flu" != "influenza" → slug
    ["FLUVAC", "fluvac"], // → slug, NOT canine_influenza
    // lyme
    ["Lyme", "lyme"],
    ["Lyme Disease Vaccine", "lyme"],
    ["Borrelia", "lyme"],
    // rattlesnake — literal only
    ["Rattlesnake", "rattlesnake"],
    ["Crotalus", "crotalus"], // → slug, NOT rattlesnake
    // feline
    ["FVRCP", "fvrcp"],
    ["FRCP", "fvrcp"],
    ["FeLV", "felv"],
    ["Feline Leukemia", "feline_leukemia"], // → slug, NOT felv
    ["FIV", "fiv"],
    // giardia
    ["Giardia", "giardia"],
    // slug fallback edge cases
    ["SNAP 4Dx", "snap_4dx"],
    ["Vanguard Plus 5", "vanguard_plus_5"],
    ["Misc. Vaccine!", "misc_vaccine_"], // trailing separator survives
  ];
  for (const [input, expected] of AGREEMENT) {
    const got = canonicalVaccineFamily(input);
    check(
      got === expected,
      `S17b: canonicalVaccineFamily("${input}") must equal SQL "${expected}", got "${got}"`,
    );
  }
  // null in → null out (SQL: `when vt is null then null`)
  check(
    canonicalVaccineFamily(null) === null &&
      canonicalVaccineFamily(undefined) === null,
    "S17b: null/undefined input must return null (mirrors SQL null branch)",
  );
}

// ════════════════════════════════════════════════════════════════════
// S18-S19 — WEIGHTS. Same-day near-identical → exact (pre-skip). Same-day
// divergent → loose (surface only — could be a legit re-measurement).
// Different day → no match (day-to-day fluctuation is real signal).
// ════════════════════════════════════════════════════════════════════
{
  const existing = [
    { id: "w1", recorded_on: "2026-02-14", weight_kg: 29.12, document_id: null },
  ];
  // S18a: same day, within 0.05 kg → exact
  let res = matchWeights(
    [{ recorded_on: "2026-02-14", weight_kg: 29.15 }],
    existing,
  );
  check(
    res.get(0)?.[0]?.match_strength === "exact",
    `S18a: same-day ±0.03kg must be exact, got "${res.get(0)?.[0]?.match_strength}"`,
  );
  // S18b: same day, 0.8 kg apart → loose (never pre-skipped)
  res = matchWeights(
    [{ recorded_on: "2026-02-14", weight_kg: 29.9 }],
    existing,
  );
  check(
    res.get(0)?.[0]?.match_strength === "loose" &&
      !isHighConfidence(res.get(0)![0].match_strength),
    `S18b: same-day divergent reading must be loose/not-preskipped, got "${res.get(0)?.[0]?.match_strength}"`,
  );
  // S19: next day, identical value → NO match
  res = matchWeights(
    [{ recorded_on: "2026-02-15", weight_kg: 29.12 }],
    existing,
  );
  check(
    !res.has(0),
    `S19: different-day weight must not match (got ${res.get(0)?.length ?? 0})`,
  );
}

// ════════════════════════════════════════════════════════════════════
// S20-S21 — LAB VALUES. Same analyte (normalized) + same date + equal value
// → exact. Same analyte + date, different value → loose (possible corrected
// result — must never pre-skip). Different analyte or date → no match.
// ════════════════════════════════════════════════════════════════════
{
  const existing = [
    {
      id: "l1",
      analyte: "Creatinine",
      value: 0.9,
      units: "mg/dL",
      collected_on: "2026-02-14",
      document_id: null,
    },
  ];
  // S20a: normalization — "CREATININE " matches "Creatinine", equal value → exact
  let res = matchLabValues(
    [{ analyte: "CREATININE ", collected_on: "2026-02-14", value: 0.9 }],
    existing,
  );
  check(
    res.get(0)?.[0]?.match_strength === "exact",
    `S20a: normalized analyte + equal value must be exact, got "${res.get(0)?.[0]?.match_strength}"`,
  );
  // S20b: same analyte + date, DIFFERENT value → loose (corrected result must stay visible)
  res = matchLabValues(
    [{ analyte: "Creatinine", collected_on: "2026-02-14", value: 1.4 }],
    existing,
  );
  check(
    res.get(0)?.[0]?.match_strength === "loose" &&
      !isHighConfidence(res.get(0)![0].match_strength),
    `S20b: differing value must be loose/not-preskipped, got "${res.get(0)?.[0]?.match_strength}"`,
  );
  // S21a: different analyte, same date → NO match
  res = matchLabValues(
    [{ analyte: "ALT", collected_on: "2026-02-14", value: 48 }],
    existing,
  );
  check(!res.has(0), `S21a: different analyte must not match`);
  // S21b: same analyte, different date → NO match
  res = matchLabValues(
    [{ analyte: "Creatinine", collected_on: "2026-05-20", value: 0.9 }],
    existing,
  );
  check(!res.has(0), `S21b: different collection date must not match`);
}

// ── summary ─────────────────────────────────────────────────────────
console.log("");
console.log(`Assertions passed: ${passed}`);
console.log(`Assertions failed: ${failed}`);
if (failed > 0) {
  console.log("");
  console.log("Failed assertions:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("");
console.log(
  failed === 0
    ? "RESULT: ALL ASSERTIONS PASSED"
    : `RESULT: ${failed} ASSERTION(S) FAILED`,
);

process.exit(failed > 0 ? 1 : 0);
