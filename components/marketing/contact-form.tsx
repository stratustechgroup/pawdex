"use client";

import { useActionState } from "react";

import { Icon } from "@/components/brand/icon";
import {
  submitContactAction,
  type ContactState,
} from "@/app/(marketing)/contact/actions";

const initial: ContactState = { status: "idle" };

// Shared contact form. Rendered on the dedicated /contact page (inside the .mk
// marketing shell) and inside the contact modal (portalled OUTSIDE .mk). The mk
// font variables (--mk-body, --mk-mono) only exist on the .mk element, so every
// font declaration here falls back to --font-inter/--font-jetbrains, which are
// set on <html> and therefore available in both contexts. --pw-* tokens live on
// :root, so those are safe everywhere.
export function ContactForm({ compact = false }: { compact?: boolean }) {
  const [state, formAction, pending] = useActionState(
    submitContactAction,
    initial,
  );

  if (state.status === "sent") {
    return (
      <div
        className="mk-card"
        role="status"
        style={{
          padding: "18px 20px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          width: "100%",
          maxWidth: compact ? undefined : 560,
          textAlign: "left",
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
            className="cf-text"
            style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--pw-text)" }}
          >
            Thanks, we got your message.
          </p>
          <p
            className="cf-text"
            style={{
              margin: "5px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--pw-text-muted)",
            }}
          >
            We read every message and reply within a few business days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`cf${compact ? " cf--compact" : ""}`}
      noValidate
    >
      <style href="pw-contact-form" precedence="medium">{CF_CSS}</style>

      {/* Honeypot: real people never see it, bots fill it. A filled value returns
          a silent success server-side and stores nothing. Mirrors the waitlist
          form: aria-hidden on the input itself, off-screen. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <div className="cf-row">
        <div className="cf-field">
          <label htmlFor="cf-name" className="cf-label">
            Name
          </label>
          <input
            id="cf-name"
            className="cf-control"
            type="text"
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Your name"
            disabled={pending}
          />
        </div>
        <div className="cf-field">
          <label htmlFor="cf-email" className="cf-label">
            Email
          </label>
          <input
            id="cf-email"
            className="cf-control"
            type="email"
            name="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={pending}
          />
        </div>
      </div>

      <div className="cf-field">
        <label htmlFor="cf-subject" className="cf-label">
          Subject{" "}
          <span className="cf-optional">(optional)</span>
        </label>
        <input
          id="cf-subject"
          className="cf-control"
          type="text"
          name="subject"
          maxLength={160}
          autoComplete="off"
          placeholder="What's this about?"
          disabled={pending}
        />
      </div>

      <div className="cf-field">
        <label htmlFor="cf-message" className="cf-label">
          Message
        </label>
        <textarea
          id="cf-message"
          className="cf-control cf-textarea"
          name="message"
          required
          maxLength={4000}
          rows={compact ? 4 : 5}
          placeholder="Tell us what's going on and we'll help."
          disabled={pending}
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="cf-error">
          {state.message}
        </p>
      )}

      <div className="cf-actions">
        <button
          type="submit"
          className="mk-btn"
          disabled={pending}
          style={{ width: "100%", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Sending…" : "Send message"}
          {!pending && (
            <Icon name="arrowRight" size={15} className="mk-btn-arrow" />
          )}
        </button>
        <p className="cf-note">
          We read every message and reply within a few business days.
        </p>
      </div>
    </form>
  );
}

const CF_CSS = `
.cf {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cf--compact {
  max-width: none;
  gap: 13px;
}
.cf-text {
  font-family: var(--mk-body, var(--font-inter), system-ui, sans-serif);
}
.cf-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.cf--compact .cf-row {
  gap: 13px;
}
.cf-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.cf-label {
  font: 600 12.5px var(--mk-body, var(--font-inter), system-ui, sans-serif);
  letter-spacing: 0.01em;
  color: var(--pw-text);
}
.cf-optional {
  font-weight: 400;
  color: var(--pw-text-muted);
}
.cf-control {
  width: 100%;
  min-width: 0;
  /* 16px so iOS Safari never zooms the viewport on focus. */
  font: 400 16px var(--mk-body, var(--font-inter), system-ui, sans-serif);
  color: var(--pw-text);
  background: var(--pw-surface);
  border: 1px solid var(--pw-border-strong);
  border-radius: var(--pw-r-md);
  padding: 11px 13px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
}
.cf-control::placeholder {
  color: var(--pw-text-subtle);
}
.cf-control:focus {
  border-color: var(--pw-border-focus);
  box-shadow: 0 0 0 3px var(--pw-accent-soft);
}
.cf-control:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cf-textarea {
  min-height: 116px;
  line-height: 1.55;
  resize: vertical;
}
.cf-error {
  margin: 0;
  font: 400 12.5px var(--mk-body, var(--font-inter), system-ui, sans-serif);
  color: var(--pw-status-overdue-fg);
}
.cf-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 2px;
}
.cf-note {
  margin: 0;
  font: 400 12px var(--mk-body, var(--font-inter), system-ui, sans-serif);
  color: var(--pw-text-muted);
}
@media (max-width: 520px) {
  .cf-row {
    grid-template-columns: 1fr;
  }
}
`;
