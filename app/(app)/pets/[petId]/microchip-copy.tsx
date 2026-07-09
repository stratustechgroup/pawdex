"use client";

import { useState } from "react";

import { Icon } from "@/components/brand/icon";

/**
 * Renders a microchip number alongside a one-click copy button. The button
 * briefly flips to a check icon for ~1.5s after a successful copy.
 */
export function MicrochipCopy({
  number,
  registry,
}: {
  number: string;
  registry?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(number).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        font: "500 12.5px var(--font-jetbrains)",
        color: "var(--pw-text)",
      }}
    >
      <span className="tnum">{number}</span>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy microchip number"}
        aria-label="Copy microchip number"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 3,
          margin: 0,
          background: "transparent",
          border: "none",
          color: copied ? "var(--pw-accent)" : "var(--pw-text-muted)",
          cursor: "pointer",
          borderRadius: 3,
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={12} />
      </button>
      {registry && (
        <span
          style={{
            color: "var(--pw-text-muted)",
            fontFamily: "var(--font-inter)",
            fontWeight: 400,
          }}
        >
          · {registry}
        </span>
      )}
    </div>
  );
}
