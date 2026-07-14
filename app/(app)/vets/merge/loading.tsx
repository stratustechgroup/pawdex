import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../_skeleton";

// Merge duplicates skeleton: breadcrumb, heading, then a stack of duplicate-group
// cards (header + merge button, with two selectable clinic option rows each).
export default function MergeClinicsLoading() {
  return (
    <SkelPage maxWidth={900}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={90} h={12} r={6} />
          <Skel w={120} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={230} subW={320} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 2 }).map((_, g) => (
            <SkelCard
              key={g}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <Skel w={110} h={12} r={6} />
                  <Skel w={150} h={11} r={6} style={{ marginTop: 6 }} />
                </div>
                <Skel w={160} h={32} r={6} style={{ flexShrink: 0 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--pw-border)",
                    }}
                  >
                    <Skel w={16} h={16} r={8} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Skel w="45%" h={13} />
                      <Skel w="65%" h={11} style={{ marginTop: 6 }} />
                      <Skel w="35%" h={11} style={{ marginTop: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </SkelCard>
          ))}
        </div>
      </div>
    </SkelPage>
  );
}
