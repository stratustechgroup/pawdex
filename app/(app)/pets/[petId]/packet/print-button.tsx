"use client";

import { Icon } from "@/components/brand/icon";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 14px",
        borderRadius: 6,
        border: "1px solid var(--pw-accent)",
        background: "var(--pw-accent)",
        color: "var(--pw-accent-fg)",
        font: "500 12.5px var(--font-inter)",
        cursor: "pointer",
      }}
    >
      <Icon name="download" size={12} />
      Print / Save as PDF
    </button>
  );
}
