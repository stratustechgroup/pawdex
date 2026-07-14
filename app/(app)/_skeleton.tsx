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

/** Bare loading wrapper for a page slot that renders INSIDE a persistent
 * layout (e.g. the pet subtabs, which sit in the pet layout's body container).
 * No gutters of its own so it doesn't double the layout's padding; still
 * injects the shimmer style and the a11y status role. */
export function SkelSlot({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      style={maxWidth ? { maxWidth, margin: "0 auto" } : undefined}
    >
      <SkelStyles />
      {children}
    </div>
  );
}

/** Page/section heading: a title bar, an optional sub line, and an optional
 * right-aligned action button. Wraps on narrow viewports like the real
 * SectionHead / page headers do. */
export function SkelSectionHead({
  titleW = 170,
  subW = 240,
  action = false,
  style,
}: {
  titleW?: number | string;
  subW?: number | string | null;
  action?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 18,
        ...style,
      }}
    >
      <div style={{ maxWidth: "100%" }}>
        <Skel w={titleW} h={22} r={6} />
        {subW ? <Skel w={subW} h={13} r={6} style={{ marginTop: 10 }} /> : null}
      </div>
      {action ? <Skel w={116} h={34} r={8} /> : null}
    </div>
  );
}

/** Responsive auto-fill card grid. minmax uses min(px, 100%) so a card never
 * overflows a narrow phone the way a fixed min track would. */
export function SkelGrid({
  min = 280,
  gap = 16,
  children,
  style,
}: {
  min?: number;
  gap?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A .pw-card holding a stack of list rows: leading tile, two text lines, and
 * an optional trailing chip. Mirrors the inbox / radar / documents list shape. */
export function SkelListRows({
  rows = 6,
  icon = 36,
  iconR = 8,
  trailing = 72,
  padding = 12,
  line1 = "45%",
  line2 = "25%",
}: {
  rows?: number;
  icon?: number;
  iconR?: number;
  trailing?: number | null;
  padding?: number;
  line1?: string;
  line2?: string | null;
}) {
  return (
    <SkelCard style={{ padding: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding,
            borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
          }}
        >
          <Skel w={icon} h={icon} r={iconR} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skel w={line1} h={13} />
            {line2 ? <Skel w={line2} h={11} style={{ marginTop: 7 }} /> : null}
          </div>
          {trailing ? <Skel w={trailing} h={28} r={8} style={{ flexShrink: 0 }} /> : null}
        </div>
      ))}
    </SkelCard>
  );
}

/** A .pw-card wrapping a table-shaped grid. Horizontally scrolls on narrow
 * screens (minWidth + overflowX) exactly like the real record tables. */
export function SkelTable({
  cols = 4,
  rows = 6,
  minWidth = 520,
}: {
  cols?: number;
  rows?: number;
  minWidth?: number;
}) {
  const template = `2fr ${Array.from({ length: cols - 1 })
    .map(() => "1fr")
    .join(" ")}`;
  return (
    <SkelCard style={{ padding: 0, overflowX: "auto" }}>
      <div style={{ minWidth }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: template,
            gap: 14,
            padding: "12px 16px",
            borderBottom: "1px solid var(--pw-border)",
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skel key={i} w="55%" h={11} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: "grid",
              gridTemplateColumns: template,
              gap: 14,
              padding: "15px 16px",
              borderTop: r === 0 ? "none" : "1px solid var(--pw-border)",
            }}
          >
            {Array.from({ length: cols }).map((_, i) => (
              <Skel key={i} w={i === 0 ? "85%" : "55%"} h={13} />
            ))}
          </div>
        ))}
      </div>
    </SkelCard>
  );
}

/** A stack of label + input form rows. Collapses to a single column on mobile
 * by nature (each row is full width). */
export function SkelFormRows({
  rows = 4,
  labelW = 120,
  inputH = 38,
  gap = 18,
}: {
  rows?: number;
  labelW?: number;
  inputH?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <Skel w={labelW} h={12} r={6} />
          <Skel h={inputH} r={8} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/** The 4-up stat strip from the pet header: small label over a value. Wraps on
 * narrow viewports like the real strip. */
export function SkelStatStrip({ cells = 4 }: { cells?: number }) {
  return (
    <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 28 }}>
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i}>
          <Skel w={54} h={10} r={5} />
          <Skel w={82} h={18} r={6} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/** A horizontal tab bar with a bottom border, matching .pet-tabs. Scrolls
 * horizontally on narrow screens rather than wrapping. */
export function SkelTabBar({ tabs = 8 }: { tabs?: number }) {
  const widths = [62, 70, 66, 40, 92, 60, 34, 84];
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--pw-border)",
        overflowX: "auto",
      }}
    >
      {Array.from({ length: tabs }).map((_, i) => (
        <div key={i} style={{ padding: "12px 14px", flexShrink: 0 }}>
          <Skel w={widths[i % widths.length]} h={14} r={6} />
        </div>
      ))}
    </div>
  );
}
