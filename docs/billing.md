# Billing (Stripe subscriptions)

How Pawdex billing is wired, what is enforced today (almost nothing, on
purpose), and exactly what the founder does to turn payments on.

Pricing rationale and the tier definitions live in
[docs/pricing-strategy.md](./pricing-strategy.md). Prices/limits are set in code
at `lib/billing/plans.ts`, the single source of truth consumed by both the
marketing pricing page and the entitlement checks.

## Current state: built, dormant, honest

There is no Stripe account configured. `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are all
absent, so `isBillingEnabled()` is `false` and the entire flow renders honest
"payments open at launch" states. This mirrors how the app already gates Resend:
the code path exists and is exercised, it just doesn't transact until keys land.
Nothing ever fakes a charge.

Every household is on `plan = 'early_access'` (unlimited entitlements). The
`subscriptions` and `billing_customers` tables are empty until real checkouts
happen.

## Data model (migration 0031_billing.sql)

- `households.plan`, `text` + check constraint in
  (`early_access`, `free`, `household`, `breeder`). Default `early_access`.
  Mirrors `PlanId` in `plans.ts`.
- `billing_customers`, `household_id` (PK/FK) → `stripe_customer_id` (unique).
  One Stripe customer per household, created lazily at first checkout.
- `subscriptions`, live Stripe subscription state, upserted by the webhook.
  Unique on `stripe_subscription_id` (the idempotency key).
- RLS: members **read** their own household's billing rows; there is **no**
  authenticated write policy. All writes go through the service client (webhook
  + server actions), so a member can never forge their own plan.

### `plan` vs `kind`, kept separate on purpose

`households.kind` (`personal` | `breeder`, from migration 0025) gates which
**features** appear. `households.plan` gates **billing / entitlements**. They
are independent:

- A breeder household on `early_access` is the normal early-access state: it has
  breeder features (kind) with unlimited entitlements (plan).
- At launch, that household needs the `breeder` plan to keep breeder tooling
  entitled once enforcement turns on.

Do not collapse these into one column. Feature availability and billing tier
answer different questions and change on different schedules.

## Code map

| File | Role |
|---|---|
| `lib/billing/plans.ts` | Pure single source of truth: tiers, prices, limits. Client-safe. |
| `lib/billing/entitlements.ts` | Pure `planFor(household) → limits` + capability checks + `canEnforce()` stub. |
| `lib/billing/stripe.ts` | Lazy server Stripe client + `isBillingEnabled()`. |
| `lib/billing/subscription.ts` | Server data access: read billing state (RLS), service-role upserts for webhook/checkout. |
| `app/(app)/settings/billing/` | In-app plan status, limits, upgrade/downgrade + portal. |
| `app/api/webhooks/stripe/route.ts` | Signature-verified, idempotent event handler. |
| `app/(marketing)/pricing/` | Public pricing page. |

## Enforcement map (follow-up, soft only this pass)

Enforcement is **off**. `canEnforce()` returns `false`, and every capacity check
in `entitlements.ts` is called only to *inform* the UI (show remaining slots,
nudge upgrades). No existing feature is locked. The single visible touchpoint
this pass is `/settings/billing`, which surfaces the current plan + its limits.

When the founder decides to enforce, flip `canEnforce()` and wire these points.
Each already has a pure check ready in `entitlements.ts`:

| Limit | Check | Surface to gate | User-visible behavior |
|---|---|---|---|
| Pet count (Free = 2) | `canAddPet` | "Add pet" flow (cockpit's turf, coordinate) | Block the *add* with an upgrade prompt; never touch existing pets |
| Document AI / month (Free = 10) | `canRunAiExtraction` | ingestion / extraction trigger | Queue without AI or prompt upgrade; the document is still stored |
| Insurance tools | `hasInsuranceTools` | insurance routes | Show upsell instead of the tool |
| Travel packets | `hasTravelPackets` | travel/passport export | Show upsell |
| Breeder operations | `hasBreederTools` | breeding routes | Show upsell (distinct from `kind` feature-gating) |
| Breeder soft cap (50) | `isOverSoftAnimalCap` | breeder dashboard | Advisory "let's talk" banner, **never** a lock |

Hard rule (see pricing-strategy.md): enforcement governs **capacity and
convenience, never retention**. No enforcement path may delete, hide, or lock a
record. Viewing and exporting is always free on every tier.

## Going live: founder steps

1. **Create the Stripe account** and, in the Stripe Dashboard, create two
   Products with two Prices each (monthly + annual):
   - Household, $6/mo and $60/yr
   - Breeder, $29/mo and $290/yr
   Set a `lookup_key` on each price (e.g. `household_monthly`) as a fallback the
   webhook can read; the primary plan signal is checkout metadata.
2. **Add environment variables** (Vercel project settings + `.env.local`):
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...            # from the webhook endpoint below
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_PRICE_HOUSEHOLD_MONTHLY=price_...
   STRIPE_PRICE_HOUSEHOLD_ANNUAL=price_...
   STRIPE_PRICE_BREEDER_MONTHLY=price_...
   STRIPE_PRICE_BREEDER_ANNUAL=price_...
   ```
   All three of the first block must be present for `isBillingEnabled()` to flip
   true. Missing price vars only disable the specific tier's checkout button.
3. **Register the webhook endpoint** in Stripe →
   `https://www.pawdex.co/api/webhooks/stripe`, subscribed to:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.
4. **Enable the Billing Portal** in Stripe (Settings → Billing → Customer
   portal) so `openBillingPortal()` works.
5. **Decide on early-access grandfathering**: before enforcement, run a one-off
   to move current households from `early_access` to their launch plan (most to
   `free`, paying converts to `household`/`breeder`). Until then everyone stays
   unlimited.
6. **Turn on enforcement** only when ready: flip `canEnforce()` and wire the map
   above.

## Compliance follow-ups (before/at billing launch)

Compliance signed off on the current public copy. Two items remain, both gated
on billing actually going live:

- **Annual checkout consent block.** The CA-ARL consent block in
  `app/(app)/settings/billing/page.tsx` (PlanCard) currently hardcodes the
  monthly price and the word "month" (checkout uses `interval="month"`). When an
  annual checkout option is wired in, the block's amount and cadence MUST switch
  to the annual price and "year" so the authorization text matches what is
  actually charged. Re-grade with compliance when built.
- **Refund FAQ.** A refund item is intentionally omitted from the public pricing
  FAQ until the founder confirms the proposed 14-day annual cooling-off term.
  Ready-to-add wording is preserved in a comment in
  `components/marketing/pricing-faq.tsx`.

## Webhook behavior

- **Fail-closed everywhere.** Unlike the Resend webhook (which accepts unsigned
  events in dev), the Stripe route returns `503` in *every* environment when
  `STRIPE_WEBHOOK_SECRET` / `STRIPE_SECRET_KEY` is unset. Money-adjacent state
  never rides an unverifiable request.
- **Signature is the auth.** The route is publicly routable via the existing
  `/api/webhooks/` middleware allowlist; `stripe.webhooks.constructEvent`
  verifies every request.
- **Idempotent.** Every handler upserts keyed on `stripe_subscription_id`, so a
  redelivered event can't double-apply. Stripe retries on non-2xx, so transient
  errors return `500` and are safely replayed.
- **Plan resolution.** Reads `metadata.plan` (set at checkout) first, falling
  back to the price `lookup_key`/`nickname`. Reconciles `households.plan` to
  match: active subscription → its tier; inactive/canceled → `free` (never a
  deletion).

## Tests

- `scripts/test-billing-entitlements.ts`, pure unit tests for plans +
  entitlements (no DB, no env). Run: `pnpm dlx tsx scripts/test-billing-entitlements.ts`.
- `scripts/test-billing-webhook.ts`, signs a synthetic event with a fake
  `STRIPE_WEBHOOK_SECRET` and asserts the handler upserts `subscriptions` +
  `households.plan` against a `zztest-billing-*` household, then self-cleans.
  Run: `pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-billing-webhook.ts`.

These are intentionally **not** wired into `pnpm test` yet (package.json is
shared and owned by integration). The integration agent consolidates them.
