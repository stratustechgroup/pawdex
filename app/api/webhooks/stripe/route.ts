import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import type { PaidPlanId } from "@/lib/billing/plans";
import {
  householdIdForCustomer,
  markSubscriptionCanceled,
  paidPlanFromValue,
  saveStripeCustomerId,
  upsertSubscriptionFromStripe,
} from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

// Stripe subscription webhook. Verifies the signature with the SDK's
// constructEvent, then idempotently reconciles our subscriptions table +
// households.plan to Stripe's truth.
//
// Fail-closed EVERYWHERE (unlike the Resend webhook, which accepts unsigned
// events in dev): this route moves money-adjacent state, so a missing
// STRIPE_WEBHOOK_SECRET returns 503 in every environment rather than opening an
// unauthenticated write path. The route stays publicly routable via the
// existing /api/webhooks/ middleware allowlist; the signature IS the auth.
//
// Idempotency: every handler upserts keyed on stripe_subscription_id, so a
// redelivered checkout.session.completed or subscription.updated can't double
// apply. Stripe retries on non-2xx, so transient failures are safe to 500.

/**
 * Pull the plan a subscription grants. We set metadata.plan at checkout time,
 * which is the authoritative source; fall back to the price lookup_key for
 * subscriptions created outside our flow (eg via the Stripe dashboard).
 */
function planFromSubscription(sub: Stripe.Subscription): PaidPlanId | null {
  const fromMeta = paidPlanFromValue(sub.metadata?.plan);
  if (fromMeta) return fromMeta;
  const price = sub.items.data[0]?.price;
  return paidPlanFromValue(price?.lookup_key ?? price?.nickname ?? null);
}

/**
 * current_period_end as an ISO string. Its location moved to the subscription
 * item in recent API versions, so read the top-level field when present and
 * fall back to the first item. Returns null when neither is set.
 */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const item = sub.items.data[0] as unknown as {
    current_period_end?: number;
  };
  const epoch = top ?? item?.current_period_end;
  return typeof epoch === "number" ? new Date(epoch * 1000).toISOString() : null;
}

async function reconcileSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  householdIdHint?: string | null,
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const householdId =
    householdIdHint ?? (await householdIdForCustomer(customerId));
  if (!householdId) {
    // We have no mapping for this customer. Nothing we can safely attribute the
    // subscription to; acknowledge so Stripe stops retrying.
    console.warn(
      `[stripe webhook] no household mapped to customer ${customerId}, skipping`,
    );
    return;
  }

  const plan = planFromSubscription(sub);
  if (!plan) {
    console.warn(
      `[stripe webhook] subscription ${sub.id} has no resolvable plan, skipping`,
    );
    return;
  }

  await upsertSubscriptionFromStripe({
    householdId,
    stripeSubscriptionId: sub.id,
    plan,
    status: sub.status,
    currentPeriodEnd: periodEndIso(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  // Fail closed in ALL environments. No secret or no client => billing is not
  // configured; refuse rather than accept an unverifiable event.
  if (!secret || !stripe) {
    console.error(
      "[stripe webhook] STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY not configured, refusing request",
    );
    return NextResponse.json(
      { error: "billing not configured" },
      { status: 503 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only subscription-mode sessions concern us.
        if (session.mode !== "subscription") break;

        const householdId = session.metadata?.household_id ?? null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        // Persist the customer mapping up-front so future subscription.* events
        // (which only carry the customer) can find the household.
        if (householdId && customerId) {
          await saveStripeCustomerId(householdId, customerId);
        }

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await reconcileSubscription(stripe, sub, householdId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await reconcileSubscription(stripe, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceled(sub.id);
        break;
      }

      default:
        // Other event types are not relevant to entitlement state, ack them.
        break;
    }
  } catch (err) {
    // Let Stripe retry on a genuine processing error.
    const message = err instanceof Error ? err.message : "handler error";
    console.error(`[stripe webhook] error handling ${event.type}: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
