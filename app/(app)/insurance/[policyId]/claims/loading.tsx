import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../../_skeleton";

// Claims list: breadcrumb, heading, a "start a new claim" form card, then the
// stack of claim rows (status pill + two lines + chevron), and an info banner.
export default function ClaimsLoading() {
  return (
    <SkelPage maxWidth={920}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={90} h={12} r={6} />
          <Skel w={54} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={110} subW={360} />

        <SkelCard style={{ padding: 18 }}>
          <Skel w={130} h={14} r={6} />
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div>
              <Skel w={90} h={11} r={6} />
              <Skel h={34} r={6} style={{ marginTop: 6 }} />
            </div>
            <div>
              <Skel w={110} h={11} r={6} />
              <Skel h={34} r={6} style={{ marginTop: 6 }} />
            </div>
            <Skel w={104} h={34} r={6} />
          </div>
        </SkelCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelCard key={i} style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Skel w={120} h={20} r={999} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skel w="40%" h={13} />
                  <Skel w="60%" h={11} style={{ marginTop: 7 }} />
                </div>
                <Skel w={14} h={14} r={4} style={{ flexShrink: 0 }} />
              </div>
            </SkelCard>
          ))}
        </div>

        <Skel h={54} r={8} />
      </div>
    </SkelPage>
  );
}
