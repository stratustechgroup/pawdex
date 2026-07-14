import { Skel, SkelCard, SkelStyles, SkelStatStrip, SkelTabBar } from "../_skeleton";

// Full pet-shell skeleton. This boundary wraps the pets/[petId] LAYOUT, so it
// is what shows on entry to any /pets/[petId] route while that layout blocks on
// its (uncached) session + stat queries. It reproduces the layout scaffold:
// breadcrumb, photo + name header, the 4-up stat strip, and the tab bar, then a
// neutral content block. The body is intentionally shape-neutral because this
// shell also covers subtab landings (e.g. /pets/x/medical), not just Overview.
//
// Once the layout resolves it stays mounted and the page slot is covered by the
// per-tab loading.tsx files (which are header-less on purpose, so the real
// header from the layout is never doubled).
export default function PetShellLoading() {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" style={{ background: "var(--pw-bg)" }}>
      <SkelStyles />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "16px 24px 0", display: "flex", gap: 8 }}>
        <Skel w={70} h={12} r={6} />
        <Skel w={10} h={12} r={6} />
        <Skel w={34} h={12} r={6} />
        <Skel w={10} h={12} r={6} />
        <Skel w={90} h={12} r={6} />
      </div>

      {/* Header: photo + identity + action cluster */}
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          alignItems: "flex-start",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <Skel w={88} h={88} r={44} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skel w={200} h={30} r={8} />
            <Skel w={72} h={22} r={11} />
          </div>
          <Skel w={280} h={14} r={6} style={{ marginTop: 10 }} />
          <SkelStatStrip cells={4} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <Skel w={88} h={32} r={6} />
          <Skel w={116} h={32} r={6} />
          <Skel w={32} h={32} r={6} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 24px" }}>
        <SkelTabBar tabs={8} />
      </div>

      {/* Neutral content block */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 24px 56px" }}>
        <SkelCard style={{ height: 320 }}>
          <Skel w={180} h={16} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skel key={i} h={44} r={8} style={{ marginTop: 14 }} />
          ))}
        </SkelCard>
      </div>
    </div>
  );
}
