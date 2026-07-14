import {
  SkelPage,
  SkelCard,
  SkelSectionHead,
  SkelGrid,
  Skel,
} from "../../_skeleton";

// Billing skeleton: header, Current-plan card (accent plan box + detail list),
// then a Plans grid of 3 plan cards, then a footer note. maxWidth 760, 28px gap.
export default function BillingLoading() {
  return (
    <SkelPage maxWidth={760}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div>
          <Skel w={110} h={28} r={8} />
          <Skel w={260} h={14} r={6} style={{ marginTop: 10 }} />
        </div>

        {/* Current plan card. */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={120} subW={240} />
          <Skel h={66} r={10} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 24 }}>
                <Skel w={130} h={12} r={6} />
                <Skel w="30%" h={12} r={6} />
              </div>
            ))}
          </div>
        </SkelCard>

        {/* Plans grid (auto-fit minmax 220px), 3 purchasable plans. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SkelSectionHead titleW={70} subW={300} />
          <SkelGrid min={220} gap={12}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkelCard key={i} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <Skel w="45%" h={14} r={6} />
                <Skel w="55%" h={22} r={6} />
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skel key={j} w="85%" h={11} r={6} />
                  ))}
                </div>
              </SkelCard>
            ))}
          </SkelGrid>
        </div>

        <Skel w="90%" h={12} r={6} />
      </div>
    </SkelPage>
  );
}
