"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { createTransferAction, revokeTransferAction } from "./actions";

type PendingTransfer = {
  id: string;
  recipientEmail: string | null;
  createdAt: string;
  expiresAt: string;
};

const fieldLabel: React.CSSProperties = {
  font: "500 12px var(--font-inter)",
  color: "var(--pw-text-muted)",
  marginBottom: 5,
  display: "block",
};

const fieldBox: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 11px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13.5px var(--font-inter)",
  outline: "none",
};

export function TransferPanel({
  petId,
  petName,
  canTransfer,
  pending,
}: {
  petId: string;
  petName: string;
  canTransfer: boolean;
  pending: PendingTransfer[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [newLink, setNewLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createTransferAction(petId, {
        recipientEmail: email.trim() || null,
        message: message.trim() || null,
      });
      if (r.ok) {
        setNewLink(r.link);
        setEmail("");
        setMessage("");
        toast.success("Transfer link created");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleRevoke(id: string) {
    setRevoking(id);
    startTransition(async () => {
      const r = await revokeTransferAction(petId, id);
      setRevoking(null);
      if (r.ok) {
        toast.success("Transfer revoked");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  if (!canTransfer) {
    return (
      <div
        className="pw-card"
        style={{
          padding: 20,
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.6,
        }}
      >
        {petName} isn&apos;t linked to an animal identity record yet, so it can&apos;t
        be transferred. This link is created automatically — check back shortly or
        edit the pet once to trigger it.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {newLink && (
        <div
          className="pw-card"
          style={{
            padding: 18,
            border: "1px solid var(--pw-accent-soft-2)",
            background: "var(--pw-accent-soft)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "600 13px var(--font-inter)",
              color: "var(--pw-accent-fg-on-soft)",
              marginBottom: 8,
            }}
          >
            <Icon name="link" size={15} />
            Share this link with the new owner
          </div>
          <p
            style={{
              margin: "0 0 12px",
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            This is the only time the full link is shown. Copy it now — you can
            always revoke it below and create a fresh one.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              readOnly
              value={newLink}
              onFocus={(e) => e.currentTarget.select()}
              style={{ ...fieldBox, flex: "1 1 240px", background: "var(--pw-surface)" }}
            />
            <button
              type="button"
              onClick={() => copyLink(newLink)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 38,
                padding: "0 16px",
                borderRadius: 6,
                background: "var(--pw-accent)",
                border: "1px solid var(--pw-accent)",
                color: "#fff",
                font: "500 13px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              <Icon name="copy" size={14} />
              Copy
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="transfer-email" style={fieldLabel}>
            Recipient email (optional)
          </label>
          <input
            id="transfer-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="newowner@example.com"
            disabled={isPending}
            style={fieldBox}
          />
          <p
            style={{
              margin: "6px 0 0",
              font: "400 11.5px var(--font-inter)",
              color: "var(--pw-text-subtle)",
            }}
          >
            For your reference only. You still share the link yourself.
          </p>
        </div>

        <div>
          <label htmlFor="transfer-message" style={fieldLabel}>
            Personal message (optional)
          </label>
          <textarea
            id="transfer-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            disabled={isPending}
            placeholder="A note the new owner sees when they open the link."
            style={{ ...fieldBox, height: "auto", padding: "8px 11px", resize: "vertical" }}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
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
            {isPending ? "Creating…" : "Create transfer link"}
            <Icon name="send" size={14} />
          </button>
        </div>
      </form>

      <section>
        <h2
          style={{
            margin: "0 0 10px",
            font: "600 13px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Pending transfers ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p
            style={{
              margin: 0,
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            No open transfer links for {petName}.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {pending.map((t) => (
              <li
                key={t.id}
                className="pw-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      font: "500 13px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    {t.recipientEmail ?? "Shareable link"}
                  </div>
                  <div
                    style={{
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    Created {format(parseISO(t.createdAt), "MMM d")} · expires{" "}
                    {format(parseISO(t.expiresAt), "MMM d, yyyy")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(t.id)}
                  disabled={isPending && revoking === t.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid var(--pw-border-strong)",
                    background: "var(--pw-surface)",
                    color: "var(--pw-status-overdue-fg)",
                    font: "500 12px var(--font-inter)",
                    cursor: "pointer",
                    opacity: revoking === t.id ? 0.6 : 1,
                  }}
                >
                  <Icon name="x" size={13} />
                  {revoking === t.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
