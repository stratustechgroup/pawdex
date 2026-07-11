import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types.gen";

import { PLANS, isPaidPlan, type PaidPlanId, type PlanId } from "./plans";

export type SubscriptionRow =
  Database["public"]["Tables"]["subscriptions"]["Row"];

export type HouseholdBillingState = {
  /** The household's current billing tier. */
  planId: PlanId;
  /** Its live subscription row, or null (early access / free have none). */
  subscription: SubscriptionRow | null;
};

// A Stripe status that still entitles the customer to the plan. Anything else
// (canceled, unpaid, incomplete_expired) means we should not treat the
// subscription as granting its tier.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function subscriptionIsActive(sub: SubscriptionRow | null): boolean {
  return !!sub && ACTIVE_STATUSES.has(sub.status);
}

function coercePlanId(value: string): PlanId {
  return value in PLANS ? (value as PlanId) : "early_access";
}

/**
 * Read the current billing state for a household using the caller's RLS
 * session. Members can read their own household's plan + subscription; this is
 * what the /settings/billing page renders from. Never a service client, a
 * member should only ever see their own household here.
 */
export async function getHouseholdBillingState(
  householdId: string,
): Promise<HouseholdBillingState> {
  const supabase = await createClient();

  const [{ data: household }, { data: subs }] = await Promise.all([
    supabase
      .from("households")
      .select("plan")
      .eq("id", householdId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return {
    planId: coercePlanId(household?.plan ?? "early_access"),
    subscription: subs?.[0] ?? null,
  };
}

// ── Service-role writes. Only the webhook and the checkout action call these.
// The RLS policies deliberately grant members no write path; subscription state
// is authored exclusively by Stripe. ──────────────────────────────────────────

/**
 * Look up an existing Stripe customer id for a household, or null. Used by the
 * checkout action to reuse a customer across sessions.
 */
export async function getStripeCustomerId(
  householdId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("household_id", householdId)
    .maybeSingle();
  return data?.stripe_customer_id ?? null;
}

/** Persist the household↔Stripe-customer mapping (idempotent upsert). */
export async function saveStripeCustomerId(
  householdId: string,
  stripeCustomerId: string,
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("billing_customers")
    .upsert(
      { household_id: householdId, stripe_customer_id: stripeCustomerId },
      { onConflict: "household_id" },
    );
}

/** Find which household a Stripe customer belongs to (webhook reverse-lookup). */
export async function householdIdForCustomer(
  stripeCustomerId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("billing_customers")
    .select("household_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return data?.household_id ?? null;
}

export type UpsertSubscriptionInput = {
  householdId: string;
  stripeSubscriptionId: string;
  plan: PaidPlanId;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Idempotently upsert a subscription row from a Stripe event and reconcile
 * households.plan to match. Keyed on stripe_subscription_id so a redelivered
 * webhook can't create a duplicate. When the subscription is no longer active
 * we drop the household back to 'free' (never delete anything, see
 * docs/pricing-strategy.md: entitlements govern capacity, never retention).
 */
export async function upsertSubscriptionFromStripe(
  input: UpsertSubscriptionInput,
): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from("subscriptions").upsert(
    {
      household_id: input.householdId,
      stripe_subscription_id: input.stripeSubscriptionId,
      plan: input.plan,
      status: input.status,
      current_period_end: input.currentPeriodEnd,
      cancel_at_period_end: input.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  const active = ACTIVE_STATUSES.has(input.status);
  await setHouseholdPlan(input.householdId, active ? input.plan : "free");
}

/**
 * Mark a subscription deleted/canceled and drop the household to free. Called
 * on customer.subscription.deleted.
 */
export async function markSubscriptionCanceled(
  stripeSubscriptionId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .select("household_id")
    .maybeSingle();

  if (sub?.household_id) {
    await setHouseholdPlan(sub.household_id, "free");
  }
}

/** Set households.plan (service role). Validates against the known plan set. */
export async function setHouseholdPlan(
  householdId: string,
  plan: PlanId,
): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("households").update({ plan }).eq("id", householdId);
}

/** Narrow a raw price/lookup value to a paid plan id, or null. */
export function paidPlanFromValue(value: string | null | undefined): PaidPlanId | null {
  if (!value) return null;
  return value in PLANS && isPaidPlan(value as PlanId)
    ? (value as PaidPlanId)
    : null;
}
