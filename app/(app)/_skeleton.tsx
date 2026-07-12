// Shared loading-skeleton primitives for the (app) route segments. Rendered by
// the sibling loading.tsx files, which Next shows the instant a nav-bar link is
// clicked while the destination page's server work (session + queries) runs.
// Self-contained: the shimmer keyframe ships in an injected <style> so these
// never depend on a shared stylesheet another agent may be editing. Only one
// loading.tsx mounts at a time, so the style tag is never duplicated.
//
// Colors come straight from the --pw-* tokens, so the skeletons track light and
// dark automatically. Motion is dropped under prefers-reduced-motion.

export function SkelStyles() {
  return (
    <style>{`
      @keyframes pw-skel-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .pw-skel {
        background: linear-gradient(
          90deg,
          var(--pw-surface-2) 25%,
          var(--pw-surface-3) 37%,
          var(--pw-surface-2) 63%
        );
        background-size: 200% 100%;
        animation: pw-skel-shimmer 1.5s ease-in-out infinite;
        border-radius: 8px;
      }
      @media (prefers-reduced-motion: reduce) {
        .pw-skel { animation: none; }
      }
    `}</style>
  );
}

export function Skel({
  w,
  h = 14,
  r,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="pw-skel"
      aria-hidden
      style={{ width: w ?? "100%", height: h, ...(r != null ? { borderRadius: r } : {}), ...style }}
    />
  );
}

/** A card shell matching .pw-card dimensions, with optional children. */
export function SkelCard({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--pw-surface)",
        border: "1px solid var(--pw-border)",
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Page-level container that matches the standard (app) page gutters. */
export function SkelPage({
  children,
  maxWidth = 1320,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      style={{ maxWidth, margin: "0 auto", padding: "32px 24px 56px" }}
    >
      <SkelStyles />
      {children}
    </div>
  );
}
