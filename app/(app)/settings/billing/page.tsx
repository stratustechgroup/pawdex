import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { isBillingEnabled } from "@/lib/billing/stripe";
import {
  getHouseholdBillingState,
  subscriptionIsActive,
} from "@/lib/billing/subscription";
import {
  PURCHASABLE_PLANS,
  annualMonthlyEquivalentCents,
  formatUsd,
  isPaidPlan,
  planById,
  type Limit,
  type Plan,
} from "@/lib/billing/plans";
import { planFor } from "@/lib/billing/entitlements";

import { ManageBillingButton, UpgradeButton } from "./billing-actions";

export const metadata = { title: "Billing · Pawdex" };
export const dynamic = "force-dynamic";

function limitText(limit: Limit): string {
  return limit === "unlimited" ? "Unlimited" : String(limit);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [session, { checkout }] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  const billing = await getHouseholdBillingState(session.householdId);
  const enabled = isBillingEnabled();

  const currentPlan = planById(billing.planId);
  const limits = planFor({ plan: billing.planId });
  const hasActiveSub = subscriptionIsActive(billing.subscription);
  const canManage = session.role !== "viewer";

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <header>
        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 28px var(--font-source-serif)",
            letterSpacing: "-0.02em",
            color: "var(--pw-text)",
          }}
        >
          Billing
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Your plan, what it includes, and how to change it.
        </p>
      </header>

      {checkout === "success" && (
        <Banner tone="accent" icon="checkCircle">
          Thanks, your subscription is being set up. It can take a moment to
          appear here while Stripe confirms the payment.
        </Banner>
      )}
      {checkout === "cancelled" && (
        <Banner tone="info" icon="info">
          Checkout was cancelled. Nothing was charged and your plan is unchanged.
        </Banner>
      )}

      {/* Current plan + the entitlements it grants. This is the single visible
          enforcement touchpoint this pass: status + limits, no feature locked. */}
      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead title="Current plan" sub="What your household is on right now." />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent-fg-on-soft)",
            borderRadius: 10,
          }}
        >
          <Icon name="sparkles" size={18} />
          <div style={{ flex: 1 }}>
            <div style={{ font: "600 15px var(--font-inter)" }}>
              {currentPlan.name}
            </div>
            <div style={{ font: "400 12.5px var(--font-inter)", marginTop: 2 }}>
              {billing.planId === "early_access"
                ? "Everything is free while Pawdex is in early access."
                : currentPlan.tagline}
            </div>
          </div>
          {hasActiveSub && billing.subscription?.cancel_at_period_end && (
            <span style={{ font: "500 11.5px var(--font-inter)" }}>
              Cancels at period end
            </span>
          )}
        </div>

        <dl
          style={{
            margin: "16px 0 0",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            rowGap: 8,
            columnGap: 24,
            font: "400 13px var(--font-inter)",
          }}
        >
          <Term>Pets</Term>
          <Detail>{limitText(limits.pets)}</Detail>
          <Term>Document AI / month</Term>
          <Detail>{limitText(limits.aiExtractionsPerMonth)}</Detail>
          <Term>Insurance tools</Term>
          <Detail>{limits.insuranceTools ? "Included" : "Not on this plan"}</Detail>
          <Term>Travel packets</Term>
          <Detail>{limits.travelPackets ? "Included" : "Not on this plan"}</Detail>
          <Term>Breeder operations</Term>
          <Detail>{limits.breederTools ? "Included" : "Not on this plan"}</Detail>
        </dl>

        {hasActiveSub && canManage && enabled && (
          <div style={{ marginTop: 16 }}>
            <ManageBillingButton />
          </div>
        )}
      </section>

      {/* Payments-not-live state: honest banner + the read-only plan matrix. */}
      {!enabled && (
        <Banner tone="info" icon="info">
          Payments open at launch. Early access includes everything, free, the
          plans below are what pricing will look like when it goes live.
        </Banner>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionHead
          title="Plans"
          sub="Change anytime. Your records are never deleted or held back on any plan."
        />
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {PURCHASABLE_PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === billing.planId}
              enabled={enabled}
              canManage={canManage}
            />
          ))}
        </div>
      </section>

      <p
        style={{
          margin: 0,
          font: "400 12px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.6,
        }}
      >
        Downgrading never deletes a pet, hides history, or locks an export.{" "}
        Viewing and exporting your records is always free, on every plan. See the{" "}
        <Link href="/pricing" style={{ color: "var(--pw-accent-fg-on-soft)" }}>
          full pricing page
        </Link>{" "}
        for details.
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  enabled,
  canManage,
}: {
  plan: Plan;
  isCurrent: boolean;
  enabled: boolean;
  canManage: boolean;
}) {
  const annualEq = annualMonthlyEquivalentCents(plan);
  return (
    <div
      className="pw-card"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        outline: isCurrent ? "2px solid var(--pw-accent)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ font: "600 14px var(--font-inter)", color: "var(--pw-text)" }}>
          {plan.name}
        </span>
        {isCurrent && (
          <span
            style={{
              font: "600 10.5px var(--font-inter)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--pw-accent-fg-on-soft)",
              background: "var(--pw-accent-soft)",
              padding: "2px 7px",
              borderRadius: 999,
            }}
          >
            Current
          </span>
        )}
      </div>

      <div>
        <span style={{ font: "600 20px var(--font-inter)", color: "var(--pw-text)" }}>
          {plan.priceMonthlyCents === 0 ? "Free" : `${formatUsd(plan.priceMonthlyCents)}`}
        </span>
        {plan.priceMonthlyCents > 0 && (
          <span style={{ font: "400 12px var(--font-inter)", color: "var(--pw-text-muted)" }}>
            {" "}/ month
          </span>
        )}
        {annualEq !== null && (
          <div style={{ font: "400 11.5px var(--font-inter)", color: "var(--pw-text-muted)", marginTop: 2 }}>
            or {formatUsd(annualEq)}/mo billed annually
          </div>
        )}
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {plan.features.slice(0, 5).map((f) => (
          <li
            key={f.label}
            style={{
              display: "flex",
              gap: 7,
              alignItems: "flex-start",
              font: "400 12px var(--font-inter)",
              color: f.included ? "var(--pw-text)" : "var(--pw-text-subtle)",
            }}
          >
            <Icon
              name={f.included ? "check" : "x"}
              size={12}
              style={{ marginTop: 2, flexShrink: 0, color: f.included ? "var(--pw-accent-fg-on-soft)" : "var(--pw-text-subtle)" }}
            />
            <span style={{ textDecoration: f.included ? undefined : "line-through" }}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Actions only when billing is live, this is a paid tier, it's not the
          current plan, and the member can manage. Otherwise nothing renders,
          honest, no dead buttons. */}
      {enabled && canManage && isPaidPlan(plan.id) && !isCurrent && (
        <>
          {/* COMPLIANCE-OWNED: CA-ARL consent block, must sit adjacent to the
              subscribe action in visible inline text (not behind a link) with
              the real amount + frequency + plan. Graded by compliance before
              billing goes live. Renders only when billing is enabled. */}
          <p
            style={{
              margin: 0,
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.5,
            }}
          >
            By subscribing, you authorize Pawdex to charge your payment method{" "}
            {formatUsd(plan.priceMonthlyCents)} every month to renew your{" "}
            {plan.name} plan automatically, until you cancel. You can cancel
            anytime online in Settings, Billing. There is no phone call and no
            email required. We&apos;ll email you a confirmation of these terms
            right after you subscribe.
          </p>
          <UpgradeButton plan={plan.id} interval="month" label={`Choose ${plan.name}`} />
        </>
      )}
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "accent" | "info";
  icon: string;
  children: React.ReactNode;
}) {
  const bg = tone === "accent" ? "var(--pw-accent-soft)" : "var(--pw-info-bg)";
  const fg = tone === "accent" ? "var(--pw-accent-fg-on-soft)" : "var(--pw-info-fg)";
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: 14,
        background: bg,
        color: fg,
        borderRadius: 8,
        font: "400 12.5px var(--font-inter)",
        lineHeight: 1.5,
      }}
    >
      <Icon name={icon} size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <dt
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        paddingTop: 2,
      }}
    >
      {children}
    </dt>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return <dd style={{ margin: 0, color: "var(--pw-text)" }}>{children}</dd>;
}
