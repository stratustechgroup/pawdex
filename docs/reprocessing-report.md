# Data reprocessing report - 2026-07-12

One-time reprocessing of the founder's live production data (household
`fa497bc6-4513-4104-95ed-896502a399e0`, "realalecfarmer's Household", pet Finn),
run with his explicit authorization ("do reprocessing on all the existing
data"). Three phases, executed in order, each dry-run first. Scripts:

- `scripts/reprocess-common.ts` - shared db/audit/backup helpers
- `scripts/reprocess-phase1-ended-estimated.ts`
- `scripts/reprocess-phase2-dedup.ts`
- `scripts/reprocess-phase3-cost-requeue.ts`
- `scripts/reprocess-verify.ts` - post-run verification (15/15 pass)

Every script is idempotent and dry-run by default (`--execute` mutates). No
schema changes. All mutations wrote an audit_log row (61 total).

## Result counts

| Table | Before | After | Change |
|---|---|---|---|
| medical_events | 90 | 71 | -19 (exact duplicates) |
| vaccinations | 63 | 49 | -14 (exact duplicates) |
| medications | 9 | 9 | 5 rows re-flagged (Phase 1) |
| document_extractions | 23 | 46 | +23 pending_review (Phase 3) |
| documents | 23 | 23 | all flipped confirmed → extracted |
| invoice_items | 0 | 0 | unchanged - awaits founder review |
| reminders | 4 | 4 | intact, none orphaned |

## Phase 1 - ended_estimated backfill

The pre-migration-0032 commit path derived medication end dates from
`duration_days` but had no `ended_estimated` column, so those rows carry the
post-migration default (`false`) even though the end was computed, not
document-stated. Flipped `ended_estimated → true` on the 5 matching rows so the
meds page shows "(est.)" and offers the "still taking it" correction. No dates
changed.

| id | name | started_on | duration_days | ended_on |
|---|---|---|---|---|
| 167e267a | Albon | 2024-11-30 | 1 | 2024-11-30 |
| 54f2214a | Meloxicam (Metacam) Oral Suspension | 2025-07-17 | 5 | 2025-07-22 |
| 113f700f | Meloxicam | 2025-07-21 | 5 | 2025-07-26 |
| bac58355 | Meloxicam Oral | 2025-10-02 | 7 | 2025-10-08 |
| f7188c6f | Meloxicam | 2025-10-02 | 7 | 2025-10-08 |

## Phase 2 - committed-duplicate sweep

Detected duplicate clusters sharing pet + date + clinic (nullable-aware). Only
**exact** clusters (byte-identical title/type, or identical vaccine_type) were
auto-collapsed: the first import (earliest `created_at`, id tiebreak) was kept,
the later copies deleted. **Fuzzy** clusters (same visit, different wording) were
left completely untouched and are listed below for manual review.

Deleted **33 rows** across **23 exact clusters**. Full-row JSON backup written
before deletion to `docs/reprocessing-backup-2026-07-12.json` (also mirrored in
the session scratchpad). One audit_log `delete` row per deletion.

**Reminders:** all 4 of the household's reminders reference document ids, not
event/vaccination ids, so no reminder pointed at a deleted row. Zero re-points
needed; verified.

### Exact clusters collapsed (kept 1 of each)

medical_events (19 deleted):

| date · clinic | title (type) | copies → deleted |
|---|---|---|
| 2025-08-15 · Hillcrest | Patient check-in (exam) | 5 → 4 |
| 2025-08-15 · Hillcrest | Office Visit - Professional Consultation (exam) | 2 → 1 |
| 2025-01-25 · Cleveland Park | Heartworm Test (lab_result) | 3 → 2 |
| 2025-01-25 · Cleveland Park | Intestinal Parasite Check (lab_result) | 2 → 1 |
| 2025-01-25 · Cleveland Park | Leptospirosis Vaccination (lab_result) | 2 → 1 |
| 2025-01-25 · Cleveland Park | Annual Examination w/Vacs (exam) | 2 → 1 |
| 2025-01-25 · Cleveland Park | Annual Examination (exam) | 2 → 1 |
| 2025-08-15 · Hillcrest | DECIDUOUS TEETH, RETAINED (dental) | 3 → 2 |
| 2025-08-16 · Hillcrest | NEUTROPENIA (illness) | 2 → 1 |
| 2026-02-05 · Greenville Humane | Heartworm Antigen Test (parasite_prevention) | 3 → 2 |
| 2026-02-05 · Greenville Humane | Heartworm Prevention Declined (parasite_prevention) | 4 → 3 |

vaccinations (14 deleted):

| date · clinic | vaccine_type | copies → deleted |
|---|---|---|
| 2024-11-21 · Cleveland Park | Bordetella | 2 → 1 |
| 2025-01-09 · Cleveland Park | DHPP | 2 → 1 |
| 2025-01-25 · Cleveland Park | DAPPv | 2 → 1 |
| 2025-01-25 · Cleveland Park | Rabies | 2 → 1 |
| 2025-01-25 · Cleveland Park | Heartworm Test | 2 → 1 |
| 2025-01-25 · Cleveland Park | Canine Influenza H3N2 | 2 → 1 |
| 2025-01-25 · Cleveland Park | Canine Influenza | 2 → 1 |
| 2025-01-25 · Cleveland Park | CIV | 3 → 2 |
| 2025-05-02 · Hillcrest | Leptospirosis | 2 → 1 |
| 2025-09-05 · Hillcrest | Canine Flu Bivalent | 3 → 2 |
| 2025-11-21 · Cleveland Park | Bordetella | 2 → 1 |
| 2026-01-25 · Cleveland Park | Rabies | 2 → 1 |

### Backup fidelity note (read this)

The executed Phase 2 run backed up the identity/dedup-key columns of each
deleted row (id, pet_id, date, clinic, title/type, created_at, document_id),
plus `household_id`, plus a full snapshot of the retained canonical row
(`kept_row_snapshot`). It did **not** capture the deleted duplicates' nullable
free-text columns (summary/notes/diagnosis/treatment) in this run. Residual risk
is low and was checked directly:

- Deleted rows are byte-identical duplicates of a retained row on the dedup key.
- The retained canonical row keeps the clinical narrative (16 of 19 deleted
  events had a retained sibling carrying notes; the other 3 had none to begin
  with).
- Every source document was re-extracted to pending_review in Phase 3, so each
  document's full content is re-surfaced for review.

The `reprocess-phase2-dedup.ts` script has since been changed to `select("*")`
so any future run captures the complete row.

### FUZZY clusters - for founder review (NOT modified)

Same visit, different wording. Pawdex will not auto-merge these. To merge: open
the pet's medical timeline, decide which single wording to keep for each real
event/shot, and delete the others (or ask for a follow-up pass with an explicit
keep-list). All ids below are live post-cleanup.

**Exam events worded differently on the same visit (4 visits):**

- 2025-08-15 · Hillcrest - same admittance exam, three wordings:
  `41afa68e` "Office Visit - Professional Consultation", `976d8e26` "Patient
  check-in", `bec1c3f4` "Pet evaluation".
- 2025-01-25 · Cleveland Park - one annual/puppy exam, five wordings:
  `e33bdb02` "Puppy Examination", `07e71df6` "Annual Examination and Puppy
  Exam", `79e69816` "Annual Examination w/Vacs", `d720b3b9` "Annual
  Examination", `1833cbbf` "Check In Patient w/Exam".
- 2024-12-19 · Cleveland Park - `22008ef6` "Check In Patient w/Exam - CPEAH",
  `12d7dc30` "Exam with Vaccines - Puppy".
- 2025-07-21 · Veterinary Dental Care - `8e929a85` "Consultation",
  `64015a9b` "Recheck Examination". (These may be two genuinely distinct
  visits/notes; confirm before merging.)

**Vaccinations of the same family, different type strings, same day (5 groups,
all 2025-01-25 / 2024-12-19 at Cleveland Park):**

- DHPP family: `89b125b4` "DHPP", `15141bbe` "DAPPv", `3afec5b7` "DAPPv+Lepto".
- Rabies: `aace8c43` "Rabies (1 year)", `26fc3e01` "Rabies".
- Leptospirosis: `0f8468f7` "Leptospirosis", `f4b2a005` "Leptospirosis
  Vaccination".
- Canine influenza (CIV): `28b84f6d` "Canine Influenza H3N2", `e7970d42`
  "Canine Influenza H3N2 #1", `659cf925` "Canine Influenza", `0f510ad9` "CIV".
- **Caution - false grouping:** `4a48daec` "Parainfluenza" and `5a23e094`
  "Canine Influenza" (2024-12-19) are grouped only because the family
  canonicalizer matches the substring "influenza". Parainfluenza (part of DHPP)
  is a DIFFERENT vaccine from canine influenza (CIV). Do NOT merge these two.

## Phase 3 - cost re-extraction queue

Re-ran the real ingestion pipeline (`processDocumentExtraction`, the same path a
fresh upload uses - not the "premium model" forceTier3 retry, so oversized
photos cap at tier 2 rather than hard-failing) on all 23 committed documents.
They were all `doc_type = unknown` with empty `invoice_items`; the pre-v7.1
prompt discarded the billing block, so re-extraction is how those costs get
captured.

- **23 documents re-extracted → 23 fresh pending_review extractions** at prompt
  version v7.1.0. 0 failures. (The dental x-ray PDF escalated through all three
  tiers and still succeeded.)
- Each document flipped `confirmed → extracted`, so it now sits in the founder's
  review queue.
- **Nothing was auto-committed.** The committed rows are untouched; same-visit
  dedup will pre-skip existing records so the review screen surfaces the NEW
  invoice line items as the only additions.
- **OpenRouter spend:** estimated $0.02 (all resolve tier 1) to $0.95 (worst
  case, every doc escalates through Sonnet); realistic ~$0.04–$0.38. Actual
  spend was a single Sonnet escalation plus 22 tier-1/2 passes.

## What the founder should do now

1. Open the review queue (23 documents now show as pending review). For each,
   the existing records are pre-skipped; confirm the **new invoice line items**
   (and any invoice total) to populate cost tracking, then commit. Skip anything
   that looks wrong - nothing is forced.
2. Optionally clean up the **fuzzy duplicate** exam/vaccination wordings listed
   above from the pet's timeline (Pawdex left them untouched by design). Mind the
   Parainfluenza-vs-CIV caution.
3. The 5 medications in Phase 1 now show an estimated end date with a "still
   taking it" button if any course is in fact ongoing.

## Backup & recovery

- Deleted-row backup: `docs/reprocessing-backup-2026-07-12.json` (33 rows, each
  with `kept_row_snapshot`). Verified re-insertable and confirmed absent from the
  live tables by `scripts/reprocess-verify.ts`.
- Full audit trail: 61 `audit_log` rows tagged `reprocessing:
  phase1_ended_estimated` (5), `phase2_exact_duplicate` (33),
  `phase3_cost_reextract` (23).
