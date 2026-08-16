"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/brand/icon";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
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
        {/* The pricing page already announces itself in its own hero; a second
            "Pricing" eyebrow directly beneath it is noise. On the home page,
            where this is one chapter among six, the eyebrow earns its place. */}
        {cta === "waitlist" ? (
          <span className="mk-eyebrow">Pricing</span>
        ) : null}
        <h2 className="mk-h2 pf-headline">
          The record is unlimited on every plan. Reading documents at scale is
          the only thing that costs us anything, so it&apos;s the{" "}
          <em>only thing we meter</em>.
        </h2>

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

        {/* Announced, not just shown. A sighted visitor sees the card lift; a
            screen reader user hears the tier change as they move the slider. */}
        <p className="pf-result" role="status" aria-live="polite">
          <strong>{PLANS[fit.planId].name}</strong> {fit.reason}
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

        <div className="pf-viewport">
          <div className="pf-track">
            {PURCHASABLE_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                interval={interval}
                fits={plan.id === fit.planId}
                docs={docs}
                outgrewFree={fit.outgrewFree}
                disclosure={disclosure}
                cta={cta}
              />
            ))}
          </div>
        </div>

        {cta === "waitlist" ? (
          <div className="pf-waitlist">
            <WaitlistForm source="pricing" center />
          </div>
        ) : null}
      </div>

      {enhance ? <PlanFitGsap /> : null}
    </div>
  );
}

function PlanCard({
  plan,
  interval,
  fits,
  docs,
  outgrewFree,
  disclosure,
  cta,
}: {
  plan: Plan;
  interval: Interval;
  fits: boolean;
  docs: number;
  outgrewFree: boolean;
  disclosure: string;
  cta: "checkout" | "waitlist";
}) {
  const price = priceDisplay(plan, interval);
  const paid = isPaidPlan(plan.id);
  const isFree = plan.id === "free";

  // The Free card's meter. As the slider passes the cap the bar fills and then
  // overflows, and the card steps back on its own. The visitor watches
  // themselves outgrow the free tier instead of being told they will, and it is
  // exactly what the entitlement code does.
  const meterPct = Math.min(100, (docs / FREE_DOC_CAP) * 100);

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

      {isFree ? (
        <div className="pf-meter" data-over={outgrewFree ? "true" : "false"}>
          <div className="pf-meter-head">
            <span>{FREE_DOC_CAP} documents a month</span>
            <span className="pf-meter-count">
              {Math.min(docs, FREE_DOC_CAP)} / {FREE_DOC_CAP}
            </span>
          </div>
          <div className="pf-meter-track">
            <div className="pf-meter-fill" style={{ width: `${meterPct}%` }} />
          </div>
          {outgrewFree ? (
            <p className="pf-meter-over">You are past what Free reads.</p>
          ) : null}
        </div>
      ) : null}

      <a
        href={cta === "waitlist" ? "#waitlist" : "#pricing-waitlist"}
        className={`mk-btn${fits ? "" : " mk-btn--ghost"} pf-cta`}
      >
        {plan.priceMonthlyCents === 0 ? "Start free" : "Join the waitlist"}
        <Icon name="arrowRight" size={15} className="mk-btn-arrow" />
      </a>

      <ul className="pf-features">
        {plan.features.map((f) => (
          <li
            key={f.label}
            className={`pf-feature${f.included ? "" : " pf-feature--off"}`}
          >
            <Icon
              name={f.included ? "check" : "x"}
              size={14}
              className="pf-check"
            />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

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
