import type { CSSProperties } from "react";

// Shared field/button styling for the account forms, matching the login form
// and other settings inputs so the whole surface reads as one system.

export const labelStyle: CSSProperties = {
  font: "500 12.5px var(--font-inter)",
  color: "var(--pw-text-muted)",
};

export const fieldStyle: CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 14px var(--font-inter)",
  outline: "none",
};

export function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 38,
    padding: "0 18px",
    borderRadius: 6,
    border: "1px solid var(--pw-accent)",
    background: "var(--pw-accent)",
    color: "#fff",
    font: "500 13px var(--font-inter)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 38,
    padding: "0 16px",
    borderRadius: 6,
    border: "1px solid var(--pw-border-strong)",
    background: "var(--pw-surface)",
    color: "var(--pw-text)",
    font: "500 13px var(--font-inter)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}
