# Identity core (animals, custodianships, transfers, litters, research consent)

Phase 6.41. Migrations 0024 through 0027. This is the EXPAND half of an
expand-and-contract migration. Everything is additive; the existing app keeps
working unchanged.

## Why this exists

Today a `pets` row is both the identity of a creature and the tenancy anchor
(`pets.household_id` is not null and immutable in practice). That conflation
blocks three things Pawdex now needs:

1. Rehoming an animal to another household without losing its medical history.
2. Breeders holding many animals, grouping them into litters, and placing them.
3. An animal being co-held (breeder keeps a stake while a family raises it).

The fix is to split identity from tenancy:

- `animals` is the durable identity. It has NO `household_id`.
- `custodianships` link an animal to the household(s) that currently hold it,
  each with a role (`owner`, `breeder`, `foster`, `co_owner`) and a lifespan
  (`started_at` / `ended_at`). At most one active custodianship per
  (animal, household).

`pets` gets a nullable unique `animal_id` and stays the record anchor for now.
A mirror trigger keeps the linked `animals` row truthful whenever the legacy
pet-edit UI writes to `pets`, so the new table never drifts while the old UI
is live.

## Tables

- **0024 animals / custodianships**: identity + tenancy link, `pets.animal_id`,
  `is_animal_custodian(uuid)` RLS helper, the mirror trigger, and an in-migration
  backfill (one animal + owner custodianship per existing pet, idempotent on
  `pets.animal_id is null`).
- **0025 breeder foundations**: `households.kind` (`personal` | `breeder`),
  `litters`, `animals.litter_id` FK, `animals.placement_status`
  (`none` | `available` | `reserved` | `placed`).
- **0026 animal_transfers**: the tokenized handoff row + the atomic
  `transfer_animal(...)` function (see Transfer semantics).
- **0027 research consent**: `research_data_sharing` added to
  `authorization_type`; `research_consents` (household, optional animal, hard FK
  to the frozen `authorizations` row); `dataset_releases` /
  `dataset_release_items` (service-role-only audit trail of what actually
  shipped).

  Consent is modeled as two deliberately separate concerns (the Mars/Banfield
  split), and only ONE of them is represented in the schema:

  1. **Personally identifying information is never shared, period.** This is a
     product invariant, not a user-flippable toggle. No table or column here
     grants PII sharing, and none should be added. De-identification strips
     direct identifiers (owner name, contact, precise location) before any data
     leaves Pawdex.
  2. **De-identified aggregate participation** is a distinct, explicit opt-in
     that is revocable going forward. That — and only that — is what
     `research_consents` captures; `revoked_at` stops inclusion in future
     `dataset_releases` without recalling releases already shipped.

  `animals.microchip_number` (permanent implanted ID) is the natural
  de-identification anchor: a stable per-animal key that survives transfers
  across owners, so aggregate datasets can link/dedupe an animal without
  carrying any owner PII. Consent capture points (onboarding, adoption-transfer
  signup) are a later UI concern, not part of this phase.

## RLS

Follows the established `is_household_member` / `has_household_write` pattern.

- `animals`: read = you belong to a household with an active custodianship over
  the animal (`is_animal_custodian`); update = same, but you need write in that
  household. Insert/delete are service-role only — an animal is born together
  with its first custodianship, so there is no household to gate a bare
  authenticated insert on. The app creates animals via
  `createAnimalWithCustodianship` (service client), and the mirror trigger keeps
  them current thereafter.
- `custodianships`: read = members of the holding household; all writes
  service-role only (mirrors `household_members`).
- `litters`, `research_consents`: full household pattern.
- `animal_transfers`: origin-household members read; all writes service-role
  only. The public accept route re-hashes the URL token with the service client.
- `dataset_releases` / `dataset_release_items`: RLS on, no policies — fails
  closed for everyone but the service role.

## Transfer semantics — what moves, what stays

`transfer_animal(p_animal_id, p_to_household_id, p_transfer_id)` is a
security-definer function that runs as one atomic statement. It closes the
active owner custodianship, opens a new owner custodianship for the target
household, re-parents the pet's clinical record, and stamps + audits both sides.

The animal's **clinical record travels**. The origin household's **business,
consent, and communications history stays** — moving it would leak the prior
owner's activity to the new owner.

Re-parented to the target household:

- `pets` (the legacy row; its `household_id` follows the animal)
- `weight_log`, `vaccinations`, `medical_events`, `medications`,
  `medication_administrations`, `lab_values`, `qol_entries`
- `reminders` (pet-scoped rows only)
- `documents` linked **exclusively** to this pet, plus their
  `document_pet_links` rows
- `vet_clinics`: clinics referenced by moved rows are **copied** into the target
  household (deduped on the existing unique key
  `household_id, lower(name), coalesce(phone,'')`), then the moved rows are
  repointed at the copies. Origin clinics are left intact for the origin
  household's other pets.

Deliberately left with the origin household:

- `insurance_policies`, `cost_estimates`, `claims`, `claim_attachments`,
  `medication_price_quotes`, `outbound_emails`, `pending_records_requests`,
  `extraction_chunks`, `document_extractions`
- Multi-pet documents (any document also associated with another pet).

"Exclusively linked" is defined over BOTH `documents.pet_id` and every
`document_pet_links` row: a document moves only when all of its associations
point at the transferred pet and no other. The identical predicate lives in
`documentsToMove()` (`lib/db/transfers.ts`) and is behaviorally tested in
`scripts/test-transfer-logic.ts`. Keep the SQL loop and the TS function in
lockstep.

An animal with no `pets` row (created directly after expand) still swaps
custodianship cleanly; the record re-parenting is simply a no-op.

## What "contract" will eventually remove

Once app reads/writes move onto `animals` + `custodianships`:

1. Repoint record FKs from `pet_id` to `animal_id` (or add `animal_id`
   alongside and dual-write, then drop `pet_id`).
2. Drop the `sync_animal_from_pet` mirror trigger.
3. Collapse `pets` into a thin view over `animals` + active owner custodianship,
   or drop it entirely once no code reads it.

None of that happens in this phase.

## Runbook

Apply and backfill against the target Supabase project:

1. Push the migrations (0024 backfill runs inside 0024):

   ```
   pnpm dlx supabase db push
   ```

2. Regenerate types if you prefer the generator over the hand-extended
   `lib/supabase/types.gen.ts` (the hand edits already match; regenerating just
   confirms):

   ```
   pnpm dlx supabase gen types typescript --project-id <ref> > lib/supabase/types.gen.ts
   ```

3. Safety-net backfill for any pets inserted by the legacy path after the
   migration ran (idempotent, only touches `animal_id is null`):

   ```
   pnpm dlx tsx scripts/backfill-animals.ts
   ```

4. Verify tenancy isolation on the new tables:

   ```
   pnpm dlx tsx scripts/check-rls.ts
   ```

5. Run the transfer logic behavioral test:

   ```
   pnpm dlx tsx scripts/test-transfer-logic.ts
   ```

Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(+ `NEXT_PUBLIC_SUPABASE_ANON_KEY` for check-rls) in the environment.
