import { SkelPage, SkelCard, SkelSectionHead, SkelGrid, Skel } from "../_skeleton";

// Vets & clinics skeleton: heading with a "Merge duplicates" action, then a
// responsive grid of clinic cards (icon tile + name, contact lines, 4-up stats).
export default function VetsLoading() {
  return (
    <SkelPage maxWidth={1100}>
      <SkelSectionHead titleW={190} subW={300} action />

      <SkelGrid min={320} gap={14}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelCard key={i} style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Skel w={38} h={38} r={8} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Skel w="70%" h={14} />
                <Skel w="45%" h={11} style={{ marginTop: 6 }} />
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--pw-border)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <Skel w="55%" h={12} />
              <Skel w="65%" h={12} />
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--pw-border)",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
              }}
            >
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Skel w={20} h={15} r={5} />
                  <Skel w={38} h={9} r={4} />
                </div>
              ))}
            </div>
          </SkelCard>
        ))}
      </SkelGrid>
    </SkelPage>
  );
}
