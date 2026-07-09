"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Icon } from "@/components/brand/icon";

import {
  type UploadPolicyState,
  uploadPolicyDocumentAction,
} from "./actions";

const initial: UploadPolicyState = { status: "idle" };

export function UploadPolicyForm({
  pets,
}: {
  pets: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    uploadPolicyDocumentAction,
    initial,
  );

  return (
    <form
      action={formAction}
      className="pw-card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Label>Pet (optional)</Label>
        <select name="pet_id" style={selectStyle} defaultValue="household">
          <option value="household">Whole household</option>
          {pets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Label>Policy document</Label>
        <input
          type="file"
          name="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
          required
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px dashed var(--pw-border-strong)",
            background: "var(--pw-surface-muted)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
          }}
        />
        <div
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          PDF, JPG, PNG, HEIC, or WebP. Up to 25 MB. Pawdex checks the file
          contents against your existing policies so you can&apos;t accidentally
          upload the same one twice.
        </div>
      </div>

      {state.status === "duplicate" && (
        <div
          style={{
            padding: 12,
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="copy" size={13} />
            <strong>Duplicate detected</strong>
          </div>
          <div style={{ lineHeight: 1.5 }}>{state.message}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Link
              href="/insurance"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 28,
                padding: "0 10px",
                borderRadius: 5,
                border: "1px solid currentColor",
                color: "inherit",
                font: "500 11.5px var(--font-inter)",
                textDecoration: "none",
              }}
            >
              <Icon name="arrowRight" size={11} />
              Open existing policy
            </Link>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div
          style={{
            padding: 12,
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="alert" size={13} />
          {state.message}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 12,
          background: "var(--pw-info-bg)",
          color: "var(--pw-info-fg)",
          borderRadius: 8,
          font: "400 12px var(--font-inter)",
          lineHeight: 1.5,
        }}
      >
        <Icon name="info" size={13} />
        <span>
          The original PDF is preserved in your account. Extracted fields are
          editable on the policy detail page after extraction completes.
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Link
          href="/insurance"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: "0 14px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "500 12.5px var(--font-inter)",
            textDecoration: "none",
          }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 16px",
            borderRadius: 6,
            border: "1px solid var(--pw-accent)",
            background: "var(--pw-accent)",
            color: "var(--pw-accent-fg)",
            font: "500 12.5px var(--font-inter)",
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          <Icon name="upload" size={12} />
          {pending ? "Uploading…" : "Upload + extract"}
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};
