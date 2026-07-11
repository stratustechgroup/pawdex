-- Pawdex, billing foundations (Stripe subscriptions).
--
-- Adds the billing shape without turning billing on. No Stripe keys ship yet;
-- these tables sit empty until the founder configures Stripe, at which point
-- the checkout flow and the /api/webhooks/stripe handler populate them. Every
-- household starts on 'early_access' (everything free during beta), so the
-- absence of any billing_customers / subscriptions row is the normal state.
--
-- Two concepts stay deliberately separate:
--   * households.kind  ('personal' | 'breeder', from 0025) gates which
--     FEATURES appear (breeder tooling).
--   * households.plan  (this migration) gates ENTITLEMENTS / billing.
-- A breeder household on the 'early_access' plan is the expected early-access
-- state: it has breeder features (kind) with unlimited entitlements (plan). At
-- launch that household simply needs the 'breeder' plan to keep them unlocked.
-- lib/billing/entitlements.ts is the code-side source of truth for what each
-- plan grants; this migration only stores which plan a household is on.
--
-- Hardening follows 0028: the updated-at trigger function already pins an empty
-- search_path and is not exposed as RPC. Writes to billing tables are
-- service-role only (the webhook + server actions use the service client);
-- members get read-only RLS so the UI can show current plan + subscription
-- status. plan is stored as text + a check constraint rather than an enum so a
-- new tier is an ALTER of the constraint, not an ALTER TYPE (which cannot run
-- inside the same transaction as its use in older Postgres).

-- =========================================================
-- households.plan, which billing tier a household is on.
-- Mirrors lib/billing/plans.ts PlanId exactly. Defaults to early_access so
-- every existing and future household is grandfathered free during the beta.
-- =========================================================

alter table public.households
  add column plan text not null default 'early_access'
    constraint households_plan_check
    check (plan in ('early_access', 'free', 'household', 'breeder'));

comment on column public.households.plan is
  'Billing tier (early_access|free|household|breeder). Separate from households.kind, which gates features. Entitlements per plan live in lib/billing/plans.ts.';

-- =========================================================
-- billing_customers, one Stripe customer per household. Created lazily the
-- first time a household starts checkout, so most rows never exist during early
-- access. household_id is the PK: a household maps to exactly one customer.
-- =========================================================

create table public.billing_customers (
  household_id uuid primary key references public.households(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.billing_customers is
  'Maps a household to its Stripe customer. Written service-role only (checkout action + webhook); members read their own household row for the billing UI.';

-- =========================================================
-- subscriptions, the live Stripe subscription state for a household, upserted
-- by the webhook on checkout.session.completed and customer.subscription.*
-- events. One active row per household in practice, but stripe_subscription_id
-- (not household_id) is the unique key so a re-subscribe after cancellation
-- inserts cleanly and idempotent upserts key on the Stripe id.
-- =========================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  stripe_subscription_id text not null unique,
  -- The plan this subscription grants. Same allowed set as households.plan minus
  -- the non-purchasable tiers: a subscription is only ever for a paid tier.
  plan text not null
    constraint subscriptions_plan_check
    check (plan in ('household', 'breeder')),
  -- Raw Stripe status (active, trialing, past_due, canceled, incomplete, ...).
  -- Stored as text so a new Stripe status never trips a constraint.
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_household on public.subscriptions(household_id);

comment on table public.subscriptions is
  'Live Stripe subscription state per household. Upserted by /api/webhooks/stripe keyed on stripe_subscription_id (idempotent). Written service-role only; members read their household rows.';

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =========================================================
-- RLS, members read their household's billing rows; all writes are
-- service-role only. There is deliberately NO authenticated insert/update/
-- delete policy on either table: subscription state is authored exclusively by
-- Stripe via the webhook (service client, which bypasses RLS), so a member can
-- never forge or edit their own plan. Reads are gated on household membership.
-- =========================================================

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;

create policy "billing_customers_select" on public.billing_customers
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "subscriptions_select" on public.subscriptions
  for select to authenticated
  using (public.is_household_member(household_id));
