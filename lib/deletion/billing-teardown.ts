import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { getStripe, isBillingEnabled } from "@/lib/billing/stripe";

type Service = SupabaseClient<Database>;

export type BillingTeardownResult = {
  attempted: boolean;
  subscriptionsCancelled: number;
  customerDeleted: boolean;
  errors: string[];
};

/**
 * Cancel a household's Stripe subscriptions and delete its Stripe customer as
 * part of a hard purge. Dormant until billing is configured: when
 * isBillingEnabled() is false this is a no-op that reports attempted:false, so
 * it lights up automatically the day the Stripe keys land (mirrors how the rest
 * of the billing surface is gated).
 *
 * Call this BEFORE deleting the household row, because billing_customers and
 * subscriptions cascade away with the household and we need their Stripe ids.
 * Best-effort: Stripe failures are collected, not thrown, so a billing hiccup
 * never strands the data deletion the user asked for.
 */
export async function teardownHouseholdBilling(
  service: Service,
  householdId: string,
): Promise<BillingTeardownResult> {
  const result: BillingTeardownResult = {
    attempted: false,
    subscriptionsCancelled: 0,
    customerDeleted: false,
    errors: [],
  };

  if (!isBillingEnabled()) return result;
  const stripe = getStripe();
  if (!stripe) return result;
  result.attempted = true;

  // Cancel any live subscriptions first.
  const { data: subs } = await service
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("household_id", householdId);

  for (const sub of subs ?? []) {
    if (sub.status === "canceled") continue;
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      result.subscriptionsCancelled += 1;
    } catch (err) {
      result.errors.push(
        `cancel ${sub.stripe_subscription_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Delete the Stripe customer so no residual PII stays on Stripe's side.
  const { data: customer } = await service
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("household_id", householdId)
    .maybeSingle();

  if (customer?.stripe_customer_id) {
    try {
      await stripe.customers.del(customer.stripe_customer_id);
      result.customerDeleted = true;
    } catch (err) {
      result.errors.push(
        `delete customer ${customer.stripe_customer_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
