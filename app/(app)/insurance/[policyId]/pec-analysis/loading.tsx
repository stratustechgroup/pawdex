import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../../_skeleton";

// Pre-existing risk: breadcrumb, heading, the analysis/refine card, and the
// closing info banner.
export default function PecAnalysisLoading() {
  return (
    <SkelPage maxWidth={920}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={90} h={12} r={6} />
          <Skel w={100} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={260} subW={420} />

        <SkelCard style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Skel w="45%" h={13} />
            <Skel w={140} h={32} r={8} />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--pw-border)",
              }}
            >
              <Skel w="55%" h={13} />
              <Skel w="75%" h={11} style={{ marginTop: 7 }} />
            </div>
          ))}
        </SkelCard>

        <Skel h={54} r={8} />
      </div>
    </SkelPage>
  );
}
