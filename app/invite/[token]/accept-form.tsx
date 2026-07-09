"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { acceptInvitation } from "./actions";

export function AcceptForm({
  token,
  householdName,
  inviteeEmail,
  role,
  currentUserEmail,
}: {
  token: string;
  householdName: string;
  inviteeEmail: string;
  role: "owner" | "member" | "viewer";
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const emailMismatch =
    currentUserEmail !== null &&
    inviteeEmail.toLowerCase() !== currentUserEmail.toLowerCase();

  function handleAccept() {
    startTransition(async () => {
      const r = await acceptInvitation(token);
      if (r.ok) {
        toast.success(`Joined ${householdName}`);
        router.push("/");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="pw-card" style={{ padding: 28, textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--pw-accent-soft)",
          color: "var(--pw-accent-fg-on-soft)",
          marginBottom: 14,
        }}
      >
        <Icon name="mail" size={20} />
      </div>
      <h1
        className="serif"
        style={{
          margin: "0 0 8px",
          font: "500 22px var(--font-source-serif)",
          color: "var(--pw-text)",
        }}
      >
        Join {householdName}
      </h1>
      <p
        style={{
          margin: 0,
          font: "400 13.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.55,
        }}
      >
        You&apos;ll be added as a{" "}
        <span style={{ color: "var(--pw-text)", fontWeight: 500 }}>{role}</span>{" "}
        and can see all of this household&apos;s pets, vaccines, medications,
        and visit history.
      </p>

      {emailMismatch && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 8,
            font: "400 12px var(--font-inter)",
            textAlign: "left",
          }}
        >
          Heads up — this invitation was sent to{" "}
          <span className="mono">{inviteeEmail}</span>, but you&apos;re signed
          in as <span className="mono">{currentUserEmail}</span>. You can still
          accept; the household owner will see your real address join the team.
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 10 }}>
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 38,
            padding: "0 18px",
            borderRadius: 6,
            background: "var(--pw-accent)",
            border: "1px solid var(--pw-accent)",
            color: "#fff",
            font: "500 13px var(--font-inter)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Accepting…" : "Accept invitation"}
          <Icon name="check" size={13} />
        </button>
      </div>
    </div>
  );
}
