# Document ingestion pipeline

How an uploaded document becomes reviewed, committed pet-health data. This
covers the medical-records path (vaccines, meds, events, labs, weights) and
notes where the insurance-policy path diverges.

## End-to-end flow

```
upload (client)
  │  file lands in Supabase Storage
  ▼
createDocument  (app/(app)/pets/[petId]/upload/actions.ts)
  │  1. sha256 content-hash of ORIGINAL bytes → short-circuit exact duplicates
  │  2. preprocessUploadedFile (lib/ingest/preprocess.ts)
  │       • HEIC/HEIF → JPEG (vision models can't read HEIC)
  │       • encrypted PDF → hard fail up front (Claude rejects + poisons convo)
  │  3. insert documents row (processing_status = 'pending')
  ▼
after()  →  processDocumentExtraction  (lib/ai/extraction-trigger.ts)
  │  download bytes, flip status → 'extracting'
  │
  ├─ size gate (up front, before any model call):
  │     • > 50 MB              → hard fail (over Gemini inline cap)
  │     • > tier-3 Claude cap  → see "Fail-fast size caps" below
  │
  ├─ TEXT PRE-PASS  (lib/ingest/text-prepass.ts)   ← new subsystem
  │     extractTextSample(bytes, mime) → { text, charCount, pageCount } | null
  │     • PDFs with a real text layer → text sample
  │     • images / scanned PDFs / any failure → null (non-fatal)
  │
  ├─ CLASSIFIERS (only when a text sample exists)
  │     • classifyPimsFromText  → PIMS family + confidence
  │     • detectForm51          → NASPHV rabies certificate?
  │     → assemble prompt fragments (see "Prompt fragment system")
  │
  ▼
extractDocument  (lib/ai/extract-document.ts)
  │  3-tier LLM ladder via OpenRouter + AI SDK generateObject:
  │     tier 1  gemini-2.5-flash-lite
  │     tier 2  gemini-2.5-flash
  │     tier 3  claude-sonnet-4.5
  │  escalates on: Zod-invalid output, provider error, confidence < 0.85.
  │  system prompt = core (prompts/v1.ts) + injected fragments.
  ▼
document_extractions row (status = 'pending_review')
  │  raw_response = { tier, result, metadata }   ← metadata is new
  ▼
human review  (review-form.tsx)  →  commitExtraction  (review/actions.ts)
  │  dedup matchers surface likely duplicates; user accepts/edits/skips
  │  committed rows → vaccinations / medications / medical_events / labs / weights
  ▼
document status = 'confirmed'
```

## Text pre-pass: what fires when

The pre-pass is the missing subsystem the classifiers were written for. Before
it existed, `classifyPimsFromText`, `detectForm51`, and `tagPecSpans` all took a
`textSample: string` but nothing ever produced one, so they were dead code. The
pipeline sent raw bytes straight to the vision models.

`extractTextSample` reads the embedded PDF text layer with `unpdf` (a
serverless-friendly PDF.js build). It is **not OCR**. Decision table:

| Input | Text sample? | Classifiers run? | Fragments injected? |
|---|---|---|---|
| Digital PDF with text layer | yes | yes | when a PIMS or Form 51 is detected |
| Scanned PDF (image-only, little/no text) | no (null) | no | no |
| Image (JPEG/PNG/HEIC-converted) | no (null) | no | no |
| unpdf throws (corrupt/edge case) | no (null) | no | no |

Every failure path is non-fatal. When there is no text sample the pipeline
behaves exactly as it did before this change: raw bytes to the vision model,
with the filename rabies heuristic as the only tier-3 trigger.

`MIN_MEANINGFUL_CHARS` (100 non-whitespace chars) separates a real text layer
from a scanned page that yields a few stray characters.

## Prompt fragment system

`prompts/v1.ts` was a single ~240-line v6.1 mega-prompt. It is now split
(version bumped to **v7.0.0**):

- `EXTRACTION_CORE_PROMPT`: the always-on core. Document typing, format
  recognition (PIMS chart vs SOAP), citations, anesthesia roll-up, boilerplate
  exclusion, lab-value operators, date sanity, vaccine-family normalization.
  The core stays self-sufficient so the no-text path (images, scans) loses no
  rules.
- Conditionally injected fragments, appended under a clear header by
  `buildExtractionSystemPrompt(fragments)`:
  - `pimsPromptFragment(family)`: per-PIMS segmentation guidance
    (Cornerstone / AVImark / eVetPractice / ezyVet / generic SOAP). Injected
    when the classifier confidence is at least 0.7 (2+ signals).
  - `form51PromptFragment()`: NASPHV Form 51 field-anchoring for the
    legally-significant rabies-certificate fields (tag vs lot number, duration
    checkboxes, corrected next-due dates, producer codes).

Only PIMS-vendor-specific detail moved into fragments. Core extraction rules
stayed in the core on purpose: there is no behavioral test on prompt content, so
a dropped core rule would regress silently.

Which fragments fired is recorded in the extraction's
`raw_response.metadata.prompt_fragments` (for example `["pims:cornerstone",
"form51"]`), alongside the pre-pass char/page counts and the raw classifier
scores, so extraction quality can be debugged without re-running the pipeline.

## Tier-3 forcing

A document is forced straight to tier 3 (Claude) when any of:

- the caller explicitly requests it (`forceTier3`, e.g. manual re-extract),
- the filename looks like a rabies document (`isLikelyRabiesDocument`), or
- `detectForm51` fires on the text sample.

The filename heuristic remains the fallback for the no-text case (a scanned
rabies certificate never reaches `detectForm51`).

## Fail-fast size caps

Provider caps are now evaluated **up front**, before tier 1 runs, instead of
warning and letting a later tier 400 mid-ladder:

- `> 50 MB` (Gemini inline cap): hard fail immediately.
- `> tier-3 Claude cap` (32 MB PDF / 5 MB image):
  - if the document **must** run tier 3 (rabies / Form 51): **hard fail** with a
    "split it" message. A legally-significant document is never silently
    downgraded to a weaker model.
  - otherwise: cap the ladder at tier 2 up front and record the reason in
    `raw_response.metadata.tier_cap`. We do not pay for tiers 1-2 and then fail.

## Vaccine family: single source of truth

Family inference had drifted across two implementations (a TS regex parser and
the SQL `vaccine_family_of()` generated column), patched with a `FAMILY_ALIASES`
band-aid after a production dedup bug.

There is now exactly one parser: `canonicalVaccineFamily()` in
`lib/db/extraction-dedup-match.ts`, a faithful mirror of the SQL
`vaccine_family_of()` (migration 0005). Because stored `vaccination` rows carry
the SQL output as a `GENERATED ALWAYS` column, the SQL namespace is the fixed
point and the TS parser conforms to it (it emits `canine_influenza`, not `civ`;
`giardia`; and a slug fallback for unrecognized types). The dedup matcher and
the `extraction-dedup` wrapper call it directly, so both the candidate side and
the stored side land in the same namespace with no alias.

`inferFamilyFromType` in `lib/clinical/vaccine-catalog.ts` now delegates to the
same parser and does one thin remap into the catalog vocabulary
(`canine_influenza` → `civ`; storage families with no catalog entry → null) so
the expiry helpers and UI keep their stable `VaccineFamily` type. That keeps the
commit path's expiry math working (a CIV vaccine with no explicit expiry still
gets its 12-month catalog default).

`scripts/test-extraction-dedup.ts` pins this with an agreement table (S17b):
`canonicalVaccineFamily(name)` must equal what `vaccine_family_of()` produces for
the same string. Change the SQL function or the parser and the table must be
updated in lockstep.

One deliberate trade-off: inference is now literal-substring, exactly like SQL.
Non-canonical wordings that the SQL function does not recognize (for example
"Canine Flu" without "influenza"/"CIV", or "Distemper" without a DHPP/DAPP
token) resolve to a slug family rather than being smart-matched. This is
correct, because the DB itself stores the slug for those strings, so aligning
the parser keeps candidate and stored families comparable. The extraction prompt
already normalizes `vaccine_type` to canonical forms, so the real-world surface
is small.

## Extraction feedback: honest implicit signal

Every commit previously wrote an implicit `extraction_feedback` row rated
`mostly_good`, even when the user accepted the extraction untouched. That biased
the learning corpus toward "mostly_good" and drowned out real corrections.

Now an implicit feedback row is written **only when the user actually corrected
the extraction** (edited a field, skipped a row, or changed the vet clinic). An
untouched commit writes nothing. The `extraction_feedback_rating` enum has no
neutral value and we did not add one (no migration in this pass), so silence is
the honest option for an uncorrected commit. Explicit user ratings are always
recorded, unchanged.

## Insurance-policy path (separate)

The policy path is deliberately distinct and was **not** re-wired in this pass:

- entry point `lib/ai/policy-trigger.ts` → `lib/ai/extract-policy.ts`,
- its own schema (`policy-schema.ts`) and prompt (`prompts/policy-v1.ts`),
- tier-3 only (Sonnet), single-shot, no escalation ladder,
- sends raw bytes to the vision model.

`tagPecSpans` (`lib/insurance/pec-prefilter.ts`) was written to run on a policy
text sample and inject a PEC-classification fragment, mirroring the PIMS/Form 51
wiring on the medical path. It is not yet wired in. Doing so would mean adding a
text pre-pass to the policy trigger and threading a fragment into
`extractPolicy`. It is a self-contained follow-up.

### Known limitations / follow-ups

- **No OCR for scanned documents.** The pre-pass reads embedded text layers
  only. Scanned PDFs and photos fall back to the vision path with no classifier
  guidance. Adding an OCR fallback (so PIMS/Form 51 detection works on scans)
  is the largest open follow-up.
- **PEC prefilter not wired into the policy path** (above).
- **Batch API is a hint only.** Tier-1 `useBatch` sets a provider option;
  OpenRouter has no first-class Batch primitive in AI SDK 6 yet.
