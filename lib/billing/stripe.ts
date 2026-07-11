import "server-only";

import Stripe from "stripe";

/**
 * Server-side Stripe access, gated on configuration exactly like the codebase
 * gates Resend: the whole flow is built and dormant until keys are present,
 * then lights up. Nothing here ever fakes a charge.
 *
 * Billing is "enabled" only when ALL THREE keys are set:
 *   - STRIPE_SECRET_KEY               (server: create checkout/portal sessions)
 *   - STRIPE_WEBHOOK_SECRET           (server: verify inbound webhook signatures)
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (client: redirect to Checkout)
 * Any one missing means we render honest "payments open at launch" states and
 * refuse to start a checkout, rather than half-working.
 */

// Pin the API version the SDK was built against so a future Stripe default
// bump can't silently change response shapes under us.
const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

export function isBillingEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

let cached: Stripe | null = null;

/**
 * Lazily construct the Stripe client. Returns null when STRIPE_SECRET_KEY is
 * absent so callers can branch on configuration without a try/catch. The
 * client is cached across invocations within a warm server instance.
 */
export function getStripe(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  if (!cached) {
    cached = new Stripe(secret, {
      apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      appInfo: { name: "pawdex" },
    });
  }
  return cached;
}

/**
 * Like getStripe but throws when unconfigured. Use in code paths that should
 * only ever run when isBillingEnabled() is already true (server actions behind
 * the enabled gate), so a misconfiguration surfaces loudly instead of as a
 * null-deref.
 */
export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "Stripe is not configured (STRIPE_SECRET_KEY missing). Guard callers with isBillingEnabled().",
    );
  }
  return stripe;
}
