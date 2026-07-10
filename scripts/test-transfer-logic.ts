/**
 * Behavioral tests for the pure transfer logic — specifically documentsToMove,
 * which decides which documents follow a pet through an ownership transfer.
 *
 * Run:  pnpm dlx tsx scripts/test-transfer-logic.ts
 *
 * This mirrors the exclusivity predicate baked into transfer_animal() (migration
 * 0026). The rule is subtle and the SQL version only runs against a live DB in
 * the integration pass, so the pure function is where we prove the behavior:
 * a document moves ONLY when every association it has points solely at the
 * transferred pet. A wrong predicate type-checks fine and silently moves (or
 * strands) the wrong documents, so type-checking alone is worthless here.
 *
 * No test framework. Plain check(cond, msg) + counters. Exits nonzero on any
 * failure so CI can gate on it.
 */

import {
  documentsToMove,
  type DocumentAssociation,
} from "../lib/db/transfer-logic";

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

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

const PET = "pet-transferred";
const OTHER = "pet-other";

// ── fixtures + assertions ───────────────────────────────────────────

// 1. Direct pet_id set to the transferred pet, no links → moves.
check(
  sameSet(
    documentsToMove(
      [{ documentId: "d1", directPetId: PET, linkedPetIds: [] }],
      PET,
    ),
    ["d1"],
  ),
  "direct pet_id only, this pet → moves",
);

// 2. Linked exclusively to the transferred pet (no direct pet_id) → moves.
check(
  sameSet(
    documentsToMove(
      [{ documentId: "d2", directPetId: null, linkedPetIds: [PET] }],
      PET,
    ),
    ["d2"],
  ),
  "link-only to this pet → moves",
);

// 3. Direct pet_id set AND a link to another pet → stays (multi-pet).
check(
  documentsToMove(
    [{ documentId: "d3", directPetId: PET, linkedPetIds: [OTHER] }],
    PET,
  ).length === 0,
  "direct this pet + link to another pet → stays",
);

// 4. Linked to this pet AND another pet → stays (shared doc).
check(
  documentsToMove(
    [{ documentId: "d4", directPetId: null, linkedPetIds: [PET, OTHER] }],
    PET,
  ).length === 0,
  "linked to this pet and another → stays",
);

// 5. Not associated with the transferred pet at all → stays.
check(
  documentsToMove(
    [{ documentId: "d5", directPetId: OTHER, linkedPetIds: [OTHER] }],
    PET,
  ).length === 0,
  "unrelated document → stays",
);

// 6. Direct pet_id on another pet even if also linked to this pet → stays.
//    (The direct pet_id is itself an association to another pet.)
check(
  documentsToMove(
    [{ documentId: "d6", directPetId: OTHER, linkedPetIds: [PET] }],
    PET,
  ).length === 0,
  "direct pet_id on another pet + link to this pet → stays",
);

// 7. Redundant association (direct + link both to this pet) → moves once.
check(
  sameSet(
    documentsToMove(
      [{ documentId: "d7", directPetId: PET, linkedPetIds: [PET] }],
      PET,
    ),
    ["d7"],
  ),
  "direct + link both to this pet → moves",
);

// 8. Mixed batch → only the exclusive ones move, no duplicates.
check(
  sameSet(
    documentsToMove(
      [
        { documentId: "a", directPetId: PET, linkedPetIds: [] },
        { documentId: "b", directPetId: PET, linkedPetIds: [OTHER] },
        { documentId: "c", directPetId: null, linkedPetIds: [PET] },
        { documentId: "d", directPetId: null, linkedPetIds: [OTHER] },
        { documentId: "e", directPetId: null, linkedPetIds: [] },
      ],
      PET,
    ),
    ["a", "c"],
  ),
  "mixed batch → only exclusive docs move",
);

// ── report ──────────────────────────────────────────────────────────
console.log(`\ntransfer-logic: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("✓ transfer logic behavioral tests passed");
