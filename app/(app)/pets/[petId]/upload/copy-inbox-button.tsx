"use client";

import { useState } from "react";

import { Icon } from "@/components/brand/icon";

export function CopyInboxButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // best-effort — fall through silently
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 10px",
        borderRadius: 6,
        border: "1px solid var(--pw-border-strong)",
        background: "var(--pw-surface)",
        color: "var(--pw-text)",
        font: "500 12px var(--font-inter)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={12} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
