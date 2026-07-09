"use client";

import { useState } from "react";

import { Icon } from "@/components/brand/icon";

export function InboundAddressCard({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Some browsers block clipboard in non-HTTPS dev; fall back to selection.
      const el = document.getElementById("pw-inbound-address");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 10,
        padding: 12,
        borderRadius: 8,
        background: "var(--pw-surface-muted)",
        border: "1px solid var(--pw-border)",
      }}
    >
      <span
        id="pw-inbound-address"
        className="mono"
        style={{
          flex: 1,
          minWidth: 0,
          padding: "10px 12px",
          background: "var(--pw-surface)",
          borderRadius: 6,
          font: "500 13px var(--font-jetbrains-mono)",
          color: "var(--pw-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
        }}
      >
        {address}
      </span>
      <button
        type="button"
        onClick={copy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0 14px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: copied ? "var(--pw-accent-soft)" : "var(--pw-surface)",
          color: copied ? "var(--pw-accent-fg-on-soft)" : "var(--pw-text)",
          font: "500 12.5px var(--font-inter)",
          cursor: "pointer",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={12} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
