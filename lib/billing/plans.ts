/**
 * Pawdex billing plans, the single source of truth for tiers, prices, and
 * limits. Consumed by BOTH the marketing pricing page and the server-side
 * entitlements logic, so this module is deliberately pure: no server-only
 * import, no env access, no DB. It can be imported into a client component.
 *
 * Rationale for the numbers lives in docs/pricing-strategy.md. Change a price
 * or a limit here and both the page and the entitlement checks move together.
 */

// The four values the DB check constraint on households.plan allows. Two are
// not purchasable: 'early_access' is today's grandfathered everything-free
// state, and 'free' is the forever-free floor. 'household' and 'breeder' are
// the paid tiers a Stripe subscription maps onto.
export type PlanId = "early_access" | "free" | "household" | "breeder";

// A limit is either a finite number or "unlimited". Kept as a string sentinel
// (not Infinity) so it serializes cleanly and reads honestly in the UI.
export type Limit = number | "unlimited";

export type PlanLimits = {
  /** Max pets that can be actively tracked. */
  pets: Limit;
  /** Document AI extractions granted per calendar month. */
  aiExtractionsPerMonth: Limit;
  /** Extraction queue priority (higher runs first). Informational for UI. */
  ingestionPriority: "standard" | "priority";
  /** Insurance analysis / PEC review / claim tracking. */
  insuranceTools: boolean;
  /** EU passport / health-certificate travel bundles. */
  travelPackets: boolean;
  /** Breeder operations: litters, placement transfers, kennel branding. */
  breederTools: boolean;
  /** Additional household members beyond the owner may be invited. */
  multiUser: boolean;
  /**
   * Soft cap on active animals for operator tiers. Over this we surface a
   * friendly prompt; we never hard-lock the record. null = no soft cap.
   */
  softActiveAnimalCap: number | null;
};

export type PlanFeature = {
  label: string;
  /** Present on this tier. false renders as a struck / muted row. */
  included: boolean;
};

export type Plan = {
  id: PlanId;
  /** Display name. */
  name: string;
  /** One-line who-it-is-for. */
  tagline: string;
  /** Price in US cents, billed monthly. 0 for free tiers. */
  priceMonthlyCents: number;
  /**
   * Price in US cents for a full year when billed annually. null when the tier
   * has no annual option (free tiers). Set below the 12x monthly to advertise
   * "2 months free".
   */
  priceAnnualCents: number | null;
  /** Feature rows shown on the pricing card, in display order. */
  features: PlanFeature[];
  limits: PlanLimits;
};

// The generous, honest free floor. Meters only AI extraction (our real
// per-unit cost); everything about the record itself is uncapped.
const FREE: Plan = {
  id: "free",
  name: "Free",
  tagline: "A real home for one or two pets. Forever, not a trial.",
  priceMonthlyCents: 0,
  priceAnnualCents: null,
  features: [
    { label: "Up to 2 pets", included: true },
    { label: "Full records, reminders & sharing", included: true },
    { label: "10 document AI extractions / month", included: true },
    { label: "Export & view, always free", included: true },
    { label: "Unlimited pets", included: false },
    { label: "Unlimited document AI", included: false },
    { label: "Insurance tools & travel packets", included: false },
    { label: "Breeder operations", included: false },
  ],
  limits: {
    pets: 2,
    aiExtractionsPerMonth: 10,
    ingestionPriority: "standard",
    insuranceTools: false,
    travelPackets: false,
    breederTools: false,
    multiUser: true,
    softActiveAnimalCap: null,
  },
};

const HOUSEHOLD: Plan = {
  id: "household",
  name: "Household",
  tagline: "For the multi-pet family that wants Pawdex to be the record.",
  priceMonthlyCents: 600,
  // $60/yr, a clean "2 months free" against $6/mo.
  priceAnnualCents: 6000,
  features: [
    { label: "Everything in Free", included: true },
    { label: "Unlimited pets", included: true },
    { label: "Unlimited document AI", included: true },
    { label: "Priority ingestion", included: true },
    { label: "Insurance tools", included: true },
    { label: "Travel packets", included: true },
    { label: "Breeder operations", included: false },
  ],
  limits: {
    pets: "unlimited",
    aiExtractionsPerMonth: "unlimited",
    ingestionPriority: "priority",
    insuranceTools: true,
    travelPackets: true,
    breederTools: false,
    multiUser: true,
    softActiveAnimalCap: null,
  },
};

const BREEDER: Plan = {
  id: "breeder",
  name: "Breeder",
  tagline: "The operator tier. Litters, placements, and kennel branding.",
  priceMonthlyCents: 2900,
  // $290/yr, "2 months free" against $29/mo.
  priceAnnualCents: 29000,
  features: [
    { label: "Everything in Household", included: true },
    { label: "Litters & whelping records", included: true },
    { label: "Placement transfers with full history", included: true },
    { label: "Kennel branding on transfers", included: true },
    { label: "Multi-user, no per-seat charge", included: true },
    { label: "Priority support", included: true },
  ],
  limits: {
    pets: "unlimited",
    aiExtractionsPerMonth: "unlimited",
    ingestionPriority: "priority",
    insuranceTools: true,
    travelPackets: true,
    breederTools: true,
    multiUser: true,
    // Soft only, surfaced as a prompt, never a lock. See entitlements.ts.
    softActiveAnimalCap: 50,
  },
};

// Early access: today's grandfathered state. Not shown as a purchasable card;
// it maps to unlimited everything and is what current users + waitlist joiners
// sit on during the beta. Priced at zero because it is free during early
// access; the launch discount is applied at checkout time, not modeled here.
const EARLY_ACCESS: Plan = {
  id: "early_access",
  name: "Early access",
  tagline: "Everything, free, while Pawdex is in beta.",
  priceMonthlyCents: 0,
  priceAnnualCents: null,
  features: BREEDER.features,
  limits: {
    pets: "unlimited",
    aiExtractionsPerMonth: "unlimited",
    ingestionPriority: "priority",
    insuranceTools: true,
    travelPackets: true,
    breederTools: true,
    multiUser: true,
    softActiveAnimalCap: null,
  },
};

export const PLANS: Record<PlanId, Plan> = {
  early_access: EARLY_ACCESS,
  free: FREE,
  household: HOUSEHOLD,
  breeder: BREEDER,
};

// The three cards the pricing page shows, in display order. early_access is
// intentionally excluded, it is a state, communicated by the banner, not a
// product to buy.
export const PURCHASABLE_PLAN_IDS: PlanId[] = ["free", "household", "breeder"];

export const PURCHASABLE_PLANS: Plan[] = PURCHASABLE_PLAN_IDS.map(
  (id) => PLANS[id],
);

/** The plan a paid Stripe subscription maps onto, never a floor/beta tier. */
export type PaidPlanId = Extract<PlanId, "household" | "breeder">;

export function isPaidPlan(id: PlanId): id is PaidPlanId {
  return id === "household" || id === "breeder";
}

export function planById(id: PlanId): Plan {
  return PLANS[id];
}

/** Format a cents value as a plain USD string, e.g. 600 -> "$6". */
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}

/**
 * Effective monthly price when billed annually, in cents, rounded to the
 * nearest cent. e.g. $60/yr -> 500 ("$5/mo billed annually"). null when the
 * plan has no annual price.
 */
export function annualMonthlyEquivalentCents(plan: Plan): number | null {
  if (plan.priceAnnualCents == null) return null;
  return Math.round(plan.priceAnnualCents / 12);
}
