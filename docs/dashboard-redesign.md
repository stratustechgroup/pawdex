# Dashboard redesign proposal

Scope: the authenticated home at `app/(app)/page.tsx`, the first screen an owner
sees after login. This proposal is grounded in driving the real UI end to end
(fresh household, seeded pets, vaccines, an insurance policy) and in the owner
journey priorities in `docs/product-roadmap.md`. It assumes the verification
fixes already landed (reminder rail now reuses `lib/db/expiring.ts`; the fake
search box, fake notification dot, and dead responsive nav were removed or
corrected). No em-dashes anywhere by house rule.

## 1. What the dashboard is today

Driving it, the current home is three stacked things plus a greeting:

- A greeting line with a pet count and a reminder summary.
- A "Your pets" grid of cards. Each card shows a name, species, a colored photo
  tint, a status badge (up to date, due soon, overdue, incomplete), and a single
  next-vaccine line ("Rabies (3yr) due in 19 d").
- A "Recent activity" panel that lists the last three ingested documents.
- A right rail "Reminders" showing the next sixty days of expirations.

It is clean, the empty states are genuinely good, and after the fix the rail and
`/expiring` finally agree. The weakness is not visual. It is that the dashboard
reports state and then stops. Every high-value thing an owner needs to do on a
deadline lives one or two clicks away, and the screen that should be the cockpit
is a status board. The roadmap says this in its own words for `/expiring`: the
data to act is present, the affordances are missing. The same is true here.

## 2. What a pet owner actually needs at a glance

From the journey spine in the roadmap, the home screen serves four jobs, in
priority order:

1. "Is anything wrong or due right now, and can I deal with it from here."
   Overdue and near-term expirations, refills about to run out, a boarding date
   the pet is not cleared for. This is the anxiety the owner opens the app with.
2. "What is each pet's health state." A per-pet read that is deeper than a single
   vaccine line: weight direction, active medications, open conditions, coverage.
3. "What just happened." New documents ingested, a reminder sent, a record
   confirmed. Proof the system is working on the owner's behalf between visits.
4. "What should I know that I did not think to ask." The proactive signal:
   a weight trend, a lab value drifting, a rabies cert that lapses before a
   booked trip. This is the feature that makes a complete record visibly pay off.

The current dashboard does a partial version of 2 and 3 and a read-only version
of 1. It does nothing for 4.

## 3. Proposed information hierarchy

Top to bottom, widest attention at the top:

### Band A: Action strip (new, replaces the passive greeting subline)

A single row of at most three action chips derived from the same expiring plus
supply computation, shown only when they exist:

- "2 overdue" leads to `/expiring` filtered to overdue.
- "Rabies lapses in 20 days" with an inline "Add to calendar" and "Send proof"
  action.
- "Bella's thyroid med runs out in 5 days" with an inline "Request refill."

If nothing is actionable the strip collapses to the warm greeting alone, so a
healthy household is calm and a household with a deadline is loud. This is the
literal payoff of items 1, 3, and 6 in the roadmap (calendar sync, boarding
gate, refill radar) surfaced at the one place the owner always lands.

### Band B: Per-pet health tiles (upgrade of the current cards)

Keep the card grid, deepen each card into a real tile:

- Name, photo, species, age.
- A compact vitals strip: latest weight with a direction arrow, count of active
  medications, count of open conditions, coverage state (insured or not, with
  renewal proximity).
- The single most urgent dated item for that pet, carrying an inline action, not
  just a label.
- Status badge stays but is computed from the same source as `/expiring` so a
  superseded, expired dose never reads as overdue (this class of bug is exactly
  what the reminder-rail fix removed from the rail; the pet card status still
  computes independently in `lib/db/pets.ts` and should be unified next).

### Band C: Two columns

Left, "Recent activity" widened from documents-only to a real feed: documents
ingested, reminders sent, records confirmed, a policy added. Right, the
"Reminders" rail stays but every row gains the inline actions from Band A so the
rail is a place to act, not only to read.

### Band D: Proactive insights (new, deterministic, cited)

A small, quiet set of descriptive nudges from data the owner cannot hold in their
head: "Rex is down 8 percent since March," "this lab value has trended up across
three visits," "rabies lapses before your August trip." Descriptive only, never
prescriptive, deferring to the vet, matching the tone discipline the QoL tracker
already holds. This is roadmap item 10 given a home.

## 4. Per-pet health tile detail

The tile is the piece worth the most and the cheapest to start, because the data
already exists. Weight lives in `weight_log`, medications in `medications` with
an app-computed active flag, conditions in `medical_events`, coverage in
`insurance_policies`, vaccine status in `vaccinations`. The tile is an
aggregation over tables the app already reads, not new capture. Start with weight
direction and med count (both one query each), add conditions and coverage next.

## 5. What to cut or de-emphasize

- Cut the idea of a global search box until there is something to search. It was
  removed in verification because it was a decorated dead end with a fake command
  hint. Reintroduce only as a real command palette or a query into `/ask`.
- De-emphasize raw document filenames in Recent activity. An owner does not think
  in filenames; they think "Rex's rabies certificate." Lead with the extracted
  meaning, keep the filename secondary.
- Do not add a notification center yet. The bell now honestly links to
  `/expiring`, which is the real "things needing attention" surface. A separate
  notifications inbox is a second thing to keep in sync for little gain until push
  and digest channels (roadmap item 4) exist to feed it.
- Resist per-pet vanity (badges, gotcha-day counters). The roadmap is explicit
  that retention should come from the record doing real work at real deadlines.

## 6. Phased implementation plan

Phase 0, done in this pass:
- Reminder rail reuses `lib/db/expiring.ts`, so it dedups vaccines to the latest
  dose per family and includes insurance renewals. This removed a false "overdue"
  and a missing policy from the rail and corrected the greeting counts.
- Removed the fake search box and its fake command-key hint.
- Removed the hardcoded notification dot; the bell now links to `/expiring`.
- Fixed the responsive nav: an inline `display: flex` was defeating the
  `hidden md:flex` classes, so the nav never collapsed and overflowed narrow
  screens. Display is now class-driven.
- Built the minimal mobile menu: a hamburger button below 768px toggles a
  full-width panel under the header with the same nav links (including the
  breeder-gated Breeding link) plus a theme toggle. It closes on link tap and on
  route change, carries `aria-expanded` and `aria-controls`, and adds no deps.
  Verified at mobile width (hamburger shown, desktop nav hidden, no overflow,
  menu closes after navigation) with desktop unchanged (hamburger hidden, nav
  flex).

Phase 1, small, high ratio (days):
- Unify the pet-card status with `lib/db/expiring.ts` so card and rail never
  disagree (closes the residual one-day and stale-dose mismatch between the card
  label and the rail).
- Add inline actions to each rail row and each expiring row: add to calendar,
  mark done, send proof. This is roadmap refinement (b)(1) and it is where the
  most owner value per hour sits.
- Widen the pet card into the vitals strip using weight direction and active-med
  count only. Two queries, immediate depth.

Phase 2, medium (weeks):
- Action strip in Band A, fed by expiring plus a first cut of the refill supply
  computation (roadmap item 6).
- Recent activity becomes a real multi-source feed rather than documents only.
- Boarding readiness surfaced as an action when a boarding date is known
  (roadmap item 3).

Phase 3, medium, higher leverage:
- Proactive insights band, deterministic and cited, over weight, labs, and
  vaccine data (roadmap item 10).
- Richer mobile navigation. Phase 0 shipped a working minimal mobile menu (a
  hamburger opening a full-width panel), which closed the immediate reachability
  gap left by the nav fix. The next step, if the roadmap's mobile-first capture
  flow (item 2) lands, is to consider a persistent bottom tab bar for the two or
  three highest-frequency destinations rather than burying everything behind the
  hamburger, so the primary actions are one tap from anywhere on a phone.

## 7. Guiding principle

The dashboard should answer, in one screen, "what needs doing, for which pet, and
let me do it here." Every element earns its place by moving the owner toward a
dated action or by proving the record is working for them between visits. The
current screen is a good status board. The redesign turns it into a cockpit,
reusing data and infrastructure the app already has rather than building new
capture.
