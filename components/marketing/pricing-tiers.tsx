"use client";

import { useState } from "react";

import { Icon } from "@/components/brand/icon";
import {
  PURCHASABLE_PLANS,
  annualMonthlyEquivalentCents,
  formatUsd,
  isPaidPlan,
  type Plan,
} from "@/lib/billing/plans";

type Interval = "monthly" | "annual";

// The tier we visually anchor as the recommended default.
const FEATURED_PLAN = "household";

export function PricingTiers({ disclosure }: { disclosure: string }) {
  const [interval, setInterval] = useState<Interval>("monthly");

  return (
    <>
      <div className="pr-toggle" role="group" aria-label="Billing interval">
        <button
          type="button"
          data-active={interval === "monthly"}
          aria-pressed={interval === "monthly"}
          onClick={() => setInterval("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          data-active={interval === "annual"}
          aria-pressed={interval === "annual"}
          onClick={() => setInterval("annual")}
        >
          Annual
          <span className="pr-save"> · 2 months free</span>
        </button>
      </div>

      <div className="pr-grid">
        {PURCHASABLE_PLANS.map((plan) => (
          <TierCard
            key={plan.id}
            plan={plan}
            interval={interval}
            featured={plan.id === FEATURED_PLAN}
            disclosure={disclosure}
          />
        ))}
      </div>
    </>
  );
}

function priceDisplay(plan: Plan, interval: Interval) {
  if (plan.priceMonthlyCents === 0) {
    return { amount: "Free", per: "forever", note: "No card required." };
  }
  if (interval === "annual" && plan.priceAnnualCents != null) {
    const monthly = annualMonthlyEquivalentCents(plan)!;
    return {
      amount: `${formatUsd(monthly)}`,
      per: "/mo",
      note: `${formatUsd(plan.priceAnnualCents)} billed yearly`,
    };
  }
  return {
    amount: `${formatUsd(plan.priceMonthlyCents)}`,
    per: "/mo",
    note: plan.priceAnnualCents != null
      ? `${formatUsd(plan.priceAnnualCents)}/yr if billed annually`
      : "",
  };
}

function TierCard({
  plan,
  interval,
  featured,
  disclosure,
}: {
  plan: Plan;
  interval: Interval;
  featured: boolean;
  disclosure: string;
}) {
  const price = priceDisplay(plan, interval);
  const paid = isPaidPlan(plan.id);

  return (
    <div className={`mk-card pr-card${featured ? " pr-card--featured" : ""}`}>
      <div className="pr-tier-name">
        {plan.name}
        {featured && <span className="pr-badge">Most popular</span>}
      </div>
      <p className="pr-tagline">{plan.tagline}</p>

      <div>
        <div className="pr-price">
          <span className="pr-amount">{price.amount}</span>
          {price.per && <span className="pr-per">{price.per}</span>}
        </div>
        <div className="pr-price-note">{price.note}</div>
      </div>

      <a
        href="#pricing-waitlist"
        className={`mk-btn${featured ? "" : " mk-btn--ghost"}`}
        style={{ width: "100%" }}
      >
        {plan.priceMonthlyCents === 0 ? "Start free" : `Join the waitlist`}
        <Icon name="arrowRight" size={15} className="mk-btn-arrow" />
      </a>

      <ul className="pr-features">
        {plan.features.map((f) => (
          <li
            key={f.label}
            className={`pr-feature${f.included ? "" : " pr-feature--off"}`}
          >
            <Icon
              name={f.included ? "check" : "x"}
              size={14}
              className="pr-check"
            />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      {paid && <p className="pr-disclosure">{disclosure}</p>}
    </div>
  );
}
