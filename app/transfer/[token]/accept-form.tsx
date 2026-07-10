"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { acceptTransferAction, declineTransferAction } from "./actions";

export function AcceptTransferForm({
  token,
  animalName,
  fromName,
  currentUserEmail,
  recipientEmail,
  summary,
}: {
  token: string;
  animalName: string;
  fromName: string;
  currentUserEmail: string | null;
  recipientEmail: string | null;
  summary: React.ReactNode;
}) {
  const router = useRouter();
  const [contributeResearch, setContributeResearch] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"accept" | "decline" | null>(null);

  const emailMismatch =
    recipientEmail !== null &&
    currentUserEmail !== null &&
    recipientEmail.toLowerCase() !== currentUserEmail.toLowerCase();

  function handleAccept() {
    setMode("accept");
    startTransition(async () => {
      const r = await acceptTransferAction(token, contributeResearch);
      setMode(null);
      if (r.ok) {
        toast.success(`${animalName} is now in your household`);
        router.push(r.petId ? `/pets/${r.petId}` : "/");
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleDecline() {
    setMode("decline");
    startTransition(async () => {
      const r = await declineTransferAction(token);
      setMode(null);
      if (r.ok) {
        toast.success("Transfer declined");
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
        <Icon name="paw" size={20} />
      </div>
      <h1
        className="serif"
        style={{
          margin: "0 0 8px",
          font: "500 22px var(--font-source-serif)",
          color: "var(--pw-text)",
        }}
      >
        Accept {animalName}
      </h1>
      <p
        style={{
          margin: 0,
          font: "400 13.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.55,
        }}
      >
        {fromName} is transferring {animalName} to you. Accepting brings{" "}
        {animalName}&apos;s full medical record into your household. The sender&apos;s
        own business and communication history stays with them.
      </p>

      {summary}

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
          Heads up — this transfer was addressed to{" "}
          <span className="mono">{recipientEmail}</span>, but you&apos;re signed in
          as <span className="mono">{currentUserEmail}</span>. You can still
          accept; {animalName} will land in your household.
        </div>
      )}

      <label
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--pw-surface)",
          border: "1px solid var(--pw-border)",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={contributeResearch}
          onChange={(e) => setContributeResearch(e.target.checked)}
          disabled={isPending}
          style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
        />
        <span style={{ font: "400 12px var(--font-inter)", color: "var(--pw-text-muted)", lineHeight: 1.5 }}>
          <span style={{ color: "var(--pw-text)", fontWeight: 500 }}>
            Contribute {animalName}&apos;s de-identified records to research
          </span>
          . Optional. Direct identifiers are always stripped first, and you can
          revoke this later. It never affects the transfer.
        </span>
      </label>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 10 }}>
        <button
          type="button"
          onClick={handleDecline}
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 38,
            padding: "0 16px",
            borderRadius: 6,
            background: "var(--pw-surface)",
            border: "1px solid var(--pw-border-strong)",
            color: "var(--pw-text)",
            font: "500 13px var(--font-inter)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {mode === "decline" ? "Declining…" : "Decline"}
        </button>
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
          {mode === "accept" ? "Accepting…" : `Accept ${animalName}`}
          <Icon name="check" size={13} />
        </button>
      </div>
    </div>
  );
}
