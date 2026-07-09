"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Icon } from "@/components/brand/icon";

import {
  requestRecordsAction,
  type RequestRecordsState,
} from "./request-records-action";

const initialState: RequestRecordsState = { status: "idle" };

export function RequestRecordsButton({
  petId,
  medicalEventId,
  clinicHasEmail,
}: {
  petId: string;
  medicalEventId: string;
  clinicHasEmail: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestRecordsAction,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <span
        title="Records request sent — reply will land in your Inbox"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          font: "500 11px var(--font-inter)",
          color: "var(--pw-accent-fg-on-soft)",
          background: "var(--pw-accent-soft)",
          padding: "2px 8px",
          borderRadius: 999,
        }}
      >
        <Icon name="check" size={10} />
        Request sent
      </span>
    );
  }

  if (state.status === "error" && state.code === "authorization_missing") {
    return (
      <Link
        href="/settings/authorizations"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-secondary)",
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        <Icon name="shieldCheck" size={10} />
        Grant authorization
      </Link>
    );
  }

  if (!clinicHasEmail) {
    return (
      <span
        style={{
          font: "400 11px var(--font-inter)",
          color: "var(--pw-text-subtle)",
        }}
      >
        No clinic email
      </span>
    );
  }

  return (
    <form action={formAction} style={{ display: "inline-flex", gap: 6 }}>
      <input type="hidden" name="medical_event_id" value={medicalEventId} />
      <input type="hidden" name="pet_id" value={petId} />
      <button
        type="submit"
        disabled={pending}
        title="Email the clinic and request the full SOAP notes for this visit"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 24,
          padding: "0 8px",
          borderRadius: 5,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "500 11px var(--font-inter)",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        <Icon name="mail" size={10} />
        {pending ? "Sending…" : "Request records"}
      </button>
      {state.status === "error" && (
        <span
          title={state.message}
          style={{
            font: "400 10.5px var(--font-inter)",
            color: "var(--pw-error-fg, #b54a4a)",
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
