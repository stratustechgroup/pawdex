"use client";

import { useActionState, useState } from "react";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";

import {
  type CreateShareState,
  createBoardingShareLink,
  revokeBoardingShareLink,
} from "./share-actions";

const initial: CreateShareState = { status: "idle" };

type ExistingLink = {
  id: string;
  recipient_label: string | null;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
};

export function SharePanel({
  petId,
  existing,
}: {
  petId: string;
  existing: ExistingLink[];
}) {
  const [state, formAction, pending] = useActionState(
    createBoardingShareLink,
    initial,
  );
  const [copied, setCopied] = useState(false);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — fall back to selection.
    }
  }

  return (
    <section
      className="pw-card pw-print-hide"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <header>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          <Icon name="link" size={13} />
          Share with boarding / kennel
        </div>
        <div
          style={{
            marginTop: 4,
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Creates a read-only URL with no Pawdex account required. Recipients
          see this exact packet page. Expires automatically.
        </div>
      </header>

      <form
        action={formAction}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <input type="hidden" name="pet_id" value={petId} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Label>Recipient (optional)</Label>
          <input
            name="recipient_label"
            type="text"
            placeholder="e.g. Cleveland Park Kennel"
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Label>Expires in</Label>
          <select name="ttl_days" defaultValue="14" style={inputStyle}>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 34,
            padding: "0 14px",
            borderRadius: 6,
            border: "1px solid var(--pw-accent)",
            background: "var(--pw-accent)",
            color: "var(--pw-accent-fg)",
            font: "500 12.5px var(--font-inter)",
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          <Icon name="plus" size={12} />
          {pending ? "Creating…" : "Create link"}
        </button>
      </form>

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

      {state.status === "created" && (
        <div
          style={{
            padding: 12,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent-fg-on-soft)",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              font: "500 11px var(--font-inter)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Link created · expires{" "}
            {format(new Date(state.expiresAt), "MMM d, yyyy")}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <code
              className="mono"
              style={{
                flex: 1,
                padding: "8px 10px",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                borderRadius: 6,
                font: "500 12px var(--font-jetbrains-mono)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {state.url}
            </code>
            <button
              type="button"
              onClick={() => copy(state.url)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 34,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "500 12px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              <Icon name={copied ? "check" : "copy"} size={12} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div
            style={{
              font: "400 11px var(--font-inter)",
              lineHeight: 1.5,
            }}
          >
            Save this URL now — for security, Pawdex shows it once. You can
            revoke it anytime below.
          </div>
        </div>
      )}

      {existing.length > 0 && (
        <details>
          <summary
            style={{
              cursor: "pointer",
              font: "500 11.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Active &amp; past links ({existing.length})
          </summary>
          <ul
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {existing.map((link) => {
              const isExpired = new Date(link.expires_at) < new Date();
              const isRevoked = !!link.revoked_at;
              const isActive = !isExpired && !isRevoked;
              return (
                <li
                  key={link.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    borderRadius: 6,
                    background: "var(--pw-surface-muted)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: isActive
                        ? "var(--pw-accent)"
                        : isRevoked
                          ? "#b54a4a"
                          : "var(--pw-text-subtle)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: "500 13px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {link.recipient_label ?? "Unlabeled recipient"}
                    </div>
                    <div
                      style={{
                        font: "400 11px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      {isRevoked
                        ? `Revoked ${format(new Date(link.revoked_at!), "MMM d")}`
                        : isExpired
                          ? `Expired ${format(new Date(link.expires_at), "MMM d")}`
                          : `Expires ${format(new Date(link.expires_at), "MMM d, yyyy")}`}
                      {" · "}
                      {link.access_count} view{link.access_count === 1 ? "" : "s"}
                      {link.last_accessed_at &&
                        ` · last ${format(new Date(link.last_accessed_at), "MMM d")}`}
                    </div>
                  </div>
                  {isActive && (
                    <form action={revokeBoardingShareLink}>
                      <input type="hidden" name="link_id" value={link.id} />
                      <input type="hidden" name="pet_id" value={petId} />
                      <button
                        type="submit"
                        title="Revoke this link"
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "var(--pw-text-muted)",
                          cursor: "pointer",
                          font: "500 11.5px var(--font-inter)",
                          padding: 0,
                        }}
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
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
