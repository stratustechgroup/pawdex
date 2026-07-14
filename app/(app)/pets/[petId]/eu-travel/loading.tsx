import { Skel, SkelCard, SkelSlot } from "../../../_skeleton";

// EU travel page slot: heading and a stack of requirement cards. Header-less;
// the pet layout keeps its own header + tabs on screen.
export default function EuTravelLoading() {
  return (
    <SkelSlot maxWidth={820}>
      <Skel w={240} h={24} r={8} />
      <Skel w={340} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkelCard key={i} style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Skel w={32} h={32} r={8} />
              <Skel w="45%" h={14} />
            </div>
            <Skel h={40} r={8} style={{ marginTop: 14 }} />
          </SkelCard>
        ))}
      </div>
    </SkelSlot>
  );
}
