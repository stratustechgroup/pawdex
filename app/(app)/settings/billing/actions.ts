"use server";

import { requireSession } from "@/lib/auth/household";
import { isBillingEnabled, requireStripe } from "@/lib/billing/stripe";
import {
  getStripeCustomerId,
  saveStripeCustomerId,
} from "@/lib/billing/subscription";
import { isPaidPlan, type PaidPlanId } from "@/lib/billing/plans";

export type BillingInterval = "month" | "year";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// The founder sets these once Stripe products exist. Absent => we cannot start
// a checkout for that tier and say so politely. Keys documented in docs/billing.md.
function priceIdFor(plan: PaidPlanId, interval: BillingInterval): string | undefined {
  const key =
    `STRIPE_PRICE_${plan.toUpperCase()}_${interval === "year" ? "ANNUAL" : "MONTHLY"}` as const;
  return process.env[key];
}

function appBaseUrl(): string {
  // Checkout success/cancel must be absolute. Prefer the configured app URL,
  // fall back to the production origin.
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.startsWith("https://")) return configured;
  return "https://www.pawdex.co";
}

/**
 * Create a Stripe Checkout session (subscription mode) for the active
 * household and return its URL for a client-side redirect. Refuses politely
 * when billing is not configured or the requested tier has no price yet, 
 * never fakes a charge.
 */
export async function startCheckout(input: {
  plan: PaidPlanId;
  interval: BillingInterval;
}): Promise<CheckoutResult> {
  const session = await requireSession();

  if (session.role === "viewer") {
    return { ok: false, error: "Only owners and members can change the plan." };
  }
  if (!isPaidPlan(input.plan)) {
    return { ok: false, error: "That plan can't be purchased." };
  }
  if (!isBillingEnabled()) {
    return {
      ok: false,
      error:
        "Payments open at launch. Early access already includes everything, free.",
    };
  }

  const priceId = priceIdFor(input.plan, input.interval);
  if (!priceId) {
    return {
      ok: false,
      error: "This plan isn't available for checkout yet. Please try again soon.",
    };
  }

  const stripe = requireStripe();

  // Reuse the household's Stripe customer if we've made one; otherwise let
  // Checkout create it and we capture the id from the webhook.
  const existingCustomer = await getStripeCustomerId(session.householdId);

  const base = appBaseUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(existingCustomer
      ? { customer: existingCustomer }
      : { customer_email: session.email ?? undefined }),
    // household_id + plan flow through to the webhook via both the session and
    // the subscription so reconciliation never has to guess.
    metadata: { household_id: session.householdId, plan: input.plan },
    subscription_data: {
      metadata: { household_id: session.householdId, plan: input.plan },
    },
    allow_promotion_codes: true,
    success_url: `${base}/settings/billing?checkout=success`,
    cancel_url: `${base}/settings/billing?checkout=cancelled`,
  });

  if (!checkout.url) {
    return { ok: false, error: "Stripe did not return a checkout URL." };
  }
  return { ok: true, url: checkout.url };
}

/**
 * Create a Stripe Billing Portal session so an existing subscriber can manage
 * or cancel their plan. Returns the portal URL for a client-side redirect.
 */
export async function openBillingPortal(): Promise<CheckoutResult> {
  const session = await requireSession();

  if (!isBillingEnabled()) {
    return {
      ok: false,
      error: "Billing management opens at launch.",
    };
  }

  const customerId = await getStripeCustomerId(session.householdId);
  if (!customerId) {
    return {
      ok: false,
      error: "No billing account yet, you're on early access.",
    };
  }

  const stripe = requireStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/settings/billing`,
  });

  if (!portal.url) {
    return { ok: false, error: "Stripe did not return a portal URL." };
  }
  return { ok: true, url: portal.url };
}
