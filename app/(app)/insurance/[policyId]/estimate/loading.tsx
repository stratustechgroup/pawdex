import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../../_skeleton";

// Cost estimate: breadcrumb, heading, the request-a-quote card, the compute
// form (2-column grid, procedure + deductible span full), then the estimates
// list and an info banner.
export default function EstimateLoading() {
  return (
    <SkelPage maxWidth={860}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={90} h={12} r={6} />
          <Skel w={110} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={280} subW={400} />

        <SkelCard style={{ padding: 18 }}>
          <Skel w={190} h={14} r={6} />
          <Skel w="70%" h={11} r={6} style={{ marginTop: 8 }} />
          <Skel h={34} r={6} style={{ marginTop: 14 }} />
        </SkelCard>

        <SkelCard style={{ padding: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 14,
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <Skel w={90} h={11} r={6} />
              <Skel h={54} r={8} style={{ marginTop: 6 }} />
            </div>
            <div>
              <Skel w={40} h={11} r={6} />
              <Skel h={34} r={6} style={{ marginTop: 6 }} />
            </div>
            <div>
              <Skel w={150} h={11} r={6} />
              <Skel h={34} r={6} style={{ marginTop: 6 }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Skel w={260} h={11} r={6} />
              <Skel h={34} r={6} style={{ marginTop: 6 }} />
            </div>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Skel w={150} h={34} r={6} />
            </div>
          </div>
        </SkelCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <SkelCard key={i} style={{ padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skel w="55%" h={14} />
                  <Skel w="35%" h={11} style={{ marginTop: 6 }} />
                </div>
                <Skel w={44} h={12} r={6} />
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  padding: 14,
                  borderRadius: 8,
                  background: "var(--pw-surface-muted)",
                }}
              >
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j}>
                    <Skel w="70%" h={10} r={5} />
                    <Skel w="55%" h={18} r={6} style={{ marginTop: 8 }} />
                  </div>
                ))}
              </div>
              <Skel w="80%" h={11} r={6} style={{ marginTop: 10 }} />
            </SkelCard>
          ))}
        </div>

        <Skel h={54} r={8} />
      </div>
    </SkelPage>
  );
}
