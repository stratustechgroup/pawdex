// Quick smoke test for the PIMS classifier. Run with:
//   pnpm dlx tsx scripts/test-pims-classifier.ts
//
// Logs expected-vs-actual for one synthetic snippet per family plus a couple
// of edge cases (unknown, low-signal). Exits 0 if everything matched; exits 1
// otherwise so it can be wired into CI later.

import {
  classifyPimsFromText,
  pimsPromptFragment,
  type PimsFamily,
} from "../lib/ai/pims-classifier";

type Case = {
  name: string;
  text: string;
  expected: PimsFamily;
  /** Minimum confidence we expect; the test fails if actual < this. */
  minConfidence: number;
};

const CASES: Case[] = [
  {
    name: "IDEXX Cornerstone — patient history export",
    expected: "cornerstone",
    minConfidence: 0.7,
    text: `
      IDEXX Cornerstone Practice Management
      Patient History Report
      Patient ID: 10293     Client ID: 5421
      Name: Buddy   Species: Canine   Breed: Labrador   Sex: MN   DOB: 03/14/2018
      ----------------------------------------------------------------------
      Medical Notes
      03/22/2026 — Annual wellness exam. Heart and lungs unremarkable.
      Vaccines administered: Rabies (3yr), DA2PP.
      Page 1 of 4                                            Cornerstone
    `,
  },
  {
    name: "Covetrus AVImark — Medical History table",
    expected: "avimark",
    minConfidence: 0.7,
    text: `
      AVImark Practice Management System
      Medical History
      Date        Code       Description                          Qty     Amount
      03/22/2026  EXM-COMP   Comprehensive Exam                   1       65.00
      03/22/2026  VAC-RAB    Rabies Vaccine 3yr                   1       28.50
      03/22/2026  LAB-CBC    Complete Blood Count                 1       54.00
      McAllister Software Systems  |  AVImark(R)
    `,
  },
  {
    name: "Covetrus eVetPractice — browser-printed SOAP",
    expected: "evetpractice",
    minConfidence: 0.7,
    text: `
      eVetPractice — Patient Record
      Visit: 03/22/2026
      S: Owner reports lethargy and reduced appetite for 2 days.
      O: T 102.4F, HR 110, RR 28. Abdominal palpation mildly tense.
      A: Suspected GI upset, rule out FB.
      P: Empirical antiemetic, recheck in 48h, recommend rads if no improvement.
      https://clinic.evetpractice.com/medical/record/8821     Page 2 of 5
    `,
  },
  {
    name: "IDEXX ezyVet — date-grouped card",
    expected: "ezyvet",
    minConfidence: 0.7,
    text: `
      ezyVet Cloud Practice Management
      Clinic: Bright Paws Veterinary
      Patient: Milo   Owner: J. Farmer
      ----------------------------------------------------------------------
      22 Mar 2026   JF
      Consultation Notes
      Routine annual exam. Weight 12.4 kg. Vaccinations up to date.
      Created by: JF
    `,
  },
  {
    name: "Generic SOAP export — no vendor branding",
    expected: "soap_export",
    minConfidence: 0.7,
    text: `
      Visit Date: 03/22/2026
      S: Patient presented for routine checkup.
      O: BAR. Vitals within normal limits.
      A: Healthy adult canine.
      P: Continue current diet, return in 12 months.
    `,
  },
  {
    name: "Unknown — random unrelated text",
    expected: "unknown",
    minConfidence: 0,
    text: `
      Receipt for parking validation. Lot B, 2 hours, $4.00.
      Thank you for visiting downtown Greenville.
    `,
  },
  {
    name: "Low-signal Cornerstone (single hit)",
    expected: "cornerstone",
    minConfidence: 0.4,
    text: `
      Welcome to our practice — exported from Cornerstone today.
      Visit summary attached on following pages.
    `,
  },
];

function fmt(n: number): string {
  return n.toFixed(2);
}

function main(): number {
  let failures = 0;
  console.log("=".repeat(72));
  console.log("PIMS classifier smoke test");
  console.log("=".repeat(72));

  for (const c of CASES) {
    const result = classifyPimsFromText(c.text);
    const familyOk = result.family === c.expected;
    const confOk = result.confidence >= c.minConfidence;
    const passed = familyOk && confOk;
    if (!passed) failures += 1;

    console.log(`\n[${passed ? "PASS" : "FAIL"}] ${c.name}`);
    console.log(`  expected family : ${c.expected}  (min conf ${fmt(c.minConfidence)})`);
    console.log(`  actual family   : ${result.family}  (conf ${fmt(result.confidence)})`);
    console.log(`  matched signals : ${result.matched_signals.length ? result.matched_signals.join(", ") : "(none)"}`);
    if (passed && result.family !== "unknown") {
      const fragment = pimsPromptFragment(result.family);
      const firstLine = fragment.split("\n")[0];
      console.log(`  prompt fragment : ${firstLine}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Summary: ${CASES.length - failures}/${CASES.length} cases passed`);
  console.log("=".repeat(72));
  return failures === 0 ? 0 : 1;
}

export default function runTests(): number {
  return main();
}

// Run immediately when invoked directly via tsx.
const exitCode = main();
process.exit(exitCode);
