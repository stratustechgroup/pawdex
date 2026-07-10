# Insurance feature verification

Scope: every insurance function and flow Pawdex ships. Verified behaviorally
against the live Supabase project and the real OpenRouter key, using two
committed test scripts plus targeted source review. All test writes are
namespaced under a throwaway ZZTEST household and auth user that are deleted in
a finally block; the one real household and pet were confirmed untouched after
each run.

## How to reproduce

```
pnpm dlx tsx scripts/test-insurance-calculator.ts   # pure, no network
pnpm dlx tsx scripts/test-insurance-live.ts         # live DB + a few real LLM calls
```

`test-insurance-live.ts` self-loads `.env.local`, neutralizes the `server-only`
virtual module, and substitutes `@/lib/supabase/server` with a service client
for the authorization gate and the cookie-bound DB-read helpers (see note under
section 3/4). RESEND_API_KEY is empty in this environment by design; the graceful
no-key path is asserted and the send HTTP layer is exercised with a scoped
`fetch` stub that intercepts only `api.resend.com`. Latest run: calculator 30/30
checks pass, live suite 70/70 assertions pass.

Execution vs inspection: everything marked PASS below is executed. The
`requireSession` + FormData server-action wrappers themselves (`createClaim`,
`updateClaim`, `deleteClaim`, `createCostEstimate`, `deleteCostEstimate`,
`createInsurancePolicy`, `archiveInsurancePolicy`, `retryPolicyExtraction`, and
the clarify/quote action files) cannot run outside a Next request, so their
FormData parsing and redirects are inspection-verified while the DB contract and
library functions they call are executed. Pure render branches (appeal CTA,
empty states, the "Pending extraction" retry card) are inspection-verified.

## Verification matrix

| # | Feature | How verified | Result |
|---|---------|--------------|--------|
| 1 | Policy upload -> extraction | Built a synthetic declarations PDF with pdf-lib (deductible, reimbursement %, annual max, PEC language), uploaded to the `documents` bucket, inserted document + placeholder policy rows, ran `processPolicyExtraction` end to end (real Sonnet tier). | PASS. insurer_name replaced the placeholder; deductible/rate/annual-max extracted with citations; exclusions captured. |
| 1a | PEC text pre-pass -> tagPecSpans -> fragment | `extractTextSample` read the PDF text layer (909 chars, 1 page); `tagPecSpans` tagged 4 spans including the curable-with-waiting clause. | PASS. |
| 1b | Prefilter metadata on audit row | Read the `commit_extraction` audit row; `diff.after.pec_prefilter` = `{span_count:4, categories:[lookback-window, curable-with-waiting, bilateral-extension], char_count:909, page_count:1}`. | PASS. Metadata lands as designed. |
| 2 | OOP calculator (`computeTrueOop`) | 10 pure-function scenarios: mid-deductible, unmet deductible, over annual limit, zero remaining limit, reimbursement==cap boundary, null rate, null deductible, out-of-range rate clamp, non-finite inputs, negative gross. | PASS (30 assertions). Math is correct and degrades safely on every null/garbage input. |
| 3 | Insurer clarification: draft | `draftInsurerClarification` (real LLM) returned a valid `{subject, body}`; subject <=120 chars, body >=40 chars, neutral tone (no demand/advocacy language). | PASS. |
| 3 | Insurer clarification: send gating | `sendInsurerClarification` without the grant returned `authorization_missing`; after granting, returned ok, wrote an `outbound_emails` row with the `authorization_id` FK, `recipient_type=insurer`, `template_id=insurer-clarification.v1`, persisted subject/body matching the draft. | PASS. |
| 3 | Insurer clarification: no-key + send payload | No-key path recorded status `drafted`, null resend id. Fetch-stub path: exactly one call to api.resend.com with correct `to`/`subject`/`text`; row transitioned to `sent` with the returned `resend_message_id`. | PASS. |
| 4 | Vet quote request | Same treatment: refusal without `records_request_to_vets`; granted path wrote outbound row (correct clinic email, html+text) and a `cost_estimates` row in `pending_vet_response` linked via `request_email_id`; clinic with no email returned `no_clinic_email`; fetch-stub confirmed the api.resend.com payload carries both html and text. | PASS. |
| 5 | Claims CRUD + status + attachments | Create (drafted) -> submitted -> partially_approved with amounts persisted; delete removes the row. `claim_attachments` insert/read works and the `attachment_type` CHECK rejects bad values; deleting the claim cascade-deletes attachments. Insert without a pet is rejected by the NOT NULL column (mirrors the household-policy guard in `createClaim`). | PASS at the data layer. See gap G1 on the attachment UI. |
| 6a | PEC heuristic matcher | Ran `analyzePECForHousehold` against a seeded "Hip dysplasia diagnosis (bilateral)" event; it flagged that event against the "hip dysplasia" exclusion with token overlap `{hip, dysplasia}` = 2 (MIN_OVERLAP). | PASS. The deterministic token-overlap half works. |
| 6 | PEC Tier-2 refinement | `refinePECAnalysis` (real LLM) over a realistic 2-event fixture: classified the hip-dysplasia-vs-hip-dysplasia-exclusion pair as `match` and the ear-cropping-vs-dental-cleaning pair as `false_positive`, one verdict per event with rationales. | PASS. The false-positive filter works as intended. |
| 7 | RLS fail-closed | Anon client reads of `insurance_policies`, `cost_estimates`, `claims`, `claim_attachments` scoped to our household returned zero rows. | PASS. |
| 8 | Manual policy create / archive / list | Inserted a policy via the create-policy DB contract (rate stored as a 0..1 decimal, exclusions as a line array); `listInsurancePolicies` included it and joined the pet name; after setting `archived_at` the policy dropped out of the active list while the row persisted. | PASS. Archive is a soft delete. See gap G2. |
| 8a | Retry extraction | `retryPolicyExtraction` resets the document to `pending` and re-invokes `processPolicyExtraction` (the exact pipeline verified in row 1). Inspection-verified wrapper + executed pipeline. | PASS (by composition). |

## What is production-ready vs rough

Production-ready:

- The OOP calculator core. Pure, correct across every edge case tried, and safe
  on null/garbage input.
- Policy extraction including the newly wired PEC prefilter. It produces sane
  structured output and the prefilter metadata is auditable on the commit row.
- Both outbound flows (insurer clarification, vet quote). Authorization gating
  is enforced before anything is drafted-to-send or sent, the outbound_emails
  audit trail is written with the authorization FK, the no-key failure is
  graceful, and the send payloads are correct.
- Claims data model and RLS. Household scoping, status transitions, the
  household-policy guard, and fail-closed anon reads all hold.
- PEC Tier-2 refinement. The LLM correctly downgrades token-overlap false
  positives.

Rough / not fully built:

- Claim attachments have no UI (gap G1).
- Policies can be created and archived but not edited or hard-deleted (gap G2).
- Rich extracted fields (deductible_type, reimbursement_basis, per-clause PEC,
  waiting periods) are computed then dropped because no columns exist (F2), so
  the calculator can't honor schedule-basis or per-condition-lifetime plans.
- The deductible-remaining default is derived from the wrong quantity (F1).

## Findings (nothing outright broken; these are gaps, latent risks, and modeling questions)

Every flow that exists works. I did not change working financial or
consent-gated code speculatively. The items below are for the team to decide on.

### G1 - `claim_attachments` is unwired end to end (my lane)
The `claim_attachments` table, RLS, and CHECK constraint exist and work (tested),
but no code path writes or reads it. `claims/[claimId]/page.tsx` renders no
attachment UI, and there is no action to link a medical event or document to a
claim. The task's "attachment linking" and "detail render for no/many/deleted
attachments" cases therefore have nothing to exercise in the product. This is an
unbuilt feature, not a regression. Building it (a link/unlink action plus a
render block that tolerates a deleted document target) is the highest-value next
step for claims.

### G2 - policies can be created and archived but never edited or hard-deleted (my lane)
The manual policy surface is create (`createInsurancePolicy`), soft-archive
(`archiveInsurancePolicy` sets `archived_at`, verified to drop the policy from the
active list), and re-extract (`retryPolicyExtraction`). There is no update action
and no hard-delete action, and no root `[policyId]` detail/edit page. So a user
who mistypes a manually-entered policy, or wants to correct a bad extraction
field, cannot edit it; their only recourse is archive-and-recreate. Archived rows
also accumulate with no purge path. Both are reasonable MVP limits, but "edit a
policy" is a likely near-term ask and worth an explicit decision.

### F1 - deductible-remaining derivation uses the wrong quantity (my lane: estimate page + `createCostEstimate`)
Both `app/(app)/insurance/[policyId]/estimate/page.tsx` and the `createCostEstimate`
action derive remaining deductible as `deductible_annual_cents - ytd.approved_cents`.
`approved_cents` is the insurer-approved reimbursement total, which is not what
consumes a deductible. A deductible is met by the owner's covered spend
(roughly `min(billed, deductible)` per claim), so subtracting approved
reimbursement understates how much of the deductible has actually been met. The
YTD aggregation lives in `lib/db/policy-ytd.ts` (outside my lane), but the
derivation and the user-facing default live in my files. Recommend deciding the
intended semantics with the data-model owner before changing the math, since the
output is a dollar figure users act on.

### F2 - extraction captures `deductible_type`, `reimbursement_basis`, `pec_clauses`, and per-category waiting periods but they are dropped, never persisted (demonstrated)
The extraction schema and prompt make the model classify `deductible_type`
(annual / per_incident / per_condition_lifetime, e.g. Trupanion),
`reimbursement_basis` (invoice / schedule / usual_and_customary), the per-clause
`pec_clauses` array, and `waiting_period_{accident,illness,orthopedic,cruciate}_days`.
But `insurance_policies` has no columns for any of them, `processPolicyExtraction`
does not write them, and it also never sets `raw_extraction`. The live test
asserts this directly: after a real extraction the policy row has no
`deductible_type` / `reimbursement_basis` keys and `raw_extraction` is null, so
these fields are computed (paid for) and then discarded with no way to recover
them. Two consequences: (a) the calculator can never honor per-condition-lifetime
deductibles or schedule-basis reimbursement, so a `schedule` plan's estimate
overstates what the insurer pays (the prompt itself calls this "the single
biggest source of I-thought-I'd-get-more complaints"); (b) the richer PEC clause
classification that the prefilter+LLM produce is thrown away, so downstream PEC
matching can't use it. Fix needs a migration (out of my lane) to add columns or
persist `raw_extraction`, then wire the calculator to read them. Recommend the
data-model owner add the columns; I can then wire the estimate + calculator.

### R1 - `updateClaim` null-clobbers omitted columns (latent, my lane)
`updateClaim` sets every column from `formData` unconditionally, so any control
that posts a partial form would null the sibling fields. The current claim detail
page posts one full form with every field, so this is not triggered today. It
becomes a silent-data-loss bug the moment a partial form is added (for example a
status-only "mark submitted" quick action). Worth hardening to "only set keys
present in the form" if such a control is ever introduced.

### C1 - clarification draft runs before the authorization exists (product decision, my lane)
`draftClarificationAction` runs the LLM and returns a draft, then reads the
authorization only to set a UI flag; the send button is disabled until the grant
exists. Sending is fail-closed, so no email can leave without consent. But the
`insurer_clarification_emails` scope text is worded to cover drafting itself
("draft ... for my approval before sending"), so producing insurer-directed
content before the grant is a consent-ordering nuance. The current behavior is a
reasonable preview-then-consent UX and I left it as is; flag it if legal/consent
wants drafting gated too.

### Architecture note (not a bug)
The outbound functions look "pure" (they take explicit householdId/userId) but
their authorization check flows through `getEffectiveAuthorization`, which uses
the cookie-bound RLS server client. That is correct in production (actions run
inside a request) but means these functions cannot be unit-called outside a
request without substituting that client. The live test script does exactly that
substitution for the gate, which is faithful because the gate filters by
household_id; cross-household isolation is proven separately by the anon RLS
checks in section 7.

## Out-of-lane observations for other agents

- `lib/db/policy-ytd.ts` (data-model / dashboard team): see F1. The
  approved-vs-billed deductible semantics originate here.
- `supabase/migrations` (data-model team): F2 needs columns on
  `insurance_policies` for `deductible_type`, `reimbursement_basis`,
  `pec_clauses`, and the four `waiting_period_*_days`, or `processPolicyExtraction`
  should at least persist `raw_extraction`. Once columns exist I can wire the
  calculator and estimate UI to use them.
- Nothing else outside my lane surfaced during this pass.
