"use client";

import { useActionState } from "react";

import { Icon } from "@/components/brand/icon";

import { requestQuoteAction, type RequestQuoteState } from "./quote-actions";

const initial: RequestQuoteState = { status: "idle" };

type ClinicOption = { id: string; name: string; hasEmail: boolean };
type PetOption = { id: string; name: string };

export function RequestQuoteForm({
  policyId,
  pets,
  clinics,
  defaultPetId,
}: {
  policyId: string;
  pets: PetOption[];
  clinics: ClinicOption[];
  defaultPetId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    requestQuoteAction,
    initial,
  );

  const clinicsWithEmail = clinics.filter((c) => c.hasEmail);
  const noClinicsAvailable = clinicsWithEmail.length === 0;

  return (
    <section
      className="pw-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <header>
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Email your vet for an estimate
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Send the procedure description to a clinic with an email on file —
          reply lands in your inbox and you can paste the gross estimate above
          to compute true OOP.
        </p>
      </header>

      {noClinicsAvailable ? (
        <div
          style={{
            padding: 10,
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 6,
            font: "400 12px var(--font-inter)",
          }}
        >
          No clinics have an email address on file yet. Add one on the clinic
          detail page first.
        </div>
      ) : (
        <form
          action={formAction}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input type="hidden" name="policy_id" value={policyId} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <Field label="Pet">
              <select
                name="pet_id"
                required
                style={inputStyle}
                defaultValue={defaultPetId ?? ""}
              >
                <option value="" disabled>
                  Pick…
                </option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Send to clinic">
              <select name="clinic_id" required style={inputStyle} defaultValue="">
                <option value="" disabled>
                  Pick a clinic…
                </option>
                {clinicsWithEmail.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Procedure to quote">
            <textarea
              name="procedure"
              required
              rows={3}
              placeholder="e.g. Cruciate (CCL) repair on left rear, including pre-op bloodwork, anesthesia, and 7-day post-op rechecks."
              style={{
                ...inputStyle,
                height: "auto",
                padding: "10px 12px",
                resize: "vertical",
              }}
            />
          </Field>

          {state.status === "error" && (
            <div
              style={{
                padding: 10,
                background: "var(--pw-pending-bg)",
                color: "var(--pw-pending-fg)",
                borderRadius: 6,
                font: "400 12px var(--font-inter)",
              }}
            >
              {state.message}
            </div>
          )}
          {state.status === "sent" && (
            <div
              style={{
                padding: 10,
                background: "var(--pw-accent-soft)",
                color: "var(--pw-accent-fg-on-soft)",
                borderRadius: 6,
                font: "400 12px var(--font-inter)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="check" size={12} />
              Email sent — reply lands in your Inbox.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={pending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "500 12px var(--font-inter)",
                cursor: pending ? "wait" : "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              <Icon name="send" size={11} />
              {pending ? "Sending…" : "Request estimate"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
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
