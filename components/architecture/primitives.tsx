import type { ReactNode } from "react";

// Shared layout primitives for the architecture walkthrough. Every section
// layers three depths: a plain claim, a diagram, and an expandable specifics
// strip. These carry that structure so the diagram files stay about drawing.

export function Section({
  num,
  eyebrow,
  id,
  children,
}: {
  num: string;
  eyebrow: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="arch-section" id={id}>
      <p className="arch-eyebrow">
        <span className="arch-eyebrow-num">{num}</span>
        {eyebrow}
      </p>
      {children}
    </section>
  );
}

export function Claim({ children }: { children: ReactNode }) {
  return <h2 className="arch-claim">{children}</h2>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className="arch-sub">{children}</p>;
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="arch-stats">{children}</div>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="arch-stat">
      <span className="arch-stat-num">{value}</span>
      <span className="arch-stat-label">{label}</span>
    </div>
  );
}

// Wide diagrams scroll inside this frame; the page body never scrolls sideways.
export function DiagramFrame({
  caption,
  children,
}: {
  caption?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="arch-frame">
        <div className="arch-frame-pad">{children}</div>
      </div>
      {caption ? <p className="arch-caption">{caption}</p> : null}
    </>
  );
}

export function Detail({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="arch-details">
      <summary>{summary}</summary>
      <div className="arch-details-body">{children}</div>
    </details>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="arch-legend">{children}</div>;
}

export function LegendItem({
  kind,
  label,
}: {
  kind: "primary" | "default" | "optional";
  label: string;
}) {
  const color =
    kind === "primary"
      ? "var(--pw-accent)"
      : kind === "optional"
        ? "var(--pw-text-subtle)"
        : "var(--pw-border-strong)";
  return (
    <span className="arch-legend-item">
      <span
        className="arch-legend-swatch"
        style={{
          borderTopColor: color,
          borderTopStyle: kind === "optional" ? "dashed" : "solid",
        }}
      />
      {label}
    </span>
  );
}
