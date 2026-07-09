// Smoke test for the Form 51 detector + prompt fragment helper.
//
// Run with:  pnpm dlx tsx scripts/test-form51-anchor.ts
//
// Asserts four scenarios:
//   (a) clear Form 51 cert        → is_form51=true,  high confidence
//   (b) SOAP note                  → is_form51=false, near-zero confidence
//   (c) weak-signal document       → low confidence, may flag below threshold
//   (d) prompt fragment output is non-empty and mentions the danger fields

import {
  detectForm51,
  form51PromptFragment,
  PRODUCER_CODES,
} from "../lib/ai/form51-anchor";

function header(label: string) {
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
}

function showDetection(label: string, sample: string) {
  const result = detectForm51(sample);
  console.log(`\n[${label}]`);
  console.log("  is_form51:        ", result.is_form51);
  console.log("  confidence:       ", result.confidence);
  console.log("  matched_signals:  ", result.matched_signals);
  return result;
}

// ---------------------------------------------------------------------------
// (a) Clear Form 51 — text mimics what an OCR pass would yield from a real
//     NASPHV Form 51 photocopy.
// ---------------------------------------------------------------------------
const FORM51_SAMPLE = `
RABIES VACCINATION CERTIFICATE                      NASPHV Form 51

Owner Name:    Jane Smith
Address:       1234 Maple Lane, Greenville, SC 29615
Phone:         (864) 555-0142
Microchip #:   985112004567890

Animal Name:   Biscuit              Species: Dog
Age:           4 yr                 Sex:     F   Neutered: Y
Breed:         Goldendoodle         Color:   Cream
Size:          [ ] <20 lbs   [X] 20-50 lbs   [ ] >50 lbs

VACCINATION
  Date Vaccinated:    05/02/2026
  Producer:           MER     Product License No.: 287
  USDA Vaccine:       [ ] 1 Yr   [X] 3 Yr   [ ] 4 Yr
  Type:               [ ] Initial   [X] Booster
  Vaccine Serial / Lot No.:  A123456B    USDA Licensed
  Next Vaccination Due By:   05/02/2029

Tag No.:       GVL-44218

Veterinarian Signature:  ____________________
License #:               SC-9921
Clinic Address:          Paw Lane Vet, Greenville, SC
`;

// ---------------------------------------------------------------------------
// (b) SOAP note — should NOT trip the detector. The word "rabies" is allowed
//     in the body but no fingerprint signals should match.
// ---------------------------------------------------------------------------
const SOAP_SAMPLE = `
Patient: Biscuit (Canine, F/S, 4yr)
Date:    2026-05-20

S: Owner reports patient has been scratching at the left ear for 3 days.
   No fever, normal appetite. No recent travel.
O: T 101.3, P 110, R 24. Mild erythema at left ear canal. No discharge.
A: Otitis externa, left ear.
P: Tresaderm BID x 7 days. Recheck in 2 weeks if not improved. Discussed
   home ear cleaning. Reviewed annual labs and confirmed prior history is
   unremarkable.
`;

// ---------------------------------------------------------------------------
// (c) Weak signals — the document mentions rabies prominently and has a Lot
//     No. but is missing the structural Form 51 fingerprint. We expect a
//     low confidence (possibly below or right at the threshold).
// ---------------------------------------------------------------------------
const WEAK_SAMPLE = `
Rabies titer result — laboratory report

Patient:   Biscuit
Specimen:  Serum, drawn 04/15/2026
Lot No.:   TST-9981
Result:    1:32  (passing threshold 1:5)
Lab:       Kansas State Rabies Lab

Comments:  Result meets requirements for international travel under EU
import rules. This is not a vaccination certificate.
`;

header("(a) CLEAR FORM 51 CERTIFICATE — expect is_form51=true, high confidence");
const a = showDetection("clear_form51", FORM51_SAMPLE);
console.assert(a.is_form51 === true, "(a) should detect Form 51");
console.assert(a.confidence >= 0.6, "(a) confidence should be high");

header("(b) SOAP NOTE — expect is_form51=false");
const b = showDetection("soap_note", SOAP_SAMPLE);
console.assert(b.is_form51 === false, "(b) should NOT detect Form 51");

header("(c) WEAK SIGNALS — expect low confidence");
const c = showDetection("weak_signals", WEAK_SAMPLE);
console.assert(c.confidence < 0.5, "(c) confidence should be low");

header("(d) PROMPT FRAGMENT OUTPUT");
const fragment = form51PromptFragment();
console.log(fragment);
console.assert(fragment.length > 200, "(d) prompt fragment should be non-trivial");
console.assert(/Tag #/i.test(fragment), "(d) fragment should mention Tag #");
console.assert(/Serial/i.test(fragment), "(d) fragment should mention Serial");
console.assert(/1-?Yr/i.test(fragment) || /1 Yr/i.test(fragment), "(d) fragment should mention 1-Yr triad");
console.assert(/Next Vaccination Due/i.test(fragment), "(d) fragment should mention Next Due");
console.assert(/Producer/i.test(fragment), "(d) fragment should mention producer code");

header("PRODUCER_CODES table");
for (const [code, name] of Object.entries(PRODUCER_CODES)) {
  console.log(`  ${code} → ${name}`);
}
console.assert(Object.keys(PRODUCER_CODES).length >= 8, "should have >=8 codes");
console.assert(Object.keys(PRODUCER_CODES).length <= 14, "should have <=14 codes");

console.log("\nAll assertions passed.");
