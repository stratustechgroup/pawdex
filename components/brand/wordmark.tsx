import { PawdexMark } from "./mark";

// Mark + "Pawdex" lockup for marketing surfaces. Uses the app font stack and
// tokens so it matches the product exactly. Monochrome-friendly: pass a single
// `color` to tint mark and text together, or let the mark carry the accent.

export function Wordmark({
  size = 22,
  markColor = "var(--pw-accent)",
  textColor = "var(--pw-text)",
}: {
  size?: number;
  markColor?: string;
  textColor?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(size * 0.36),
        color: textColor,
        font: `650 ${Math.round(size * 0.86)}px var(--font-inter)`,
        letterSpacing: "-0.02em",
      }}
    >
      <PawdexMark size={size} color={markColor} />
      <span>Pawdex</span>
    </span>
  );
}
