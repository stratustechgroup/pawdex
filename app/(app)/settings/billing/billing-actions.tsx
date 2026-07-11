"use client";

import { useState, useTransition } from "react";

import { Icon } from "@/components/brand/icon";
import type { PaidPlanId } from "@/lib/billing/plans";

import {
  openBillingPortal,
  startCheckout,
  type BillingInterval,
} from "./actions";

const cardBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--pw-accent)",
  background: "var(--pw-accent)",
  color: "#f6f4ee",
  font: "600 13px var(--font-inter)",
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  ...cardBtn,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
};

/** Redirects the browser to a Stripe-hosted URL returned by a server action. */
function useBillingAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) {
        window.location.href = result.url;
      } else {
        setError(result.error);
      }
    });
  }

  return { pending, error, run };
}

export function UpgradeButton({
  plan,
  interval,
  label,
}: {
  plan: PaidPlanId;
  interval: BillingInterval;
  label: string;
}) {
  const { pending, error, run } = useBillingAction();
  return (
    <div>
      <button
        type="button"
        style={{ ...cardBtn, opacity: pending ? 0.7 : 1 }}
        disabled={pending}
        onClick={() => run(() => startCheckout({ plan, interval }))}
      >
        {pending ? "Opening…" : label}
        {!pending && <Icon name="arrowRight" size={14} />}
      </button>
      {error && (
        <p role="alert" style={{ margin: "8px 0 0", font: "400 12px var(--font-inter)", color: "var(--pw-status-overdue-fg)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ManageBillingButton() {
  const { pending, error, run } = useBillingAction();
  return (
    <div>
      <button
        type="button"
        style={{ ...ghostBtn, opacity: pending ? 0.7 : 1 }}
        disabled={pending}
        onClick={() => run(() => openBillingPortal())}
      >
        <Icon name="receipt" size={14} />
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error && (
        <p role="alert" style={{ margin: "8px 0 0", font: "400 12px var(--font-inter)", color: "var(--pw-status-overdue-fg)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
