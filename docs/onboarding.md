# Onboarding (organic first-run)

The first ten minutes for a fresh, organic signup. Invite and adoption
acceptors do **not** pass through this flow, they already have context and land
in an existing screen (see "Routing" below).

## Where it lives

- `app/onboarding/page.tsx`, server entry. Bootstraps the household
  (idempotent), loads prefill values, renders the client wizard. A direct visit
  to `/onboarding` always works.
- `app/onboarding/actions.ts`, all server actions (identity, pet, consent,
  reminders, inbox, completion).
- `components/onboarding/**`, the client wizard and steps.
- `lib/clinical/first-year.ts`, the PURE first-year plan projection.
  `scripts/test-first-year.ts` proves its behavior.

## The flow

1. **Identity**, display name → `profiles` (via `updateDisplayName`), plus a
   rename of the auto-created household (`households.name`, owner-writable under
   RLS). Offers a "The Rivera household" suggestion derived from the name.
2. **First pet**, name, species, optional breed, optional birthday (with the
   `dob_is_estimated` flag), optional photo. Creates the pet with the same DB
   writes as `pets/new` (`createOnboardingPet`), then uploads the photo to the
   `pet-photos` bucket and calls the existing `setPetPhoto` action. Returns the
   new `petId` in-place instead of redirecting.
3. **Research consent**, one calm card, unchecked by default. Opting in grants
   the versioned `research_data_sharing` authorization and writes a
   household-level `research_consents` row (`animal_id` null), the same path the
   transfer accept flow uses. **Declining writes nothing**, a declined
   onboarding leaves zero consent rows.
4. **Value moment**, three real destinations, pick one:
   - **Forward a vet email**, shows the household's real inbound address
     (`getOrCreateInboundAddress`), a copy button, and a live waiting state that
     polls the documents count every 6s and celebrates ("Got it. Reading it
     now…") when the first document lands, linking to review.
   - **Snap or upload a document**, routes to `/pets/{petId}/upload`.
   - **First-year plan**, the timeline (featured when the pet is a dog/cat
     under 20 weeks). See below.
5. **Finish / skip**, writes the durable completion cookie and lands on the
   dashboard, which is now alive (pet card present).

## Routing

Organic new users are sent to `/onboarding` from `app/auth/callback/route.ts`.
The gate only ever overrides the **default** post-auth target (`next === "/"`):

- Organic magic-link signup → `next=/` → routed to `/onboarding` when the
  account is < 1h old, has no `pawdex_onboarded` cookie, and the household has
  zero pets and zero documents.
- Invite → `/login?redirect=/invite/{token}` → `next=/invite/{token}` → the
  gate sees a non-default `next` and does nothing. **Bypass preserved.**
- Transfer → `next=/transfer/{token}` → same. **Bypass preserved.**

Completion/skip sets the `pawdex_onboarded` cookie (`components/onboarding/
constants.ts`) so a user who skips isn't looped back in on their next login.
There is no migration for a server-side flag; the cookie plus the
zero-pets/zero-docs/recent derivation is the honest no-migration marker.

## First-year plan, the reminders decision (important)

`buildFirstYearPlan(species, birthDate, asOf?)` is a pure function returning
species-correct milestones (dog: DHPP series, rabies, lepto/bordetella lifestyle
notes, heartworm start, spay/neuter window, 1-year boosters; cat: FVRCP series,
rabies, FeLV kitten series, 1-year boosters) with absolute dates computed from
DOB and a past/upcoming split relative to `asOf`. It is framed everywhere as
"typical schedule, confirm with your vet" and never diagnoses.

**"Remind me about these" only schedules FUTURE-dated vaccine milestones.** This
is deliberate, and it is where the reminders schema fights the feature:

- The `reminders` table has **no title column**. Both `/reminders` and the
  reminder cron derive a row's label by joining `entity_id` → a real
  `vaccinations` row, falling back to the literal string "Vaccine".
- `entity_id` is `uuid NOT NULL`. Projected plan milestones have no vaccination
  row, so we anchor `entity_id` on the **pet** and carry milestone identity in a
  synthetic `entity_type` (`plan_<key>`), with `lead_days = 0`. The unique
  `(entity_type, entity_id, lead_days)` index makes re-tapping idempotent.
- The cron's send step selects **any** `scheduled` row with `scheduled_for <=
  now` (no `entity_type` filter) and emails it. So we must:
  - Only create **future-dated** items (a past milestone would email on the very
    next cron run against the live DB).
  - Only create **vaccine** items (the cron frames every email as "a vaccine
    coming due"; scheduling a spay/neuter or heartworm item would send a
    misleading email). Non-vaccine items stay in the timeline as guidance only.
- Because of the missing title column + the pet-anchored `entity_id`, these
  emails render generically ("{pet} has 1 vaccine coming due"). That is accurate
  in category and honest; the UI says so and points the user to the Reminders
  page. We deliberately do **not** fabricate `vaccinations` rows to prettify the
  label or force items onto the dashboard rail.

### The dashboard rail does not show plan reminders

The dashboard "Reminders" rail is built from `listExpiringForHousehold` (real
`vaccinations` + `insurance_policies` only), it does **not** read the
`reminders` table. Projected plan milestones therefore never appear on the rail.
The mission brief's "plan reminders visible in the rail" premise does not match
how the rail is wired; the honest surface for plan reminders is the Reminders
page and the scheduled emails.

## Deferred / not done

- **Plan reminders on the dashboard rail**, not possible without fabricating
  real vaccination records; deferred by design (see above).
- **Non-vaccine reminders** (spay/neuter window, heartworm start), guidance
  only, no scheduled reminder, because the cron would email them as vaccines.
- **A first-class server-side "onboarding completed" flag**, uses a cookie +
  derivation instead of a `profiles`/`households` column (would need a
  migration, which this workstream does not own).
