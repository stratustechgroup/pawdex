"use client";
import { MkIcon } from "@/components/marketing/mk-icon";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import {
  PLANS,
  PURCHASABLE_PLANS,
  annualMonthlyEquivalentCents,
  formatUsd,
  isPaidPlan,
  type Plan,
} from "@/lib/billing/plans";
import { FIT_LIMITS, recommendPlan } from "@/lib/billing/recommend";

// Chapter 4. The pricing tiers as a fit finder.
//
// This is deliberately not a price calculator: the tiers are flat rate, so
// nothing recomputes. What the controls move is the RECOMMENDATION. The honest
// version of that is better than a fake calculator anyway, because the
// documents-per-month slider is not a marketing contrivance. AI extraction is
// the only metered thing anywhere in the product, so that slider exposes the
// one true meter in the system.
//
// Everything here works with no JavaScript animation library and, apart from
// the sliders themselves, with no JavaScript at all: three cards render server
// side, the recommended one is marked with data-fit, and all styling keys off
// that attribute. The GSAP layer in plan-fit-gsap.tsx is loaded lazily and only
// makes the transitions interruptible. It is an enhancement to a real
// component, not the component itself.

// Loaded only when the pricing chapter approaches. The hero never pays for it.
const PlanFitGsap = dynamic(() => import("./plan-fit-gsap"), { ssr: false });

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

  // GSAP is not loaded until the section is close to the viewport. Without this
  // the home page would ship an animation library to pay for a control most
  // visitors scroll past.
  const rootRef = useRef<HTMLDivElement>(null);
  const [enhance, setEnhance] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || enhance) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEnhance(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enhance]);

  return (
    <div className="pf" ref={rootRef}>
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

        {/* Real form controls. Native range inputs give arrow keys, Home/End,
            focus and screen reader semantics for free, and every later
            enhancement layers on top of these rather than replacing them. */}
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

        {/* The one real meter in the product, shown against the one plan that
            has a limit. Always visible, because the moment worth creating is
            the slider crossing the cap, and that is exactly when the Free plan
            stops being the recommendation and would otherwise vanish. */}
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

        {/* Announced, not just shown. A sighted visitor sees the card lift; a
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

        {/* The recommended plan, at full size. Then the others as rows.
            Three side-by-side tier cards is the single most recognisable
            pricing layout on the web, and it makes the visitor do the
            comparison the sliders just did for them. */}
        <div className="pf-viewport">
          <div className="pf-track">
            <PlanCard
              plan={PLANS[fit.planId]}
              interval={interval}
              fits
              disclosure={disclosure}
              cta={cta}
            />
            <ul className="pf-others">
              {PURCHASABLE_PLANS.filter((pl) => pl.id !== fit.planId).map(
                (pl) => (
                  <li key={pl.id} className="pf-other">
                    <span className="pf-other-name">{pl.name}</span>
                    <span className="pf-other-price">
                      {pl.priceMonthlyCents === 0
                        ? "Free"
                        : `${formatUsd(pl.priceMonthlyCents)}/mo`}
                    </span>
                    <span className="pf-other-note">{pl.tagline}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        {/* No form here. The same waitlist form already sits in the hero and
            closes the page; a third copy between them is the same ask three
            times, which reads as nagging rather than as an offer. The plan
            card's own button carries this section. */}
      </div>

      {enhance ? <PlanFitGsap /> : null}
    </div>
  );
}

function PlanCard({
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
  const paid = isPaidPlan(plan.id);

  return (
    <article className="mk-card pf-card" data-fit={fits ? "true" : "false"}>
      <div className="pf-card-name">
        {plan.name}
        {fits ? <span className="pf-badge">Fits you</span> : null}
      </div>
      <p className="pf-tagline">{plan.tagline}</p>

      <div>
        <div className="pf-price">
          <span className="pf-amount">{price.amount}</span>
          {price.per ? <span className="pf-per">{price.per}</span> : null}
        </div>
        <div className="pf-price-note">{price.note}</div>
      </div>


      <a
        href={cta === "waitlist" ? "#waitlist" : "#pricing-waitlist"}
        className={`mk-btn${fits ? "" : " mk-btn--ghost"} pf-cta`}
      >
        {plan.priceMonthlyCents === 0 ? "Start free" : "Join the waitlist"}
        <MkIcon name="arrowRight" size={15} />
      </a>

      {/* Ticks and crosses down the side of a feature list are the default
          pricing-table furniture. Two plain groups say the same thing. */}
      <ul className="pf-features">
        {plan.features
          .filter((f) => f.included)
          .map((f) => (
            <li key={f.label} className="pf-feature">
              {f.label}
            </li>
          ))}
      </ul>
      {plan.features.some((f) => !f.included) ? (
        <p className="pf-excluded">
          <span className="pf-excluded-head">Not included</span>
          {plan.features
            .filter((f) => !f.included)
            .map((f) => f.label)
            .join(", ")}
          .
        </p>
      ) : null}

      {/* Rendered as what plans.ts actually says it is. Calling a soft cap a
          hard limit would be the easy thing and it would be a lie. */}
      {plan.id === "breeder" && BREEDER_SOFT_CAP != null ? (
        <p className="pf-softcap">
          Soft cap at {BREEDER_SOFT_CAP}{" "}
          active animals. We&apos;ll ask, we never lock the record.
        </p>
      ) : null}

      {paid && disclosure ? <p className="pf-disclosure">{disclosure}</p> : null}
    </article>
  );
}
