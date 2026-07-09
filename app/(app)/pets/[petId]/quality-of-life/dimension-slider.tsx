"use client";

import { useState } from "react";

export function DimensionSlider({
  name,
  label,
  helper,
  initial,
}: {
  name: string;
  label: string;
  helper: string;
  initial: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 12,
        borderRadius: 8,
        background: "var(--pw-surface-muted)",
        border: "1px solid var(--pw-border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <label
          htmlFor={name}
          style={{
            font: "500 12.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          {label}
        </label>
        <span
          className="tnum"
          style={{
            font: "600 13px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          {value}
        </span>
      </div>
      <input
        id={name}
        name={name}
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <span
        style={{
          font: "400 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.4,
        }}
      >
        {helper}
      </span>
    </div>
  );
}
