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
  variant = "default",
}: {
  source: string;
  variant?: "default" | "onDark";
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
        ? "Good news, we already have this email saved. We will reach out the moment your early access opens."
        : "Thanks for trusting us with your pets' records. We will email you the moment your early access opens, no spam in between.";
    return (
      <div
        className="mk-card"
        role="status"
        style={{
          padding: "20px 22px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          maxWidth: 460,
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
          <p
            style={{
              margin: 0,
              font: "600 15px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            {heading}
          </p>
          <p
            style={{
              margin: "5px 0 0",
              font: "400 13.5px/1.55 var(--font-inter)",
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
    <form action={formAction} style={{ maxWidth: 480, width: "100%" }}>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <input
          type="email"
          name="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          aria-label="Email address"
          style={{
            flex: "1 1 220px",
            height: 46,
            padding: "0 16px",
            borderRadius: 999,
            border: "1px solid var(--pw-border-strong)",
            background:
              variant === "onDark"
                ? "color-mix(in oklab, var(--pw-surface) 88%, transparent)"
                : "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 15px var(--font-inter)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={pending}
          className="mk-btn mk-btn-primary"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Joining…" : "Join the waitlist"}
          {!pending && <Icon name="arrowRight" size={15} />}
        </button>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          style={{
            margin: "10px 2px 0",
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-status-overdue-fg)",
          }}
        >
          {state.message}
        </p>
      )}
      <p
        style={{
          margin: "10px 2px 0",
          font: "400 12px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        Free during early access. No card, no spam, unsubscribe anytime.
      </p>
    </form>
  );
}
