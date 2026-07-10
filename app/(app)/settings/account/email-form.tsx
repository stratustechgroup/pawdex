"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { changeEmail } from "./actions";
import { fieldStyle, labelStyle, primaryButtonStyle } from "./ui";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = email.trim() !== "" && email.trim().toLowerCase() !== currentEmail.toLowerCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    const target = email.trim();
    startTransition(async () => {
      const r = await changeEmail(target);
      if (r.ok) {
        setSentTo(target);
        setEmail("");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--pw-surface-2)",
          borderRadius: 8,
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text)",
        }}
      >
        <Icon name="mail" size={14} style={{ color: "var(--pw-text-muted)" }} />
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {currentEmail || "No email on file"}
        </span>
      </div>

      {sentTo ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 14,
            background: "var(--pw-info-bg)",
            color: "var(--pw-info-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
            lineHeight: 1.5,
          }}
        >
          <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            We sent confirmation links to both {currentEmail} and {sentTo}. Your
            email changes only after you click the link in each inbox. Until then
            you keep signing in with your current address.
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="new_email" style={labelStyle}>
            New email
          </label>
          <input
            id="new_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isPending}
            style={fieldStyle}
          />
          <div>
            <button
              type="submit"
              disabled={isPending || !dirty}
              style={primaryButtonStyle(isPending || !dirty)}
            >
              {isPending ? "Sending…" : "Change email"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
