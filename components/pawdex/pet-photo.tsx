import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

// Stable tint chooser based on a string (pet name or id). Returns 1–4.
export function tintFromString(s: string | null | undefined): 1 | 2 | 3 | 4 {
  if (!s) return 1;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ((h % 4) + 1) as 1 | 2 | 3 | 4;
}

export function PetPhoto({
  name,
  src,
  size = 48,
  tint,
  ring = true,
  className,
  style,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  tint?: 1 | 2 | 3 | 4;
  ring?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const initial = ((name || "?").trim().charAt(0) || "?").toUpperCase();
  const resolvedTint = tint ?? tintFromString(name);
  const fontSize = Math.max(13, Math.round(size * 0.42));

  if (src) {
    return (
      <span
        className={cn("pw-pet-photo", ring && "ring", className)}
        style={{
          width: size,
          height: size,
          background: `var(--pw-photo-tint-${resolvedTint})`,
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? "Pet"}
          style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1 }}
        />
      </span>
    );
  }

  return (
    <span
      className={cn("pw-pet-photo", ring && "ring", className)}
      style={{
        width: size,
        height: size,
        background: `var(--pw-photo-tint-${resolvedTint})`,
        fontSize: `${fontSize}px`,
        ...style,
      }}
    >
      <span style={{ position: "relative", zIndex: 1, lineHeight: 1 }}>{initial}</span>
    </span>
  );
}
