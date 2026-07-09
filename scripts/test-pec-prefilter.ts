/**
 * Test harness for the PEC pre-filter.
 *
 * Run with: pnpm dlx tsx scripts/test-pec-prefilter.ts
 *
 * Verifies three scenarios:
 *   (a) the canonical sample policy text yields 4+ tagged spans across the
 *       expected categories (definition / lookback-window / curable-with-waiting
 *       / bilateral-extension)
 *   (b) a clean coverage paragraph that mentions no PEC language at all
 *       produces zero spans
 *   (c) the prompt fragment renders correctly for the sample case
 */

import { tagPecSpans, pecPromptFragment } from "../lib/insurance/pec-prefilter";
import type { PecClauseCategory } from "../lib/insurance/pec-prefilter";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_POLICY = `A pre-existing condition is any illness, injury, or condition that
your pet showed signs of before the policy effective date. Conditions
that manifested in the 12 months prior to coverage are excluded.
However, curable conditions that have been symptom-free for 180 days
may be eligible for coverage as a new condition. Bilateral conditions
(such as cranial cruciate ligament tears) are treated as one
condition — if one knee is affected, the other knee is also
considered pre-existing.`;

const CLEAN_COVERAGE = `Your policy covers accidents and illnesses subject to your selected
deductible and reimbursement level. Wellness visits, vaccinations, and
routine dental cleanings can be added through the optional preventive
care package. Claims may be submitted through the mobile app or web
portal, and reimbursement is typically processed within five business
days of approval.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let failed = false;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failed = true;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

function categoryPresent(
  cats: PecClauseCategory[],
  target: PecClauseCategory,
): boolean {
  return cats.includes(target);
}

// ---------------------------------------------------------------------------
// Test (a) — sample policy text
// ---------------------------------------------------------------------------

console.log("=".repeat(72));
console.log("(a) Sample policy text");
console.log("=".repeat(72));
console.log();
console.log("Input:");
console.log(SAMPLE_POLICY);
console.log();

const sampleSpans = tagPecSpans(SAMPLE_POLICY);

console.log(`Spans tagged: ${sampleSpans.length}`);
console.log();
for (let i = 0; i < sampleSpans.length; i++) {
  const s = sampleSpans[i];
  console.log(`  Span ${i + 1} [${s.start}–${s.end}]  category_hint=${s.category_hint}`);
  console.log(`    matched: ${s.matched_phrases.join(", ")}`);
  console.log(`    text: ${JSON.stringify(s.text.slice(0, 120))}${s.text.length > 120 ? "..." : ""}`);
  console.log();
}

const sampleCats = sampleSpans.map((s) => s.category_hint);

// Aggregate every phrase label across all spans — used to verify that the
// definitional signal phrase was caught even if priority demoted it under a
// stronger co-occurring category (per spec, lookback-window > definition).
const allPhrases = new Set<string>();
for (const s of sampleSpans) {
  for (const p of s.matched_phrases) allPhrases.add(p);
}

console.log("Assertions:");
assert(sampleSpans.length >= 4, `at least 4 spans tagged (got ${sampleSpans.length})`);
// Definition phrase MUST be detected, even if priority rules surface
// 'lookback-window' as the hint for that sentence — the LLM still sees the
// definition phrase in matched_phrases and can reclassify.
assert(
  allPhrases.has("pre-existing condition means"),
  "the 'pre-existing condition means' definition phrase is detected",
  `got phrases: ${Array.from(allPhrases).join(", ")}`,
);
assert(
  categoryPresent(sampleCats, "lookback-window"),
  "a 'lookback-window' span is present",
  `got categories: ${sampleCats.join(", ")}`,
);
assert(
  categoryPresent(sampleCats, "curable-with-waiting"),
  "a 'curable-with-waiting' span is present (the false-positive guard)",
  `got categories: ${sampleCats.join(", ")}`,
);
assert(
  categoryPresent(sampleCats, "bilateral-extension"),
  "a 'bilateral-extension' span is present",
  `got categories: ${sampleCats.join(", ")}`,
);
assert(
  !categoryPresent(sampleCats, "permanent"),
  "the curable clause is NOT mis-tagged as 'permanent'",
  `got categories: ${sampleCats.join(", ")}`,
);

// Spot-check: span offsets resolve back to the source text exactly.
for (let i = 0; i < sampleSpans.length; i++) {
  const s = sampleSpans[i];
  const reSlice = SAMPLE_POLICY.slice(s.start, s.end);
  assert(
    reSlice === s.text,
    `span ${i + 1} offsets round-trip to its text`,
    `expected ${JSON.stringify(s.text)}, got ${JSON.stringify(reSlice)}`,
  );
}

console.log();

// ---------------------------------------------------------------------------
// Test (b) — clean coverage paragraph
// ---------------------------------------------------------------------------

console.log("=".repeat(72));
console.log("(b) Clean coverage paragraph (should be 0 spans)");
console.log("=".repeat(72));
console.log();
console.log("Input:");
console.log(CLEAN_COVERAGE);
console.log();

const cleanSpans = tagPecSpans(CLEAN_COVERAGE);
console.log(`Spans tagged: ${cleanSpans.length}`);
if (cleanSpans.length > 0) {
  for (const s of cleanSpans) {
    console.log(`  unexpected: [${s.start}–${s.end}] ${s.category_hint}`);
    console.log(`    matched: ${s.matched_phrases.join(", ")}`);
    console.log(`    text: ${JSON.stringify(s.text)}`);
  }
}
console.log();
console.log("Assertions:");
assert(cleanSpans.length === 0, `clean text produces zero spans (got ${cleanSpans.length})`);
console.log();

// ---------------------------------------------------------------------------
// Test (c) — prompt fragment output
// ---------------------------------------------------------------------------

console.log("=".repeat(72));
console.log("(c) Prompt fragment for the sample policy");
console.log("=".repeat(72));
console.log();
const fragment = pecPromptFragment(sampleSpans);
console.log(fragment);
console.log();

console.log("Assertions:");
assert(
  fragment.includes("PEC"),
  "fragment mentions 'PEC'",
);
assert(
  fragment.includes("curable-with-waiting"),
  "fragment mentions 'curable-with-waiting' so the LLM knows the category exists",
);
assert(
  fragment.includes("Span 1"),
  "fragment numbers the spans",
);
assert(
  fragment.includes("category_hint"),
  "fragment exposes the category_hint to the LLM",
);

// Empty-spans variant
const emptyFragment = pecPromptFragment([]);
assert(
  emptyFragment.includes("no PEC signal phrases"),
  "empty-spans fragment instructs the LLM not to invent PEC clauses",
);

console.log();
console.log("=".repeat(72));
if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
} else {
  console.log("RESULT: PASS");
}
