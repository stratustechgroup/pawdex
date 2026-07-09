"use client";

import { useActionState, useState } from "react";

import { Icon } from "@/components/brand/icon";

import {
  type ClarifyState,
  draftClarificationAction,
  sendClarificationAction,
} from "./actions";

const initial: ClarifyState = { status: "idle" };

export function ClarifyFlow({
  policyId,
  insurerName,
}: {
  policyId: string;
  insurerName: string;
}) {
  const [draftState, draftFormAction, draftPending] = useActionState(
    draftClarificationAction,
    initial,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <form
        action={draftFormAction}
        className="pw-card"
        style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <input type="hidden" name="policy_id" value={policyId} />
        <Field label="Your question (plain English)">
          <textarea
            name="question"
            rows={3}
            required
            placeholder={`e.g. Does this policy cover hip dysplasia surgery for a 5-year-old Golden Retriever?`}
            style={textareaStyle}
          />
        </Field>
        <Field
          label="Relevant policy language (optional)"
          hint="Paste the specific exclusion or clause you want clarified. Pawdex will quote it in the email."
        >
          <textarea
            name="policy_context"
            rows={3}
            placeholder="Optional"
            style={textareaStyle}
          />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={draftPending}
            style={primaryButton(draftPending)}
          >
            <Icon name="sparkles" size={12} />
            {draftPending ? "Drafting…" : "Draft email"}
          </button>
        </div>
      </form>

      {draftState.status === "error" && (
        <Alert variant="error">{draftState.message}</Alert>
      )}

      {draftState.status === "drafted" && (
        <SendForm
          policyId={policyId}
          insurerName={insurerName}
          initialSubject={draftState.subject}
          initialBody={draftState.body}
          authorizationGranted={draftState.authorizationGranted}
        />
      )}
    </div>
  );
}

function SendForm({
  policyId,
  insurerName,
  initialSubject,
  initialBody,
  authorizationGranted,
}: {
  policyId: string;
  insurerName: string;
  initialSubject: string;
  initialBody: string;
  authorizationGranted: boolean;
}) {
  const [sendState, sendFormAction, sending] = useActionState(
    sendClarificationAction,
    initial,
  );
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [recipient, setRecipient] = useState("");

  if (sendState.status === "sent") {
    return (
      <Alert variant="success">
        <Icon name="check" size={13} /> Sent. Pawdex will surface the reply in
        your Inbox when the insurer responds.
      </Alert>
    );
  }

  return (
    <form
      action={sendFormAction}
      className="pw-card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <input type="hidden" name="policy_id" value={policyId} />

      <div
        style={{
          padding: 10,
          background: "var(--pw-accent-soft)",
          color: "var(--pw-accent-fg-on-soft)",
          borderRadius: 8,
          font: "500 11.5px var(--font-inter)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon name="check" size={12} />
        Draft ready — review and send
      </div>

      <Field
        label="Send to (insurer email)"
        hint={`Look up ${insurerName}'s claims or member-services inbox. Pawdex doesn't auto-resolve this.`}
      >
        <input
          type="email"
          name="recipient_email"
          required
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="claims@insurer.com"
          style={inputStyle}
        />
      </Field>

      <Field label="Subject">
        <input
          type="text"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Body" hint="Edit freely before sending — this is your message.">
        <textarea
          name="body"
          required
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ ...textareaStyle, fontFamily: "var(--font-jetbrains-mono)" }}
        />
      </Field>

      {sendState.status === "error" && (
        <Alert variant="error">{sendState.message}</Alert>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="submit"
          disabled={sending || !authorizationGranted}
          title={
            authorizationGranted
              ? undefined
              : "Grant the insurer_clarification_emails authorization first"
          }
          style={primaryButton(sending || !authorizationGranted)}
        >
          <Icon name="send" size={12} />
          {sending ? "Sending…" : "Send to insurer"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function Alert({
  variant,
  children,
}: {
  variant: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 12,
        background:
          variant === "error" ? "var(--pw-pending-bg)" : "var(--pw-accent-soft)",
        color:
          variant === "error"
            ? "var(--pw-pending-fg)"
            : "var(--pw-accent-fg-on-soft)",
        borderRadius: 8,
        font: "400 12.5px var(--font-inter)",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
  resize: "vertical",
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 14px",
    borderRadius: 6,
    border: "1px solid var(--pw-accent)",
    background: "var(--pw-accent)",
    color: "var(--pw-accent-fg)",
    font: "500 12.5px var(--font-inter)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
