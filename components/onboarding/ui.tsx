"use client";

import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/components/brand/icon";

// Shared, mobile-first building blocks for the onboarding flow. Everything is
// inline-styled with --pw-* tokens so it matches the rest of the app and needs
// no new global CSS. Tap targets are >= 44px high.

export const TOTAL_STEPS = 4;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--pw-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 18px 48px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          flex: 1,
        }}
      >
        {children}
      </div>
    </main>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8 }}
      aria-label={`Step ${step} of ${TOTAL_STEPS}`}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "600 12px var(--font-inter)",
          color: "var(--pw-text)",
        }}
      >
        <Icon name="paw" size={15} />
        Pawdex
      </span>
      <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const active = i < step;
          return (
            <span
              key={i}
              style={{
                width: active ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background: active ? "var(--pw-accent)" : "var(--pw-border-strong)",
                transition: "width 220ms ease, background 220ms ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function StepHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {eyebrow ? (
        <span
          style={{
            font: "600 11px var(--font-inter)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--pw-accent)",
          }}
        >
          {eyebrow}
        </span>
      ) : null}
      <h1
        className="serif"
        style={{
          margin: 0,
          font: "500 27px var(--font-source-serif)",
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: "var(--pw-text)",
        }}
      >
        {title}
      </h1>
      {sub ? (
        <p
          style={{
            margin: 0,
            font: "400 14px var(--font-inter)",
            lineHeight: 1.5,
            color: "var(--pw-text-muted)",
          }}
        >
          {sub}
        </p>
      ) : null}
    </header>
  );
}

export const fieldLabelStyle: CSSProperties = {
  display: "block",
  font: "500 11.5px var(--font-inter)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--pw-text-muted)",
  marginBottom: 6,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 13px",
  borderRadius: 10,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 15px var(--font-inter)",
  outline: "none",
};

export function TextField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
      {hint ? (
        <p
          style={{
            margin: "6px 0 0",
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-subtle)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  busy,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  busy?: boolean;
}) {
  const off = disabled || busy;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={off}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        height: 48,
        padding: "0 18px",
        borderRadius: 12,
        border: "1px solid var(--pw-accent)",
        background: "var(--pw-accent)",
        color: "var(--pw-accent-fg)",
        font: "600 14.5px var(--font-inter)",
        cursor: off ? "wait" : "pointer",
        opacity: off ? 0.7 : 1,
        transition: "opacity 140ms ease, transform 80ms ease",
      }}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 44,
        padding: "0 12px",
        borderRadius: 10,
        border: "none",
        background: "transparent",
        color: "var(--pw-text-muted)",
        font: "500 13.5px var(--font-inter)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ light = true, size = 15 }: { light?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className="animate-spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${light ? "rgba(255,255,255,0.4)" : "var(--pw-border-strong)"}`,
        borderTopColor: light ? "#fff" : "var(--pw-accent)",
        borderRadius: "50%",
      }}
    />
  );
}

export function Card({
  children,
  onClick,
  as = "div",
  interactive,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  as?: "div" | "button";
  interactive?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    width: "100%",
    textAlign: "left",
    background: "var(--pw-surface)",
    border: "1px solid var(--pw-border)",
    borderRadius: 14,
    padding: 16,
    color: "var(--pw-text)",
    cursor: interactive ? "pointer" : "default",
    ...style,
  };
  if (as === "button") {
    return (
      <button type="button" onClick={onClick} style={base}>
        {children}
      </button>
    );
  }
  return (
    <div onClick={onClick} style={base}>
      {children}
    </div>
  );
}
