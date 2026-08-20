"use client";
import { MkIcon } from "@/components/marketing/mk-icon";

import { useState } from "react";

import {
  PLANS,
  PURCHASABLE_PLANS,
  annualMonthlyEquivalentCents,
  formatUsd,
  type Plan,
} from "@/lib/billing/plans";
import { FIT_LIMITS, recommendPlan } from "@/lib/billing/recommend";

// Chapter 4. The pricing tiers as a fit finder, laid out as a rate card.
//
// This is deliberately not a price calculator: the tiers are flat rate, so
// nothing recomputes. What the controls move is the RECOMMENDATION. The honest
// version of that is better than a fake calculator anyway, because the
// documents-per-month slider is not a marketing contrivance. AI extraction is
// the only metered thing anywhere in the product, so that slider exposes the
// one true meter in the system.
//
// The three plans are rows in one bordered ledger, in fixed order. Rows never
// reorder and never hide: every plan always shows its name, tagline, price and
// button, so the comparison is available without touching a slider. The
// recommendation moves between rows as data-fit, which opens that row's detail
// area and marks it with the accent rule. All of it is CSS; the transitions
// are plain CSS transitions, which are interruptible by nature, so the GSAP
// layer the old card layout needed is gone along with the dependency.

type Interval = "monthly" | "annual";

function priceDisplay(plan: Plan, interval: Interval) {
  if (plan.priceMonthlyCents === 0) {
    return { amount: "Free", per: "forever", note: "No card required." };
  }
  if (interval === "annual" && plan.priceAnnualCents != null) {
    const monthly = annualMonthlyEquivalentCents(plan)!;
    return {
      amount: formatUsd(monthly),
      per: "/mo",
      note: `${formatUsd(plan.priceAnnualCents)} billed yearly`,
    };
  }
  return {
    amount: formatUsd(plan.priceMonthlyCents),
    per: "/mo",
    note:
      plan.priceAnnualCents != null
        ? `${formatUsd(plan.priceAnnualCents)}/yr if billed annually`
        : "",
  };
}

const FREE_DOC_CAP = PLANS.free.limits.aiExtractionsPerMonth as number;
const BREEDER_SOFT_CAP = PLANS.breeder.limits.softActiveAnimalCap;

export function PlanFit({
  disclosure,
  cta,
}: {
  disclosure: string;
  cta: "checkout" | "waitlist";
}) {
  const [pets, setPets] = useState(2);
  const [docs, setDocs] = useState(6);
  const [litters, setLitters] = useState(false);
  const [interval, setInterval] = useState<Interval>("monthly");

  const fit = recommendPlan({ pets, docsPerMonth: docs, placesLitters: litters });

  return (
    <div className="pf">
      <div className="mk-container">
        {/* No eyebrow. Small uppercase labels above every section headline are
            the rhythm that made this page read as templated, and the budget for
            them across the whole page is two. The headline says what this is. */}
        <h2 className="mk-h2 pf-headline">
          You pay for reading, <em>never for the record</em>.
        </h2>
        <p className="mk-lead pf-sub">
          Pets, reminders, sharing and export are unlimited on every plan.
          Reading documents is the only thing that costs us anything, so it is
          the only thing we meter.
        </p>

        {/* One bordered instrument: the controls on top, the meter as its
            bottom strip. Real form controls. Native range inputs give arrow
            keys, Home/End, focus and screen reader semantics for free. */}
        <div className="pf-instrument">
          <div className="pf-controls">
            <label className="pf-control">
              <span className="pf-control-label">
                Pets
                <output className="pf-control-value">
                  {pets}
                  {pets === FIT_LIMITS.maxPets ? "+" : ""}
                </output>
              </span>
              <input
                type="range"
                min={1}
                max={FIT_LIMITS.maxPets}
                step={1}
                value={pets}
                onChange={(e) => setPets(Number(e.target.value))}
              />
            </label>

            <label className="pf-control">
              <span className="pf-control-label">
                Vet documents a month
                <output className="pf-control-value">
                  {docs}
                  {docs === FIT_LIMITS.maxDocs ? "+" : ""}
                </output>
              </span>
              <input
                type="range"
                min={0}
                max={FIT_LIMITS.maxDocs}
                step={1}
                value={docs}
                onChange={(e) => setDocs(Number(e.target.value))}
              />
            </label>

            <label className="pf-toggle">
              <input
                type="checkbox"
                checked={litters}
                onChange={(e) => setLitters(e.target.checked)}
              />
              <span>I place litters</span>
            </label>
          </div>

          {/* The one real meter in the product, shown against the one plan
              that has a limit. Always visible, because the moment worth
              creating is the slider crossing the cap, and that is exactly when
              the Free plan stops being the recommendation. */}
          <p className="pf-meter" data-over={fit.outgrewFree ? "true" : "false"}>
            <span className="pf-meter-count">
              {docs} of {FREE_DOC_CAP}
            </span>
            <span>
              {fit.outgrewFree
                ? `documents a month. Free reads ${FREE_DOC_CAP} of them.`
                : "documents a month, inside what Free reads."}
            </span>
          </p>
        </div>

        {/* Announced, not just shown. A sighted visitor sees the row open; a
            screen reader user hears the tier change as they move the slider. */}
        <p className="pf-result" role="status" aria-live="polite">
          <strong>{PLANS[fit.planId].name}.</strong> {fit.reason}
          {cta === "waitlist"
            ? " Here's what you'd be on after beta. It's free until then."
            : ""}
        </p>

        {cta === "checkout" ? (
          <div className="pf-interval" role="group" aria-label="Billing interval">
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
              <span className="pf-save"> · 2 months free</span>
            </button>
          </div>
        ) : null}

        {/* The rate card. Fixed order, nothing reorders, nothing vanishes:
            the recommendation is a highlight that moves down a ledger, not a
            layout that rebuilds itself around an answer. */}
        <div className="pf-ledger">
          {PURCHASABLE_PLANS.map((pl) => (
            <PlanRow
              key={pl.id}
              plan={pl}
              interval={interval}
              fits={pl.id === fit.planId}
              disclosure={disclosure}
              cta={cta}
            />
          ))}
        </div>

        {/* No form here. The same waitlist form already sits in the hero and
            closes the page; a third copy between them is the same ask three
            times, which reads as nagging rather than as an offer. The fit
            row's own button carries this section. */}
      </div>
    </div>
  );
}

function PlanRow({
  plan,
  interval,
  fits,
  disclosure,
  cta,
}: {
  plan: Plan;
  interval: Interval;
  fits: boolean;
  disclosure: string;
  cta: "checkout" | "waitlist";
}) {
  const price = priceDisplay(plan, interval);
  const included = plan.features.filter((f) => f.included).map((f) => f.label);
  const excluded = plan.features.filter((f) => !f.included).map((f) => f.label);
  const paid = plan.priceMonthlyCents > 0;

  return (
    <article className="pf-row" data-fit={fits ? "true" : "false"}>
      <div className="pf-row-main">
        <div className="pf-row-id">
          <span className="pf-row-name">
            {plan.name}
            {fits ? <span className="pf-badge">Fits you</span> : null}
          </span>
          <span className="pf-row-tagline">{plan.tagline}</span>
        </div>

        <div className="pf-row-price">
          <span className="pf-price">
            <span className="pf-amount">{price.amount}</span>
            {price.per ? <span className="pf-per">{price.per}</span> : null}
          </span>
          {price.note ? (
            <span className="pf-price-note">{price.note}</span>
          ) : null}
        </div>

        <a
          href={cta === "waitlist" ? "#waitlist" : "#pricing-waitlist"}
          className={`mk-btn${fits ? "" : " mk-btn--ghost"} pf-row-cta`}
        >
          {plan.priceMonthlyCents === 0 ? "Start free" : "Join the waitlist"}
          <MkIcon name="arrowRight" size={15} />
        </a>
      </div>

      {/* The detail drawer. Text only, no focusable content, so hiding it from
          assistive tech while closed is safe; the aria-live result sentence
          already announced the change that opens it. */}
      <div className="pf-row-detail" aria-hidden={!fits}>
        <div className="pf-row-detail-inner">
          <p className="pf-row-features">{included.join(" · ")}</p>
          {excluded.length > 0 ? (
            <p className="pf-excluded">
              <span className="pf-excluded-head">Not included</span>
              {excluded.join(", ")}.
            </p>
          ) : null}
          {/* Rendered as what plans.ts actually says it is. Calling a soft cap
              a hard limit would be the easy thing and it would be a lie. */}
          {plan.id === "breeder" && BREEDER_SOFT_CAP != null ? (
            <p className="pf-softcap">
              {`Soft cap at ${BREEDER_SOFT_CAP} active animals. We'll ask, we never lock the record.`}
            </p>
          ) : null}
          {paid && disclosure ? (
            <p className="pf-disclosure">{disclosure}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
