"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { sendHouseholdInvitation } from "./actions";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        startTransition(async () => {
          const r = await sendHouseholdInvitation(email.trim(), role);
          if (r.ok) {
            toast.success("Invitation sent");
            setEmail("");
            router.refresh();
          } else {
            toast.error(r.error);
          }
        });
      }}
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "1fr auto auto",
        alignItems: "end",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Invite by email
        </span>
        <input
          type="email"
          required
          placeholder="partner@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            height: 36,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
            outline: "none",
          }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Role
        </span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "member" | "viewer")}
          style={{
            height: 36,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
          }}
        >
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending || !email.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 36,
          padding: "0 16px",
          borderRadius: 6,
          background: "var(--pw-accent)",
          border: "1px solid var(--pw-accent)",
          color: "#fff",
          font: "500 13px var(--font-inter)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending || !email.trim() ? 0.6 : 1,
        }}
      >
        <Icon name="send" size={13} />
        {isPending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
