"use client";

import { useActionState } from "react";

import { Icon } from "@/components/brand/icon";
import {
  joinWaitlistAction,
  type WaitlistState,
} from "@/app/(marketing)/home/actions";

const initial: WaitlistState = { status: "idle" };

export function WaitlistForm({
  source,
  center = false,
}: {
  source: string;
  center?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    joinWaitlistAction,
    initial,
  );

  const done = state.status === "joined" || state.status === "already";

  if (done) {
    const heading =
      state.status === "already"
        ? "You are already on the list."
        : "You are on the list.";
    const body =
      state.status === "already"
        ? "We already have this email saved. We will reach out the moment your early access opens."
        : "Thanks for trusting us with your pets' records. We will email you the moment your early access opens, and nothing else in between.";
    return (
      <div
        className="mk-card"
        role="status"
        style={{
          padding: "18px 20px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          maxWidth: 460,
          textAlign: "left",
          marginInline: center ? "auto" : undefined,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent-fg-on-soft)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="check" size={17} />
        </span>
        <div>
          <p style={{ margin: 0, font: "600 15px var(--mk-body)", color: "var(--pw-text)" }}>
            {heading}
          </p>
          <p
            style={{
              margin: "5px 0 0",
              font: "400 13.5px/1.55 var(--mk-body)",
              color: "var(--pw-text-muted)",
            }}
          >
            {body}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      style={{ width: "100%", maxWidth: 460, marginInline: center ? "auto" : undefined }}
    >
      <input type="hidden" name="source" value={source} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <div className={`mk-wl${center ? " mk-wl--center" : ""}`}>
        <input
          type="email"
          name="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          aria-label="Email address"
        />
        <button type="submit" disabled={pending} className="mk-btn" style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Joining…" : "Join the waitlist"}
          {!pending && <Icon name="arrowRight" size={15} className="mk-btn-arrow" />}
        </button>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          style={{
            margin: "10px 2px 0",
            font: "400 12.5px var(--mk-body)",
            color: "var(--pw-status-overdue-fg)",
          }}
        >
          {state.message}
        </p>
      )}
      <p style={{ margin: "10px 2px 0", font: "400 12px var(--mk-body)", color: "var(--pw-text-muted)" }}>
        Free during early access. No card, no spam, unsubscribe anytime.
      </p>
    </form>
  );
}
